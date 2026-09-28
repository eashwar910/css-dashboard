// /api/event-content?id=<page id>  (an event's Overview or a meeting's notes/minutes)
//   GET   the page body → { markdown, editorMarkdown, source, truncated, canEdit }
//   PUT   replace it { markdown, base } → same shape; 409 if it changed in Notion meanwhile

import { requireCommittee } from './_lib/auth.js';
import { loadPageContent, savePageContent } from './_lib/pageContent.js';
import { HttpError, jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';

export default withHandler(
  ['GET', 'PUT'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;
    const id = pageIdParam(req);
    if (req.method === 'PUT') {
      sendJson(res, 200, await savePageContent(member, id, jsonBody(req)));
      return;
    }
    const content = await loadPageContent(member, id);
    if (!content) throw new HttpError(404, 'Page not found');
    sendJson(res, 200, content);
  },
  'event-content',
);
