// /api/documents
//   GET                     rows of the Documents data source, newest first
//   POST (application/json) add a link { name, type?, url } → { document }
//   POST (application/octet-stream) ?name=&type=&filename=&contentType=
//                           upload the request body as a file → { document }

import { requireCommittee } from './_lib/auth.js';
import { createDocument } from './_lib/documentWrites.js';
import { loadDocuments } from './_lib/documents.js';
import { fileFromRequest } from './_lib/fileUpload.js';
import { jsonBody, queryString, sendJson, withHandler } from './_lib/http.js';

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
      const document = await createDocument(
        member,
        { name: queryString(req, 'name'), type: queryString(req, 'type') },
        fileFromRequest(req),
      );
      sendJson(res, 201, { document });
      return;
    }

    sendJson(res, 201, { document: await createDocument(member, jsonBody(req)) });
  },
  'documents',
);
