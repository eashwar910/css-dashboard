#!/usr/bin/env node
// One-off setup: create the "Event Planning Forms" database on the Notion
// Documents page. Each row is one EPF file, linked to one row of Events.
// It's a separate database from Documents so EPFs never appear in Quick Access.
//
// Usage: node --env-file=.env scripts/create-epf-database.mjs
// Prints the new data source ID; put it in NOTION_EPF_DS_ID.
// Refuses to run if a database with the same title is already on the page.

import { Client } from '@notionhq/client'

const NOTION_VERSION = '2026-03-11'
/** Team Dashboard > Documents */
const DOCUMENTS_PAGE_ID = '382a80c6-3b0a-80f3-ae3d-d4f47281e9cd'
const TITLE = 'Event Planning Forms'

const token = process.env.NOTION_TOKEN
const eventsDataSourceId = process.env.NOTION_EVENTS_DS_ID
if (!token || !eventsDataSourceId) {
  console.error('NOTION_TOKEN and NOTION_EVENTS_DS_ID must be set')
  process.exit(1)
}

const notion = new Client({ auth: token, notionVersion: NOTION_VERSION })

const children = await notion.blocks.children.list({ block_id: DOCUMENTS_PAGE_ID })
const existing = children.results.find((b) => b.type === 'child_database' && b.child_database.title === TITLE)
if (existing) {
  console.error(`"${TITLE}" already exists on the Documents page (${existing.id}). Nothing created.`)
  process.exit(1)
}

const db = await notion.databases.create({
  parent: { type: 'page_id', page_id: DOCUMENTS_PAGE_ID },
  title: [{ type: 'text', text: { content: TITLE } }],
  description: [{ type: 'text', text: { content: 'EPF documents, one per event. Uploaded from the dashboard.' } }],
  is_inline: true,
  icon: { type: 'emoji', emoji: '📋' },
  initial_data_source: {
    properties: {
      Name: { title: {} },
      Event: { relation: { data_source_id: eventsDataSourceId, single_property: {} } },
      File: { files: {} },
      'Uploaded By': { people: {} },
      Uploaded: { created_time: {} },
    },
  },
})

console.log('Database:', db.id)
console.log('NOTION_EPF_DS_ID=' + db.data_sources[0].id)
