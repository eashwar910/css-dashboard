#!/usr/bin/env node
// One-off restructure (2026-09-29), safe to re-run:
//   Meetings: rename the title `Task` → `Name`; add `Created By` (people).
//   Tasks:    add `Week` (date, the Monday of the week a to-do belongs to) and
//             backfill it: open tasks → this week; Done tasks last edited this
//             week or last week → that week. Older Done tasks stay blank.
//
// Usage: node --env-file=.env.local scripts/restructure-meetings-and-weeks.mjs

import { Client } from '@notionhq/client'

const NOTION_VERSION = '2026-03-11'
const { NOTION_TOKEN, NOTION_MEETINGS_DS_ID, NOTION_TASKS_DS_ID } = process.env
if (!NOTION_TOKEN || !NOTION_MEETINGS_DS_ID || !NOTION_TASKS_DS_ID) {
  console.error('NOTION_TOKEN, NOTION_MEETINGS_DS_ID and NOTION_TASKS_DS_ID must be set')
  process.exit(1)
}
const notion = new Client({ auth: NOTION_TOKEN, notionVersion: NOTION_VERSION })

// ── Meetings ─────────────────────────────────────────────────────────────────
const meetings = await notion.dataSources.retrieve({ data_source_id: NOTION_MEETINGS_DS_ID })
const meetingProps = {}
if (meetings.properties.Task?.type === 'title') meetingProps.Task = { name: 'Name' }
if (!meetings.properties['Created By']) meetingProps['Created By'] = { people: {} }
if (Object.keys(meetingProps).length) {
  await notion.dataSources.update({ data_source_id: NOTION_MEETINGS_DS_ID, properties: meetingProps })
  console.log('Meetings updated:', Object.keys(meetingProps).join(', '))
} else console.log('Meetings already restructured')

// ── Tasks ────────────────────────────────────────────────────────────────────
const tasks = await notion.dataSources.retrieve({ data_source_id: NOTION_TASKS_DS_ID })
if (!tasks.properties.Week) {
  await notion.dataSources.update({ data_source_id: NOTION_TASKS_DS_ID, properties: { Week: { date: {} } } })
  console.log('Tasks: added Week')
}

// Monday (YYYY-MM-DD) of the Asia/Kuala_Lumpur week containing `ms`. KL is UTC+8, no DST.
const KL = 8 * 3600_000
const DAY = 86_400_000
function mondayOf(ms) {
  const kl = new Date(ms + KL)
  const monday = Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate()) - ((kl.getUTCDay() + 6) % 7) * DAY
  return new Date(monday).toISOString().slice(0, 10)
}
const thisWeek = mondayOf(Date.now())
const lastWeek = mondayOf(Date.now() - 7 * DAY)

let cursor
do {
  const res = await notion.dataSources.query({ data_source_id: NOTION_TASKS_DS_ID, start_cursor: cursor })
  for (const page of res.results) {
    if (page.properties.Week?.date) continue
    const done = page.properties.Status?.status?.name === 'Done'
    const edited = mondayOf(Date.parse(page.last_edited_time))
    const week = !done ? thisWeek : edited === thisWeek || edited === lastWeek ? edited : null
    if (!week) continue
    await notion.pages.update({ page_id: page.id, properties: { Week: { date: { start: week } } } })
    const name = page.properties.Task?.title?.map((t) => t.plain_text).join('') || '(untitled)'
    console.log(`Tasks: ${name} → Week ${week}`)
  }
  cursor = res.has_more ? res.next_cursor : undefined
} while (cursor)
