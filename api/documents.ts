// GET /api/documents: rows of the Documents data source, newest first.

import { requireCommittee } from './_lib/auth.js';
import { loadDocuments } from './_lib/documents.js';
import { sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    sendJson(res, 200, { documents: await loadDocuments() });
  },
  'documents',
);
