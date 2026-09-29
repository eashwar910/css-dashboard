#!/usr/bin/env node
// One-off (2026-09-30), safe to re-run: add `Attended` (people) to Meetings.
// `Attendees` / `Not Going` are the RSVP replies; `Attended` is who actually
// came, recorded by organisers after the meeting.
//
// Usage: node --env-file=.env.local scripts/add-meeting-attended.mjs

import { Client } from '@notionhq/client'

const NOTION_VERSION = '2026-03-11'
const { NOTION_TOKEN, NOTION_MEETINGS_DS_ID } = process.env
if (!NOTION_TOKEN || !NOTION_MEETINGS_DS_ID) {
  console.error('NOTION_TOKEN and NOTION_MEETINGS_DS_ID must be set')
  process.exit(1)
}
const notion = new Client({ auth: NOTION_TOKEN, notionVersion: NOTION_VERSION })

const meetings = await notion.dataSources.retrieve({ data_source_id: NOTION_MEETINGS_DS_ID })
if (meetings.properties.Attended) {
  console.log(`Meetings already has Attended (${meetings.properties.Attended.type})`)
} else {
  await notion.dataSources.update({ data_source_id: NOTION_MEETINGS_DS_ID, properties: { Attended: { people: {} } } })
  console.log('Meetings: added Attended (people)')
}
