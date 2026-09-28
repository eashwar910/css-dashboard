// /api/meetings (Team Dashboard > Meetings)
//   GET    every meeting, plus whether the signed-in member may add one → { meetings, canCreate }
//   POST   schedule a meeting { title, date, time, notes? } → { meeting }
//          (President, Vice President, Secretary and Head of Tech only)

import { requireCommittee } from './_lib/auth.js';
import { jsonBody, sendJson, withHandler } from './_lib/http.js';
import { canOrganiseMeetings, createMeeting, loadMeetings } from './_lib/meetings.js';

export default withHandler(
  ['GET', 'POST'],
  async (req, res) => {
    const member = await requireCommittee(req, res);
    if (!member) return;

    if (req.method === 'POST') {
      sendJson(res, 201, { meeting: await createMeeting(member, jsonBody(req)) });
      return;
    }
    const [meetings, canCreate] = await Promise.all([loadMeetings(), canOrganiseMeetings(member)]);
    sendJson(res, 200, { meetings, canCreate });
  },
  'meetings',
);
