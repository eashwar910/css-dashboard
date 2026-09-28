// /api/events (Team Dashboard > Events only; meetings are /api/meetings)
//   GET                   every event
//   POST                  create an event { title, start?, end?, location?, status? } → { event }
//   PATCH ?id=<page id>   edit { start, end } (start null = TBA) and/or { location } → { event }

import { requireCommittee } from './_lib/auth.js';
import { loadEvents } from './_lib/events.js';
import { createEvent, updateEvent } from './_lib/eventWrites.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST', 'PATCH'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;

    if (req.method === 'POST') {
      sendJson(res, 201, { event: await createEvent(jsonBody(req)) });
      return;
    }
    if (req.method === 'PATCH') {
      sendJson(res, 200, { event: await updateEvent(pageIdParam(req), jsonBody(req)) });
      return;
    }
    sendJson(res, 200, { events: await loadEvents() });
  },
  'events',
);
