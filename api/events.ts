// /api/events (Team Dashboard > Events only; meetings are /api/meetings)
//   GET                   every event → { events, canDelete, projectStatuses }
//   POST                  create an event { title, start?, end?, location?, status?, project?, stage? } → { event }
//   PATCH ?id=<page id>   edit { title?, status?, start?, end?, location?, stage?, projectStatus? } (start null = TBA) → { event }
//   DELETE ?id=<page id>  move to Notion's trash (organisers only) → { ok: true }

import { requireCommittee } from './_lib/auth.js';
import { loadEvents, loadProjectStatuses } from './_lib/events.js';
import { createEvent, deleteEvent, updateEvent } from './_lib/eventWrites.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';
import { isOrganiser } from './_lib/roles.js';

export default withHandler(
  ['GET', 'POST', 'PATCH', 'DELETE'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    switch (req.method) {
      case 'POST':
        sendJson(res, 201, { event: await createEvent(jsonBody(req)) });
        return;
      case 'PATCH':
        sendJson(res, 200, { event: await updateEvent(pageIdParam(req), jsonBody(req)) });
        return;
      case 'DELETE':
        await deleteEvent(member, pageIdParam(req));
        sendJson(res, 200, { ok: true });
        return;
      default: {
        const [events, canDelete, projectStatuses] = await Promise.all([loadEvents(), isOrganiser(member), loadProjectStatuses()]);
        sendJson(res, 200, { events, canDelete, projectStatuses });
      }
    }
  },
  'events',
);
