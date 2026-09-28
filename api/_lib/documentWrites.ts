// Document writes: add a row to Team Dashboard > Documents, either as a link
// (`Document URL`) or as an uploaded file (`Document File`, via Notion's file
// upload API). Uploaded files have no stable URL, so the dashboard links to
// the Notion page, which shows the file.

import type { CommitteeMember } from './auth.js';
import { HttpError } from './http.js';
import { cacheInvalidate, dataSourceId, notion } from './notion.js';
import { attachedFile, uploadToNotion, type UploadedFile } from './fileUpload.js';
import { write } from './props.js';
import { toDocument, type DocumentDto } from './documents.js';
import { notionUserIdFor } from './users.js';

export interface DocumentCreate {
  name?: unknown;
  type?: unknown;
  url?: unknown;
}

function parseName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Name is required');
  if (text.length > 200) throw new HttpError(400, 'Name must be 200 characters or fewer');
  return text;
}

/** Optional `Document Type`. Notion creates a new select option if it's unknown. */
function parseType(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 100) throw new HttpError(400, 'Type must be text of 100 characters or fewer');
  return value.trim();
}

function parseUrl(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Link is required');
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new HttpError(400, 'Link must be a full URL starting with http:// or https://');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Link must start with http:// or https://');
  }
  return parsed.toString();
}

/**
 * Create a Documents row. With `file`, the bytes are uploaded to Notion first
 * and attached to `Document File`; otherwise `input.url` is required.
 */
export async function createDocument(
  member: CommitteeMember,
  input: DocumentCreate,
  file?: UploadedFile,
): Promise<DocumentDto> {
  const name = parseName(input.name);
  const type = parseType(input.type);
  const link = file ? null : parseUrl(input.url);

  const fileUploadId = file ? await uploadToNotion(file) : null;

  const authorId = await notionUserIdFor(member);
  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('documents') },
    properties: {
      Name: write.title(name),
      'Document Type': write.select(type),
      'Document URL': { url: link },
      Author: write.people(authorId ? [authorId] : []),
      ...(fileUploadId && file ? { 'Document File': attachedFile(fileUploadId, file.filename) } : {}),
    },
  });
  cacheInvalidate('documents:');

  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new document');
  return toDocument(page);
}
