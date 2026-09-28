// /api/external-relations
//   GET                  sponsors and partners → { relations }
//   POST                 create { name, type, valueProvided?, bountyUsdt?, opsMyr?,
//                        sponsorshipFormUrl?, proofOfPaymentUrl? } → { relation }
//   PATCH  ?id=<page id> edit any of those fields → { relation }

import { requireCommittee } from './_lib/auth.js';
import {
  createExternalRelation,
  loadExternalRelations,
  updateExternalRelation,
} from './_lib/externalRelations.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'PATCH'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;

    switch (req.method) {
      case 'POST':
        sendJson(res, 201, { relation: await createExternalRelation(jsonBody(req)) });
        return;
      case 'PATCH':
        sendJson(res, 200, { relation: await updateExternalRelation(pageIdParam(req), jsonBody(req)) });
        return;
      default:
        sendJson(res, 200, { relations: await loadExternalRelations() });
    }
  },
  'external-relations',
);
