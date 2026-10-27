// GET /api/team: ExCo members with year and committee email.
// GET /api/team?roster=1: every active committee member (ExCo and Junior) with
//   their Notion user id, for Weekly. Lives here to stay within Vercel Hobby's
//   12-function limit.

import { requireCommittee } from './_lib/auth.js';
import { queryString, sendJson, withHandler } from './_lib/http.js';
import { committeeRosterRecords } from './_lib/supabaseAdmin.js';
import { loadTeam } from './_lib/team.js';
import { getNotionUserIdForMemberEmail } from './_lib/users.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    if (queryString(req, 'roster')) {
      const records = await committeeRosterRecords();
      const members = await Promise.all(
        records.map(async (member) => ({ ...member, notionUserId: await getNotionUserIdForMemberEmail(member.email) })),
      );
      sendJson(res, 200, { members });
      return;
    }
    sendJson(res, 200, { members: await loadTeam() });
  },
  'team',
);
