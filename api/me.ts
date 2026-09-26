// GET /api/me: the signed-in committee member, for testing the server layer.

import { requireCommittee } from './_lib/auth.js';
import { sendJson, withHandler } from './_lib/http.js';
import { notionUserIdFor } from './_lib/users.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    const notionUserId = await notionUserIdFor(member);

    sendJson(res, 200, { email: member.email, role: member.role, isAdmin: member.isAdmin, notionUserId });
  },
  'me',
);
