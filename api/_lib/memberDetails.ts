// ─────────────────────────────────────────────────────────────────────────────
// Department and academic year for each ExCo member.
//
// Notion's ExCo database has no department or year columns, so they live here
// (server-side only) and /api/team merges them into each member.
//
// Keys are Notion page ids from Computer Science Society > Executive Committee
// (ExCo), NOT names, so renaming someone in Notion doesn't break the link. The
// comment above each entry is only a reminder of who it is.
//
// To update:
//   - Fill in `department` and `year` as plain strings, e.g.
//     { department: 'Computer and Mathematical Sciences', year: 'Year 2' }.
//     Leave null if unknown; the member still appears, just without them.
//   - New ExCo member: open their page in Notion, copy the 32-character id at
//     the end of the URL, and add an entry (dashes optional; they're normalised).
//   - Someone leaves: delete their entry, or leave it; unknown ids are ignored.
//
// Generated from Notion on 2026-09-26 with 11 members.
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberDetails {
  department: string | null;
  year: string | null;
}

const details: Record<string, MemberDetails> = {
  // Lee Yoonjae
  '381a80c6-3b0a-802f-bd7c-f7a3ff212833': { department: null, year: null },
  // Selina Yeoh Yun Ci
  '381a80c6-3b0a-80d6-a06b-ddafd54a6b94': { department: null, year: null },
  // Min Pyae Phyo
  '381a80c6-3b0a-803c-94da-d3169747c534': { department: null, year: null },
  // John Tiong Sie Ho
  '381a80c6-3b0a-8084-9e27-ed5d8ef3106d': { department: null, year: null },
  // Yau Jia Wei
  '381a80c6-3b0a-8070-acf5-d39ca96f1772': { department: null, year: null },
  // Fathima Sakinah Dil Fairaz
  '381a80c6-3b0a-8004-9f52-f654a43ff513': { department: null, year: null },
  // Eashwar Siddha Satish Nath
  '381a80c6-3b0a-80fc-bf67-f096e1d840d7': { department: null, year: null },
  // Wong Zi Xin
  '381a80c6-3b0a-803b-b8d9-e90ed2635334': { department: null, year: null },
  // Muhammad Faysal Bin Md Mijanur Rahman
  '381a80c6-3b0a-8007-acd4-ebcebb014c79': { department: null, year: null },
  // Muhammad Sajid Desai
  '3c0a80c6-3b0a-806f-a410-d592fe9f7808': { department: null, year: null },
  // Logistic Office
  '3cda80c6-3b0a-80bd-87c3-df9ce8fb4c81': { department: null, year: null },
};

const normaliseId = (id: string) => id.replace(/-/g, '').toLowerCase();
const byId = new Map(Object.entries(details).map(([id, d]) => [normaliseId(id), d]));

/** Department/year for a Notion page id, or null if the member isn't listed. */
export function getMemberDetails(pageId: string): MemberDetails | null {
  return byId.get(normaliseId(pageId)) ?? null;
}
