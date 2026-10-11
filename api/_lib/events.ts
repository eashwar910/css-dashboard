// Team Dashboard > Events → the Events tab. Meetings live in their own
// database (meetings.ts) and never appear here.

import type { PageObjectResponse } from '@notionhq/client';
import { cached, dataSourceId, notion, queryAll } from './notion.js';
import { date, richText, select, status, title, type DateValue } from './props.js';

export type EventStatusDto = 'scheduled' | 'planning-in-progress' | 'done';

/** `Stage` options, in order (Gilbot and NottsHack pages). */
export const EVENT_STAGES = ['Ideation', 'Sponsor discovery', 'Sponsor outreach', 'Planning', 'Execution', 'Wrap-up'] as const;

export interface EventDto {
  id: string;
  title: string;
  /** ISO date or datetime exactly as Notion returns it; null = TBA. */
  start: string | null;
  end: string | null;
  /** Notion date without a time (e.g. "2026-09-30"). */
  allDay: boolean;
  location: string | null;
  /** null for an unrecognised Notion status. */
  status: EventStatusDto | null;
  /** `Stage` option name, or null when unset. */
  stage: string | null;
  /** `Project` (e.g. "Gilbot"): set on a project's sub-events. */
  project: string | null;
  /** `Project Status`: the free-form status tag a project page shows. */
  projectStatus: string | null;
  /** The Notion page, for "Open in Notion" links. */
  url: string;
}

const STATUS_MAP: Record<string, EventStatusDto> = {
  'Not started': 'scheduled',
  'In progress': 'planning-in-progress',
  Done: 'done',
};

export function dates(value: DateValue | null) {
  return {
    start: value?.start ?? null,
    end: value?.end ?? null,
    allDay: value ? !value.start.includes('T') : false,
  };
}

export function toEvent(page: PageObjectResponse): EventDto {
  const notionStatus = status(page, 'Status');
  return {
    id: page.id,
    title: title(page, 'Name') ?? 'Untitled event',
    ...dates(date(page, 'Timeline')),
    location: richText(page, 'Location'),
    status: notionStatus ? STATUS_MAP[notionStatus] ?? null : null,
    stage: select(page, 'Stage'),
    project: select(page, 'Project'),
    projectStatus: select(page, 'Project Status'),
    url: page.url,
  };
}

/** Dated items first (by start), then TBA items by title. */
export function compareByStart(a: { start: string | null; title: string }, b: { start: string | null; title: string }): number {
  if (a.start && b.start) return Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title);
  if (a.start) return -1;
  if (b.start) return 1;
  return a.title.localeCompare(b.title);
}

export async function eventPages(): Promise<PageObjectResponse[]> {
  return cached('events:pages', () => queryAll(dataSourceId('events')));
}

export async function loadEvents(): Promise<EventDto[]> {
  return (await eventPages()).map(toEvent).sort(compareByStart);
}

/** Every `Project Status` option, including ones no event uses yet. */
export async function loadProjectStatuses(): Promise<string[]> {
  return cached('events:projectStatuses', async () => {
    const source = await notion().dataSources.retrieve({ data_source_id: dataSourceId('events') });
    const prop = 'properties' in source ? source.properties['Project Status'] : undefined;
    return prop?.type === 'select' ? prop.select.options.map((o) => o.name) : [];
  });
}
