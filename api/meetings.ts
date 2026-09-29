// /api/meetings (Team Dashboard > Meetings)
//   GET                   every meeting → { meetings, canManage, types, roster, me } (me = your Notion user id)
//   POST                  schedule { title, date, time, notes?, venue?, type? } → { meeting }
//   PATCH ?id=<page id>   edit { title?, start?, end?, venue?, type? } (start null = TBA) → { meeting }
//   PATCH ?id=<page id>   { rsvp: 'going' | 'not-going' | null } sets your own reply → { meeting }
//   DELETE ?id=<page id>  move to Notion's trash → { ok: true }
// Attendance is for any committee member; other writes are for the President, Vice President, Secretary, Head of Tech and admins.

import { requireCommittee } from './_lib/auth.js';
import { jsonBody, pageIdParam, sendJson, withHandler } from './_lib/http.js';
import { createMeeting, deleteMeeting, loadMeetings, loadRoster, MEETING_TYPES, setAttendance, updateMeeting } from './_lib/meetings.js';
import { notionUserIdFor } from './_lib/users.js';
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
      case 'PATCH': {
        const body = jsonBody(req);
        const meeting =
          'rsvp' in body
            ? await setAttendance(member, pageIdParam(req), body.rsvp)
            : await updateMeeting(member, pageIdParam(req), body);
        sendJson(res, 200, { meeting });
        return;
      }
      case 'DELETE':
        await deleteMeeting(member, pageIdParam(req));
        sendJson(res, 200, { ok: true });
        return;
      default: {
        const [meetings, canManage, roster, me] = await Promise.all([
          loadMeetings(),
          isOrganiser(member),
          loadRoster(),
          notionUserIdFor(member),
        ]);
        sendJson(res, 200, { meetings, canManage, types: MEETING_TYPES, roster, me });
      }
    }
  },
  'meetings',
);
