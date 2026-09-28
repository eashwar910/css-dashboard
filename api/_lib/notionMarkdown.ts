// Notion "enhanced Markdown" (pages.retrieveMarkdown) → plain GitHub-flavoured
// Markdown the dashboard can render. Handles the Notion tags that event and
// meeting pages actually use; any other tag is left for the client's HTML
// sanitiser, which drops the tag and keeps its text.

/** Wrapper tags whose content Notion indents by one tab per level. */
const WRAPPER_TAGS = ['meeting-notes', 'notes', 'summary', 'transcript'];

function attr(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function formatDate(iso: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }),
  });
}

/** Cell text safe inside a Markdown table: no newlines or bare pipes. */
function tableCell(html: string): string {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
}

/** `<table>…</table>` → GFM table, so Markdown inside cells still renders. */
function tablesToGfm(md: string): string {
  return md.replace(/<table([^>]*)>([\s\S]*?)<\/table>/g, (_all, attrs: string, body: string) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
      [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => tableCell(cell[1])),
    );
    if (rows.length === 0) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
    // GFM needs a header row; use Notion's if it has one, otherwise a blank one
    const hasHeader = /header-row="true"/.test(attrs);
    const header = hasHeader ? pad(rows[0]) : Array(width).fill(' ');
    const bodyRows = hasHeader ? rows.slice(1) : rows;
    const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
    return ['', line(header), line(Array(width).fill('---')), ...bodyRows.map((r) => line(pad(r))), ''].join('\n');
  });
}

/** Remove wrapper tags and the tab indentation Notion adds inside them. */
function unwrapIndentedBlocks(md: string): string {
  const open = new RegExp(`^\\s*<(${WRAPPER_TAGS.join('|')})\\b[^>]*>\\s*$`);
  const close = new RegExp(`^\\s*</(${WRAPPER_TAGS.join('|')})>\\s*$`);
  let depth = 0;
  const out: string[] = [];
  for (const line of md.split('\n')) {
    if (open.test(line)) {
      depth++;
      continue;
    }
    if (close.test(line)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    let stripped = line;
    for (let i = 0; i < depth && stripped.startsWith('\t'); i++) stripped = stripped.slice(1);
    out.push(stripped);
  }
  return out.join('\n');
}

export function toDisplayMarkdown(md: string, userNames: Map<string, string>): string {
  let out = unwrapIndentedBlocks(md);
  out = tablesToGfm(out);
  out = out.replace(/<mention-user\b[^>]*\/?>/g, (tag) => {
    const id = attr(tag, 'url')?.replace(/^user:\/\//, '');
    return `**@${(id && userNames.get(id)) ?? 'someone'}**`;
  });
  out = out.replace(/<mention-date\b[^>]*\/?>/g, (tag) => {
    const start = attr(tag, 'start');
    const end = attr(tag, 'end');
    if (!start) return '';
    return end ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
  });
  out = out.replace(/<empty-block\s*\/?>/g, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}
