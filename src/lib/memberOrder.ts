// ─────────────────────────────────────────────────────────────────────────────
// The order ExCo members are listed in (Team directory, Weekly groups).
//
// Each entry lists the names a person goes by: their ExCo page name and their
// Notion account name can differ ("John Tiong Sie Ho" vs "John.T"). A name
// matches when an alias appears in it as whole words, ignoring case and dots.
// Anyone not listed comes after, in whatever order they were in.
// ─────────────────────────────────────────────────────────────────────────────

const ORDER: string[][] = [
  ['jack', 'lee yoonjae'],
  ['selina'],
  ['min pyae phyo', 'minpyaephyo'],
  ['john'],
  ['sakinah'],
  ['faysal'],
  ['chloe', 'wong zi xin'],
  ['jia wei'],
  ['jia wen', 'wen'],
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
