// GET /api/event-content?id=<page id>: the Notion page body of an event or
// meeting, as Markdown → { markdown, truncated }.

import { requireCommittee } from './_lib/auth.js';
import { loadCalendarItemContent } from './_lib/events.js';
import { HttpError, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    const content = await loadCalendarItemContent(pageIdParam(req));
    if (!content) throw new HttpError(404, 'Event not found');
    sendJson(res, 200, content);
  },
  'event-content',
);
