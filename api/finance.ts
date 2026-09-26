// /api/finance
//   GET                    transactions + totals (overall, per event, unlinked) + canonical options
//   POST                   create a transaction → { transaction, warning, finance }
//   PATCH  ?id=<page id>   { reimbursementStatus } → { transaction, finance }
// Any committee member may add entries and change reimbursement status (docs/PLAN.md "Finance").
// Writes return the refreshed `finance` payload so totals stay consistent.

import { requireCommittee } from './_lib/auth.js';
import { createTransaction, loadFinance, setReimbursementStatus } from './_lib/finance.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'PATCH'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    switch (req.method) {
      case 'GET':
        sendJson(res, 200, await loadFinance());
        return;
      case 'POST': {
        const result = await createTransaction(member, jsonBody(req));
        sendJson(res, 201, { ...result, finance: await loadFinance() });
        return;
      }
      case 'PATCH': {
        const transaction = await setReimbursementStatus(pageIdParam(req), jsonBody(req).reimbursementStatus);
        sendJson(res, 200, { transaction, finance: await loadFinance() });
        return;
      }
    }
  },
  'finance',
);
