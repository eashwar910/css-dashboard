// ─────────────────────────────────────────────────────────────────────────────
// The order ExCo members are listed in (Team directory, Weekly groups).
//
// Each entry lists the names a person goes by: their ExCo page name and their
// Notion account name can differ ("John Tiong Sie Ho" vs "John.T"). A name
// matches when an alias appears in it as whole words, ignoring case and dots.
// Anyone not listed comes after, in whatever order they were in.
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER: readonly (readonly string[])[] = [
  ['lee yoonjae', 'jack'],
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
  ['aung kaung myat', 'aung kaung'],
  ['thu eain san', 'thu eain', 'eain san'],
  ['mohamed radzi bin mohamed saleh', 'mohamed radzi', 'radzi'],
  ['zachary sim kah yao', 'zachary sim', 'zachary'],
];

function words(name: string): string {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

function indexIn(name: string, list: readonly (readonly string[])[]): number {
  const padded = words(name);
  return list.findIndex((aliases) => aliases.some((alias) => padded.includes(` ${alias} `)));
}

/** Position in ORDER, or ORDER.length for anyone not listed. */
export function memberRank(name: string): number {
  const index = indexIn(name, ORDER);
  return index === -1 ? ORDER.length : index;
}

/** Whether the name matches someone in JUNIOR_COMMITTEE (whole words, like memberRank). */
export function isJuniorCommittee(name: string): boolean {
  return indexIn(name, JUNIOR_COMMITTEE) !== -1;
}

/** Whether one name contains the other as whole words ("John Tiong" ~ "John Tiong Sie Ho"). */
export function sameName(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)];
  return x.trim() !== '' && y.trim() !== '' && (x.includes(y) || y.includes(x));
}

/** Compare by memberRank; ties keep their existing order (Array.sort is stable). */
export function compareMembers(a: string, b: string): number {
  return memberRank(a) - memberRank(b);
}
