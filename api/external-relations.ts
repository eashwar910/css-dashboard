// /api/external-relations
//   GET                  sponsors, partners and speakers → { relations }
//   POST                 create { name, type, valueProvided?, bountyUsdt?, opsMyr?,
//                        sponsorshipFormUrl?, proofOfPaymentUrl? } → { relation }
//   PATCH  ?id=<page id> edit any of those fields → { relation }
//   DELETE ?id=<page id> move to Notion's trash → { ok: true }

import { requireCommittee } from './_lib/auth.js';
import {
  createExternalRelation,
  deleteExternalRelation,
  loadExternalRelations,
  updateExternalRelation,
} from './_lib/externalRelations.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'PATCH', 'DELETE'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;

    switch (req.method) {
      case 'POST':
        sendJson(res, 201, { relation: await createExternalRelation(jsonBody(req)) });
        return;
      case 'PATCH':
        sendJson(res, 200, { relation: await updateExternalRelation(pageIdParam(req), jsonBody(req)) });
        return;
      case 'DELETE':
        await deleteExternalRelation(pageIdParam(req));
        sendJson(res, 200, { ok: true });
        return;
      default:
        sendJson(res, 200, { relations: await loadExternalRelations() });
    }
  },
  'external-relations',
);
