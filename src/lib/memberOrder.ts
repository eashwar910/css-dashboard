// ─────────────────────────────────────────────────────────────────────────────
// The order ExCo members are listed in (Team directory, Weekly groups).
//
// Each entry lists the names a person goes by: their ExCo page name and their
// Notion account name can differ ("John Tiong Sie Ho" vs "John.T"). A name
// matches when an alias appears in it as whole words, ignoring case and dots.
// Anyone not listed comes after, in whatever order they were in.
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER: readonly (readonly string[])[] = [
  ['jack'],
  ['lee yoonjae'],
  ['selina yeoh yun ci', 'selina'],
  ['min pyae phyo', 'minpyaephyo'],
  ['john tiong', 'john'],
  ['muhammad faysal', 'faysal'],
  ['fathima sakinah', 'sakinah'],
  ['eashwar siddha satish nath', 'eashwar siddha satish', 'eashwar siddha', 'eashwar'],
  ['wong zi xin', 'chloe'],
  ['muhammad sajid desai', 'muhammad sajid', 'sajid desai', 'sajid'],
  ['muhammad raza', 'raza'],
  ['quek jia wei', 'jia wei'],
  ['jia wen', 'wen'],
];

export const JUNIOR_COMMITTEE: readonly (readonly string[])[] = [
  ['aung kaung myat', 'aung kaung', 'aung'],
  ['thu eain san', 'thu eain', 'eain san', 'thu'],
  ['mohamed radzi bin mohamed saleh', 'mohamed radzi', 'radzi'],
  ['zachary sim kah yao', 'zachary sim', 'zachary'],
];

function words(name: string): string {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/** Position in ORDER, or ORDER.length for anyone not listed. */
export function memberRank(name: string): number {
  const padded = words(name);
  const index = ORDER.findIndex((aliases) => aliases.some((alias) => padded.includes(` ${alias} `)));
  return index === -1 ? ORDER.length : index;
}

/** Compare by memberRank; ties keep their existing order (Array.sort is stable). */
export function compareMembers(a: string, b: string): number {
  return memberRank(a) - memberRank(b);
}
