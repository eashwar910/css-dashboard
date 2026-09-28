// /api/task-requests
//   GET                     { requests: pending requests for me, canAssign, members? }
//                           members (assignee dropdown) is only sent when canAssign
//   POST                    assign { title, assigneeEmail, dueDate? } → { assignee }
//                           President, Vice President and Head of Tech only
//   PATCH  ?id=<page id>    accept { accept: true } → { task }; the assignee only

import { requireCommittee } from './_lib/auth.js';
import { HttpError, jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';
import {
  acceptTaskRequest,
  assignableMembers,
  canAssignTasks,
  createTaskRequest,
  pendingRequestsFor,
} from './_lib/taskRequests.js';

export default withHandler(
  ['GET', 'POST', 'PATCH'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    switch (req.method) {
      case 'POST':
        sendJson(res, 201, await createTaskRequest(member, jsonBody(req)));
        return;
      case 'PATCH': {
        if (jsonBody(req).accept !== true) throw new HttpError(400, 'Send { accept: true } (requests can only be accepted)');
        sendJson(res, 200, { task: await acceptTaskRequest(member, pageIdParam(req)) });
        return;
      }
      default: {
        const [requests, canAssign] = await Promise.all([pendingRequestsFor(member), canAssignTasks(member)]);
        sendJson(res, 200, { requests, canAssign, ...(canAssign ? { members: await assignableMembers(member) } : {}) });
      }
    }
  },
  'task-requests',
);
