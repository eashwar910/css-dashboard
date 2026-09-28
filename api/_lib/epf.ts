// Team Dashboard > Documents > Event Planning Forms → EPFs, one row per file,
// each linked to one row of Events. Kept apart from Documents so EPFs never
// appear in Quick Access. Created by scripts/create-epf-database.mjs.

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { files, relationIds, title, write } from './props.js';
import { attachedFile, uploadToNotion, type UploadedFile } from './fileUpload.js';
import { notionUserIdFor } from './users.js';

export interface EpfDto {
  id: string;
  eventId: string | null;
  name: string;
  fileName: string | null;
  /** The Notion row, which shows the file. File URLs expire, so they aren't used. */
  url: string;
  uploadedAt: string;
}

export function toEpf(page: PageObjectResponse): EpfDto {
  return {
    id: page.id,
    eventId: relationIds(page, 'Event')[0] ?? null,
    name: title(page, 'Name') ?? 'EPF',
    fileName: files(page, 'File')[0]?.name ?? null,
    url: page.url,
    uploadedAt: page.created_time,
  };
}

export async function loadEpfs(): Promise<EpfDto[]> {
  const pages = await cached('epf:pages', () =>
    queryAll(dataSourceId('epf'), { sorts: [{ timestamp: 'created_time', direction: 'descending' }] }),
  );
  return pages.map(toEpf);
}

/** Upload an EPF file and link it to an event. Any committee member may do this. */
export async function createEpf(member: CommitteeMember, eventId: string, file: UploadedFile): Promise<EpfDto> {
  const event = await retrievePageIn('events', eventId);
  if (!event) throw new HttpError(404, 'Event not found');
  const eventName = title(event, 'Name') ?? 'Untitled event';

  const fileUploadId = await uploadToNotion(file);
  const uploaderId = await notionUserIdFor(member);
  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('epf') },
    properties: {
      Name: write.title(`EPF – ${eventName}`),
      Event: write.relation([eventId]),
      File: attachedFile(fileUploadId, file.filename),
      'Uploaded By': write.people(uploaderId ? [uploaderId] : []),
    },
  });
  cacheInvalidate('epf:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new EPF');
  return toEpf(page);
}
