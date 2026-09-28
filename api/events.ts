// /api/events
//   GET    events and meetings for the calendar, each with a kind
//   POST   create an event { title, start?, end?, location?, status? } → { event }

import { requireCommittee } from './_lib/auth.js';
import { loadCalendarItems } from './_lib/events.js';
import { createEvent } from './_lib/eventWrites.js';
import { jsonBody, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'POST'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;

    if (req.method === 'POST') {
      sendJson(res, 201, { event: await createEvent(jsonBody(req)) });
      return;
    }
    sendJson(res, 200, { events: await loadCalendarItems() });
  },
  'events',
);
