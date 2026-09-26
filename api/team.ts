// GET /api/team: ExCo members with department/year and committee email.

import { requireCommittee } from './_lib/auth.js';
import { sendJson, withHandler } from './_lib/http.js';
import { loadTeam } from './_lib/team.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    sendJson(res, 200, { members: await loadTeam() });
  },
  'team',
);
