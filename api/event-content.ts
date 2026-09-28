// /api/event-content?id=<page id>
//   GET   the Notion page body of an event or meeting → { markdown, source?, truncated }
//   PUT   replace an event's Overview { markdown, base } → same shape; 409 if it changed in Notion

import { requireCommittee } from './_lib/auth.js';
import { loadPageContent, saveEventOverview } from './_lib/pageContent.js';
import { HttpError, jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'PUT'],
  async (req, res) => {
    if (!(await requireCommittee(req, res))) return;
    const id = pageIdParam(req);
    if (req.method === 'PUT') {
      sendJson(res, 200, await saveEventOverview(id, jsonBody(req)));
      return;
    }
    const content = await loadPageContent(id);
    if (!content) throw new HttpError(404, 'Event not found');
    sendJson(res, 200, content);
  },
  'event-content',
);
