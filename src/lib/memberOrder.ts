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
  ['muhammad sajid desai', 'muhammad sajid', 'sajid desai', 'muhammad desai', 'sajid'],
  ['muhammad raza', 'raza'],
  ['quek jia wei', 'jia wei'],
  ['jia wen', 'wen'],
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

/** Whether one name contains the other as whole words ("John Tiong" ~ "John Tiong Sie Ho"). */
export function sameName(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)];
  return x.trim() !== '' && y.trim() !== '' && (x.includes(y) || y.includes(x));
}

/** Compare by memberRank; ties keep their existing order (Array.sort is stable). */
export function compareMembers(a: string, b: string): number {
  return memberRank(a) - memberRank(b);
}

/** Weekly-tab sections. Aliases match like ORDER; anyone unlisted is shown above the sections. */
export const DEPARTMENTS: readonly (readonly [string, readonly string[]])[] = [
  ['Marketing', ['sakinah', 'faysal', 'chloe', 'wong zi xin', 'zachary']],
  ['Events', ['raza', 'thu eain', 'eain san', 'jia wen', 'wen', 'muhammad desai', 'sajid desai', 'sajid']],
  ['Tech', ['eashwar', 'aung kaung', 'karon']],
  ['Finance', ['john tiong', 'john']],
];

/** The DEPARTMENTS section a name belongs to, or undefined. */
export function departmentOf(name: string): string | undefined {
  return DEPARTMENTS.find(([, aliases]) => indexIn(name, [aliases]) !== -1)?.[0];
}

/** Only these people see the Finance tab (Jack, Selina, John). */
const FINANCE_VIEWERS = ['Lee Yoonjae', 'Selina Yeoh Yun Ci', 'John Tiong'];

export function canSeeFinance(name: string | null | undefined): boolean {
  return !!name && FINANCE_VIEWERS.some((viewer) => sameName(name, viewer));
}
