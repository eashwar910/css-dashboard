// /api/documents
//   GET                     rows of the Documents data source, newest first
//   POST (application/json) add a link { name, type?, url } → { document }
//   POST (application/octet-stream) ?name=&type=&filename=&contentType=
//                           upload the request body as a file → { document }

import type { VercelRequest } from '@vercel/node';
import { requireCommittee } from './_lib/auth.js';
import { createDocument } from './_lib/documentWrites.js';
import { loadDocuments } from './_lib/documents.js';
import { HttpError, jsonBody, sendJson, withHandler } from './_lib/http.js';

function queryString(req: VercelRequest, name: string): string | undefined {
  const raw = req.query[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

export default withHandler(
  ['GET', 'POST'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    if (req.method === 'GET') {
      sendJson(res, 200, { documents: await loadDocuments() });
      return;
    }

    const contentType = req.headers['content-type'] ?? '';
    if (contentType.startsWith('application/octet-stream')) {
      if (!Buffer.isBuffer(req.body)) throw new HttpError(400, 'Request body must be the file bytes');
      const filename = queryString(req, 'filename')?.trim();
      if (!filename) throw new HttpError(400, 'Query parameter "filename" is required');
      const document = await createDocument(
        member,
        { name: queryString(req, 'name'), type: queryString(req, 'type') },
        { filename, contentType: queryString(req, 'contentType') || 'application/octet-stream', data: req.body },
      );
      sendJson(res, 201, { document });
      return;
    }

    sendJson(res, 201, { document: await createDocument(member, jsonBody(req)) });
  },
  'documents',
);
