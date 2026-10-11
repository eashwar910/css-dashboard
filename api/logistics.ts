// /api/logistics
//   GET                  the Inventory → { items }
//   POST                 create { item, quantity?, qtyNeeded?, location?, event? } → { item }
//   PATCH  ?id=<page id> edit any of those fields → { item }
//   DELETE ?id=<page id> move to Notion's trash → { ok: true }

import { requireCommittee } from './_lib/auth.js';
import { createInventoryItem, deleteInventoryItem, loadInventory, updateInventoryItem } from './_lib/logistics.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'PATCH', 'DELETE'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;

    switch (req.method) {
      case 'POST':
        sendJson(res, 201, { item: await createInventoryItem(jsonBody(req)) });
        return;
      case 'PATCH':
        sendJson(res, 200, { item: await updateInventoryItem(pageIdParam(req), jsonBody(req)) });
        return;
      case 'DELETE':
        await deleteInventoryItem(pageIdParam(req));
        sendJson(res, 200, { ok: true });
        return;
      default:
        sendJson(res, 200, { items: await loadInventory() });
    }
  },
  'logistics',
);
