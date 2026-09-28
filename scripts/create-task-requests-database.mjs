#!/usr/bin/env node
// One-off setup: create the "Task Requests" database on the Notion Team
// Dashboard page. A request is a task one member (President, Vice President
// or Head of Tech) asks another to take on. It becomes a real Tasks row, with
// the assignee as PIC, only when the assignee accepts it on the dashboard.
//
// Usage: node --env-file=.env scripts/create-task-requests-database.mjs
// Prints the new data source ID; put it in NOTION_TASK_REQUESTS_DS_ID.
// Refuses to run if a database with the same title is already on the page.

import { Client } from '@notionhq/client'

const NOTION_VERSION = '2026-03-11'
/** Team Dashboard */
const TEAM_DASHBOARD_PAGE_ID = '382a80c6-3b0a-8041-aff1-e46262bc7f4a'
const TITLE = 'Task Requests'

const token = process.env.NOTION_TOKEN
const tasksDataSourceId = process.env.NOTION_TASKS_DS_ID
if (!token || !tasksDataSourceId) {
  console.error('NOTION_TOKEN and NOTION_TASKS_DS_ID must be set')
  process.exit(1)
}

const notion = new Client({ auth: token, notionVersion: NOTION_VERSION })

let cursor
do {
  const page = await notion.blocks.children.list({ block_id: TEAM_DASHBOARD_PAGE_ID, start_cursor: cursor })
  const existing = page.results.find((b) => b.type === 'child_database' && b.child_database.title === TITLE)
  if (existing) {
    console.error(`"${TITLE}" already exists on the Team Dashboard page (${existing.id}). Nothing created.`)
    process.exit(1)
  }
  cursor = page.has_more ? page.next_cursor : undefined
} while (cursor)

const db = await notion.databases.create({
  parent: { type: 'page_id', page_id: TEAM_DASHBOARD_PAGE_ID },
  title: [{ type: 'text', text: { content: TITLE } }],
  description: [
    {
      type: 'text',
      text: { content: 'Tasks assigned from the dashboard. Each becomes a Tasks row once the assignee accepts it.' },
    },
  ],
  is_inline: true,
  icon: { type: 'emoji', emoji: '📨' },
  initial_data_source: {
    properties: {
      Task: { title: {} },
      'Assigned To': { people: {} },
      'Requested By': { people: {} },
      'Due Date': { date: {} },
      Status: {
        select: {
          options: [
            { name: 'Pending', color: 'yellow' },
            { name: 'Accepted', color: 'green' },
          ],
        },
      },
      'Accepted On': { date: {} },
      'Created Task': { relation: { data_source_id: tasksDataSourceId, single_property: {} } },
      Requested: { created_time: {} },
    },
  },
})

console.log('Database:', db.id)
console.log('NOTION_TASK_REQUESTS_DS_ID=' + db.data_sources[0].id)
