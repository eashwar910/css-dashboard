// /api/tasks
//   GET                    every task, flagged mine/shared/weekly, with `can` permissions
//   POST                   create { title, dueDate?, status?, eventId? } → { task, warning }
//   PATCH  ?id=<page id>   tick/untick { completed } or edit { title?, dueDate?, status?, eventId? } → { task }
//   DELETE ?id=<page id>   move to Notion trash → { ok: true }
// Writes re-check ownership server-side (docs/PLAN.md "Ownership rules").

import { requireCommittee } from './_lib/auth.js';
import { HttpError, jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';
import { createTask, deleteTask, editTask, setTaskCompleted } from './_lib/taskWrites.js';
import { loadTasks } from './_lib/tasks.js';
import { notionUserIdFor } from './_lib/users.js';

export default withHandler(
  ['GET', 'POST', 'PATCH', 'DELETE'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    switch (req.method) {
      case 'GET': {
        const [result, notionUserId] = await Promise.all([loadTasks(member), notionUserIdFor(member)]);
        // notionLinked=false means no Notion user has this member's email, so
        // nothing can be "mine" until committee_members.notion_email is set.
        sendJson(res, 200, { ...result, notionLinked: notionUserId !== null });
        return;
      }
      case 'POST': {
        const body = jsonBody(req);
        sendJson(res, 201, await createTask(member, { ...body, title: body.title }));
        return;
      }
      case 'PATCH': {
        const id = pageIdParam(req);
        const body = jsonBody(req);
        if ('completed' in body) {
          if (Object.keys(body).length > 1) throw new HttpError(400, 'Send either { completed } or edit fields, not both');
          if (typeof body.completed !== 'boolean') throw new HttpError(400, '"completed" must be true or false');
          sendJson(res, 200, { task: await setTaskCompleted(member, id, body.completed) });
          return;
        }
        sendJson(res, 200, { task: await editTask(member, id, body) });
        return;
      }
      case 'DELETE': {
        await deleteTask(member, pageIdParam(req));
        sendJson(res, 200, { ok: true });
        return;
      }
    }
  },
  'tasks',
);
