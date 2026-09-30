// /api/epf
//   GET                                 every EPF, newest first → { epfs }
//   POST ?eventId=&filename=&contentType= (application/octet-stream body)
//                                       upload an EPF for that event → { epf }
//   DELETE ?id=<page id>                move an EPF to Notion's trash → { ok: true }

import { requireCommittee } from './_lib/auth.js';
import { createEpf, deleteEpf, loadEpfs } from './_lib/epf.js';
import { fileFromRequest } from './_lib/fileUpload.js';
import { pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'DELETE'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    if (req.method === 'POST') {
      sendJson(res, 201, { epf: await createEpf(member, pageIdParam(req, 'eventId'), fileFromRequest(req)) });
      return;
    }
    if (req.method === 'DELETE') {
      await deleteEpf(pageIdParam(req));
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 200, { epfs: await loadEpfs() });
  },
  'epf',
);
