// Upload raw bytes to Notion (single-part file upload) so they can be attached
// to a `files` property. Shared by Documents and EPF uploads.

import type { VercelRequest } from '@vercel/node';
import { HttpError, queryString } from './http.js';
import { notion } from './notion.js';

/** Vercel caps request bodies at 4.5 MB, so files must fit under that. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface UploadedFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

/**
 * The file sent as a raw application/octet-stream body, with ?filename= and
 * ?contentType= in the query string. Throws 400 if anything is missing.
 */
export function fileFromRequest(req: VercelRequest): UploadedFile {
  if (!(req.headers['content-type'] ?? '').startsWith('application/octet-stream') || !Buffer.isBuffer(req.body)) {
    throw new HttpError(400, 'Send the file bytes as application/octet-stream');
  }
  const filename = queryString(req, 'filename')?.trim();
  if (!filename) throw new HttpError(400, 'Query parameter "filename" is required');
  return { filename, contentType: queryString(req, 'contentType') || 'application/octet-stream', data: req.body };
}

/** Upload to Notion and return the file upload id to attach within the hour. */
export async function uploadToNotion(file: UploadedFile): Promise<string> {
  if (file.data.length === 0) throw new HttpError(400, 'The file is empty');
  if (file.data.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Files must be 4 MB or smaller');
  const upload = await notion().fileUploads.create({
    mode: 'single_part',
    filename: file.filename,
    content_type: file.contentType,
  });
  await notion().fileUploads.send({
    file_upload_id: upload.id,
    file: { filename: file.filename, data: new Blob([file.data], { type: file.contentType }) },
  });
  return upload.id;
}

/** `files` property value attaching an uploaded file. */
export function attachedFile(fileUploadId: string, filename: string) {
  return { files: [{ type: 'file_upload' as const, file_upload: { id: fileUploadId }, name: filename }] };
}
