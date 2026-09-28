// /api/meetings (Team Dashboard > Meetings)
//   GET                   every meeting → { meetings, canManage, types }
//   POST                  schedule { title, date, time, notes?, venue?, type? } → { meeting }
//   PATCH ?id=<page id>   edit { title?, start?, end?, venue?, type? } (start null = TBA) → { meeting }
//   DELETE ?id=<page id>  move to Notion's trash → { ok: true }
// Writes are for the President, Vice President, Secretary, Head of Tech and admins.

import { requireCommittee } from './_lib/auth.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';
import { createMeeting, deleteMeeting, loadMeetings, MEETING_TYPES, updateMeeting } from './_lib/meetings.js';
import { isOrganiser } from './_lib/roles.js';

export default withHandler(
  ['GET', 'POST', 'PATCH', 'DELETE'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    switch (req.method) {
      case 'POST':
        sendJson(res, 201, { meeting: await createMeeting(member, jsonBody(req)) });
        return;
      case 'PATCH':
        sendJson(res, 200, { meeting: await updateMeeting(member, pageIdParam(req), jsonBody(req)) });
        return;
      case 'DELETE':
        await deleteMeeting(member, pageIdParam(req));
        sendJson(res, 200, { ok: true });
        return;
      default: {
        const [meetings, canManage] = await Promise.all([loadMeetings(), isOrganiser(member)]);
        sendJson(res, 200, { meetings, canManage, types: MEETING_TYPES });
      }
    }
  },
  'meetings',
);
