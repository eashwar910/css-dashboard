// GET /api/sponsors: sponsor contacts from the Marketing Team's Contacts database.

import { requireCommittee } from './_lib/auth.js';
import { sendJson, withHandler } from './_lib/http.js';
import { loadSponsors } from './_lib/sponsors.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    sendJson(res, 200, { sponsors: await loadSponsors() });
  },
  'sponsors',
);
