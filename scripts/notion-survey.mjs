#!/usr/bin/env node
// Read-only survey of every Notion data source the integration token can see.
// Writes notion-survey.json (gitignored — contains real member data).
//
// Usage: node scripts/notion-survey.mjs
// Reads NOTION_TOKEN from the environment, falling back to .env / .env.local.
//
// Only uses search, retrieve and query endpoints. Never writes to Notion.

import { Client, APIErrorCode, isNotionClientError } from '@notionhq/client'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = resolve(ROOT, 'notion-survey.json')
const NOTION_VERSION = '2026-03-11'
const SAMPLE_ROWS = 3

function loadToken() {
  if (process.env.NOTION_TOKEN) return process.env.NOTION_TOKEN
  for (const file of ['.env', '.env.local']) {
    const path = resolve(ROOT, file)
    if (!existsSync(path)) continue
    const match = readFileSync(path, 'utf8').match(/^\s*NOTION_TOKEN\s*=\s*(.+?)\s*$/m)
    if (match) return match[1].replace(/^['"]|['"]$/g, '')
  }
  throw new Error('NOTION_TOKEN not found in environment, .env or .env.local')
}

const notion = new Client({ auth: loadToken(), notionVersion: NOTION_VERSION })

// ---------- helpers ----------

const plainText = (richText = []) => richText.map((t) => t.plain_text).join('')

const isNotFound = (err) =>
  isNotionClientError(err) &&
  (err.code === APIErrorCode.ObjectNotFound || err.code === APIErrorCode.RestrictedResource)

/** Convert a page property value into a plain JSON value. */
function plainValue(prop) {
  if (!prop) return null
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return plainText(prop[prop.type])
    case 'number':
      return prop.number
    case 'select':
      return prop.select?.name ?? null
    case 'status':
      return prop.status?.name ?? null
    case 'multi_select':
      return prop.multi_select.map((o) => o.name)
    case 'date':
      return prop.date ? (prop.date.end ? `${prop.date.start} → ${prop.date.end}` : prop.date.start) : null
    case 'checkbox':
      return prop.checkbox
    case 'url':
    case 'email':
    case 'phone_number':
    case 'created_time':
    case 'last_edited_time':
      return prop[prop.type]
    case 'people':
      return prop.people.map((p) => p.name ?? p.person?.email ?? p.id)
    case 'created_by':
    case 'last_edited_by':
      return prop[prop.type]?.name ?? prop[prop.type]?.id ?? null
    case 'files':
      return prop.files.map((f) => f.name)
    case 'relation':
      return { relation_ids: prop.relation.map((r) => r.id), has_more: prop.has_more ?? false }
    case 'unique_id':
      return prop.unique_id ? `${prop.unique_id.prefix ? prop.unique_id.prefix + '-' : ''}${prop.unique_id.number}` : null
    case 'formula': {
      const f = prop.formula
      return f ? f[f.type] ?? null : null
    }
    case 'rollup': {
      const r = prop.rollup
      if (!r) return null
      if (r.type === 'array') return r.array.map(plainValue)
      return r[r.type] ?? null
    }
    case 'verification':
      return prop.verification?.state ?? null
    case 'button':
      return '(button)'
    default:
      return `(unsupported: ${prop.type})`
  }
}

function isEmpty(v) {
  if (v === null || v === undefined || v === '' || v === false) return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object' && 'relation_ids' in v) return v.relation_ids.length === 0
  return false
}

/** Describe a property's schema: type plus useful config (options, relation target, etc). */
function describeProperty(config) {
  const out = { type: config.type }
  const c = config[config.type] ?? {}
  if (config.type === 'select' || config.type === 'multi_select') {
    out.options = (c.options ?? []).map((o) => o.name)
  } else if (config.type === 'status') {
    out.options = (c.options ?? []).map((o) => o.name)
    out.groups = (c.groups ?? []).map((g) => g.name)
  } else if (config.type === 'relation') {
    out.relation = {
      data_source_id: c.data_source_id ?? null,
      database_id: c.database_id ?? null,
      kind: c.type ?? null,
      synced_property_name: c.dual_property?.synced_property_name ?? null,
    }
  } else if (config.type === 'rollup') {
    out.rollup = {
      relation_property_name: c.relation_property_name,
      rollup_property_name: c.rollup_property_name,
      function: c.function,
    }
  } else if (config.type === 'formula') {
    out.expression = c.expression
  } else if (config.type === 'number') {
    out.format = c.format
  }
  return out
}

// ---------- parent path resolution ----------

const nameCache = new Map() // key `${type}:${id}` -> { name, parent }

async function resolveNode(type, id) {
  const key = `${type}:${id}`
  if (nameCache.has(key)) return nameCache.get(key)
  let node
  try {
    if (type === 'page_id') {
      const page = await notion.pages.retrieve({ page_id: id })
      const titleProp = Object.values(page.properties ?? {}).find((p) => p.type === 'title')
      node = { name: plainText(titleProp?.title) || '(untitled page)', parent: page.parent }
    } else if (type === 'database_id') {
      const db = await notion.databases.retrieve({ database_id: id })
      node = { name: plainText(db.title) || '(untitled database)', parent: db.parent }
    } else if (type === 'block_id') {
      const block = await notion.blocks.retrieve({ block_id: id })
      // Blocks (e.g. columns, toggles) are layout — skip them in the readable path.
      node = { name: null, parent: block.parent }
    } else if (type === 'data_source_id') {
      const ds = await notion.dataSources.retrieve({ data_source_id: id })
      node = { name: plainText(ds.title) || '(untitled data source)', parent: ds.parent }
    } else {
      node = { name: `(${type})`, parent: null }
    }
  } catch (err) {
    if (!isNotFound(err)) throw err
    node = { name: '(no access)', parent: null, inaccessible: true }
  }
  nameCache.set(key, node)
  return node
}

/** Walk up from a parent reference, returning names from root → leaf. */
async function walkPath(parent) {
  const names = []
  let current = parent
  let guard = 0
  while (current && guard++ < 25) {
    if (current.type === 'workspace') {
      names.unshift('Workspace')
      break
    }
    if (current.type === 'agent_id') {
      names.unshift('(agent)')
      break
    }
    const id = current[current.type]
    const node = await resolveNode(current.type, id)
    if (node.name) names.unshift(node.name)
    if (node.inaccessible) break
    current = node.parent
  }
  return names
}

// ---------- survey ----------

async function searchAllDataSources() {
  const results = []
  let cursor
  do {
    const res = await notion.search({
      filter: { property: 'object', value: 'data_source' },
      start_cursor: cursor,
      page_size: 100,
    })
    results.push(...res.results)
    if (res.request_status?.type === 'incomplete') {
      console.warn(`search incomplete: ${res.request_status.incomplete_reason}`)
    }
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return results
}

async function queryRows(dataSourceId, schemaNames) {
  let count = 0
  const samples = []
  let latestRowEdit = null
  // Properties present on rows but missing from the schema. Notion hides relation
  // properties from the schema when the related data source isn't shared with the token.
  const hidden = new Map()
  const filled = {} // property name -> number of rows with a non-empty value
  let cursor
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
    })
    for (const row of res.results) {
      count++
      if (!latestRowEdit && row.last_edited_time) latestRowEdit = row.last_edited_time
      for (const [name, prop] of Object.entries(row.properties ?? {})) {
        if (!isEmpty(plainValue(prop))) filled[name] = (filled[name] ?? 0) + 1
        if (schemaNames.has(name)) continue
        const h = hidden.get(name) ?? { type: prop.type, rows_with_values: 0, sample_related_ids: [] }
        if (prop.type === 'relation' && prop.relation.length) {
          h.rows_with_values++
          for (const r of prop.relation) {
            if (h.sample_related_ids.length < 3 && !h.sample_related_ids.includes(r.id)) h.sample_related_ids.push(r.id)
          }
        }
        hidden.set(name, h)
      }
      if (samples.length < SAMPLE_ROWS && row.object === 'page' && row.properties) {
        const values = {}
        for (const [name, prop] of Object.entries(row.properties)) values[name] = plainValue(prop)
        samples.push({ id: row.id, last_edited_time: row.last_edited_time, values })
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return { count, samples, latestRowEdit, filled, hidden: Object.fromEntries(hidden) }
}

async function main() {
  const bot = await notion.users.me({})
  console.log(`Authenticated as integration: ${bot.name ?? bot.id}`)

  const found = await searchAllDataSources()
  console.log(`Search returned ${found.length} data source(s)`)

  const seenIds = new Set(found.map((d) => d.id))
  const dataSources = []

  for (const partial of found) {
    const ds = partial.properties ? partial : await notion.dataSources.retrieve({ data_source_id: partial.id })
    const title = plainText(ds.title) || '(untitled)'
    const databaseId = ds.parent?.type === 'database_id' ? ds.parent.database_id : null
    process.stdout.write(`  • ${title} … `)

    const pathNames = await walkPath(ds.database_parent ?? null)
    pathNames.push(title)

    const properties = {}
    for (const [name, config] of Object.entries(ds.properties ?? {})) properties[name] = describeProperty(config)

    let rows
    try {
      rows = await queryRows(ds.id, new Set(Object.keys(properties)))
    } catch (err) {
      if (!isNotFound(err)) throw err
      rows = { count: null, samples: [], latestRowEdit: null, filled: {}, hidden: {}, error: err.code }
    }
    console.log(`${rows.count ?? '?'} rows`)
    for (const [name, p] of Object.entries(properties)) p.filled_rows = rows.filled[name] ?? 0

    dataSources.push({
      title,
      data_source_id: ds.id,
      database_id: databaseId,
      url: ds.url,
      path: pathNames.join(' > '),
      is_inline: ds.is_inline,
      in_trash: ds.in_trash ?? ds.archived ?? false,
      created_time: ds.created_time,
      last_edited_time: ds.last_edited_time,
      latest_row_edited_time: rows.latestRowEdit,
      row_count: rows.count,
      query_error: rows.error,
      properties,
      hidden_properties: rows.hidden,
      sample_rows: rows.samples,
    })
  }

  // Relations pointing at data sources outside what search returned.
  const unreachableRelations = []
  const targetAccess = new Map()
  for (const ds of dataSources) {
    for (const [propName, prop] of Object.entries(ds.properties)) {
      if (prop.type !== 'relation') continue
      const target = prop.relation.data_source_id
      if (!target || seenIds.has(target)) continue
      if (!targetAccess.has(target)) {
        try {
          const t = await notion.dataSources.retrieve({ data_source_id: target })
          targetAccess.set(target, { accessible: true, title: plainText(t.title) })
        } catch (err) {
          if (!isNotFound(err)) throw err
          targetAccess.set(target, { accessible: false, title: null })
        }
      }
      unreachableRelations.push({
        from_data_source: ds.title,
        from_data_source_id: ds.data_source_id,
        property: propName,
        target_data_source_id: target,
        target_database_id: prop.relation.database_id,
        ...targetAccess.get(target),
      })
    }
  }

  // Relation properties hidden from the schema entirely — their target isn't shared.
  const hiddenRelations = []
  for (const ds of dataSources) {
    for (const [propName, h] of Object.entries(ds.hidden_properties)) {
      let relatedPageAccessible = null
      if (h.sample_related_ids.length) {
        try {
          await notion.pages.retrieve({ page_id: h.sample_related_ids[0] })
          relatedPageAccessible = true
        } catch (err) {
          if (!isNotFound(err)) throw err
          relatedPageAccessible = false
        }
      }
      hiddenRelations.push({
        from_data_source: ds.title,
        from_path: ds.path,
        from_data_source_id: ds.data_source_id,
        property: propName,
        type: h.type,
        rows_with_values: h.rows_with_values,
        related_page_accessible: relatedPageAccessible,
      })
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    notion_version: NOTION_VERSION,
    integration: bot.name ?? bot.id,
    data_source_count: dataSources.length,
    data_sources: dataSources.sort((a, b) => a.path.localeCompare(b.path)),
    relations_outside_search: unreachableRelations,
    hidden_relation_properties: hiddenRelations,
  }

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${OUT_FILE}`)
  console.log(`${unreachableRelations.length} relation(s) point outside the searchable set`)
  console.log(`${hiddenRelations.length} property(ies) hidden from schemas (likely relations to unshared data sources)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
