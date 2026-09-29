// /api/finance
//   GET                    transactions + totals (overall, per event, unlinked) + canonical options
//   POST                   create a transaction → { transaction, warning, finance }
//   PATCH  ?id=<page id>   { reimbursementStatus } → { transaction, finance }
//   DELETE ?id=<page id>   move to Notion trash → { finance }
// Any committee member may add entries and change reimbursement status; only
// admins or whoever recorded a transaction may delete it (docs/PLAN.md "Finance").
// Writes return the refreshed `finance` payload so totals stay consistent.

import { requireCommittee } from './_lib/auth.js';
import { createTransaction, deleteTransaction, loadFinance, setReimbursementStatus, withPermissions } from './_lib/finance.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'PATCH', 'DELETE'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;
    const finance = async () => withPermissions(member, await loadFinance());

    switch (req.method) {
      case 'GET':
        sendJson(res, 200, await finance());
        return;
      case 'POST': {
        const result = await createTransaction(member, jsonBody(req));
        sendJson(res, 201, { ...result, finance: await finance() });
        return;
      }
      case 'PATCH': {
        const transaction = await setReimbursementStatus(pageIdParam(req), jsonBody(req).reimbursementStatus);
        sendJson(res, 200, { transaction, finance: await finance() });
        return;
      }
      case 'DELETE': {
        await deleteTransaction(member, pageIdParam(req));
        sendJson(res, 200, { finance: await finance() });
        return;
      }
    }
  },
  'finance',
);
