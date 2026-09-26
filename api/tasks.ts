// GET /api/tasks: every task, flagged `mine` and `weekly` for the signed-in member.

import { requireCommittee } from './_lib/auth.js';
import { sendJson, withHandler } from './_lib/http.js';
import { loadTasks } from './_lib/tasks.js';
import { getNotionUserIdByEmail } from './_lib/users.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;
    const [result, notionUserId] = await Promise.all([
      loadTasks(member),
      getNotionUserIdByEmail(member.notionEmail).then((id) => id ?? getNotionUserIdByEmail(member.email)),
    ]);
    // notionLinked=false means no Notion user has this member's email, so
    // nothing can be "mine" until committee_members.notion_email is set.
    sendJson(res, 200, { ...result, notionLinked: notionUserId !== null });
  },
  'tasks',
);
