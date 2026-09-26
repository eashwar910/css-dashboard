// GET /api/events: events and meetings for the calendar, each with a kind.

import { requireCommittee } from './_lib/auth.js';
import { loadCalendarItems } from './_lib/events.js';
import { sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    sendJson(res, 200, { events: await loadCalendarItems() });
  },
  'events',
);
