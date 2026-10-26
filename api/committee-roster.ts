// GET /api/committee-roster: active ExCo and Junior Committee members.

import { requireCommittee } from './_lib/auth.js';
import { sendJson, withHandler } from './_lib/http.js';
import { committeeRosterRecords } from './_lib/supabaseAdmin.js';
import { getNotionUserIdForMemberEmail } from './_lib/users.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    const records = await committeeRosterRecords();
    const members = await Promise.all(
      records.map(async (member) => ({
        ...member,
        notionUserId: await getNotionUserIdForMemberEmail(member.email),
      })),
    );
    sendJson(res, 200, { members });
  },
  'committee-roster',
);
