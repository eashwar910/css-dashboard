import { Mark, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Image } from '@tiptap/extension-image';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Placeholder } from '@tiptap/extensions';
import { Markdown, MarkdownManager } from '@tiptap/markdown';

// ─────────────────────────────────────────────────────────────────────────────
// The rich-text editor for Notion page bodies (event Overviews, meeting notes
// and minutes). People edit formatted text; Markdown is only the wire format
// to Notion's page Markdown API, which accepts GitHub-flavoured Markdown plus
// its own tags. Everything here round-trips without loss:
//   - headings, bold/italic/strike/code, links, lists, checklists, quotes,
//     tables, dividers, code blocks, images (Notion keeps its own hosted image
//     when the image line comes back, even after the signed URL expires)
//   - <br> line breaks (Notion's soft line breaks) and <empty-block/> blank lines
//   - @mentions and date mentions, kept as the original Notion tag
//   - Notion text colours (<span color="red">), shown and saved back
//   - Notion-only blocks (e.g. AI meeting notes, callouts, toggles, child
//     pages): kept byte-for-byte as a read-only block, "edit in Notion"
// Underline has no Markdown form, so it's off. Verified against every event
// and meeting page on 2026-09-29.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notion stores text literally: "&amp;" would be saved as those five
 * characters. Keep Markdown escaping (and escape < > so they can't start a
 * Notion tag) but never HTML entities. Code is still left untouched.
 */
type EncodeText = (text: string, node: unknown, parent: unknown) => string;
const proto = MarkdownManager.prototype as unknown as {
  encodeTextForMarkdown: EncodeText;
  escapeMarkdownSyntax: (text: string) => string;
  codeTypes: Set<string>;
  __notionPatched?: boolean;
};
if (!proto.__notionPatched) {
  const original = proto.encodeTextForMarkdown;
  proto.encodeTextForMarkdown = function (this: typeof proto, text, node, parent) {
    const encoded = original.call(this, text, node, parent);
    // Code contexts come back unchanged; only re-encode normal text
    if (encoded === text) return encoded;
    // Escape < > after Markdown escaping, or their backslashes would be escaped too
    return this.escapeMarkdownSyntax(text).replace(/[<>]/g, '\\$&');
  };
  proto.__notionPatched = true;
}

/** `<br>` both ways (Notion writes soft line breaks as <br>). */
const NotionHardBreak = Node.create({
  name: 'hardBreak',
  inline: true,
  group: 'inline',
  selectable: false,
  linebreakReplacement: true,
  parseHTML: () => [{ tag: 'br' }],
  renderHTML: ({ HTMLAttributes }) => ['br', HTMLAttributes],
  renderText: () => '\n',
  markdownTokenName: 'br',
  markdownTokenizer: {
    name: 'br',
    level: 'inline',
    start: (src: string) => src.search(/<br\s*\/?>/),
    tokenize: (src: string) => {
      const match = src.match(/^<br\s*\/?>/);
      return match ? { type: 'br', raw: match[0] } : undefined;
    },
  },
  parseMarkdown: () => ({ type: 'hardBreak' }),
  renderMarkdown: () => '<br>',
  addKeyboardShortcuts() {
    return { 'Shift-Enter': () => this.editor.commands.setHardBreak() };
  },
});

/**
 * Notion's blank line (`<empty-block/>`) ↔ an empty paragraph. Blank lines
 * matter in Notion: one between two numbered lists restarts the numbering.
 * The server sends them as "&nbsp;" paragraphs, which Paragraph reads as empty.
 */
const renderParagraph = Paragraph.config.renderMarkdown;

const NotionParagraph = Paragraph.extend({
  renderMarkdown(node, h, ctx) {
    // Table cells can't hold a Notion block; an empty cell is just empty
    // (the table serializer renders cell paragraphs with the table as their parent)
    if (!node.content?.length) return ['table', 'tableCell', 'tableHeader'].includes(ctx.parentType ?? '') ? '' : '<empty-block/>';
    return renderParagraph!(node, h, ctx);
  },
});

/** Notion colour names → CSS, for showing coloured text in the editor. */
const NOTION_COLOURS: Record<string, string> = {
  gray: '#787774', brown: '#9f6b53', orange: '#d9730d', yellow: '#cb912f', green: '#448361',
  blue: '#337ea9', purple: '#9065b0', pink: '#c14c8a', red: '#d44c47',
};

/** Coloured text (`<span color="red">…</span>`): the text stays editable, the tag is saved back. */
const NotionColor = Mark.create({
  name: 'notionColor',
  addAttributes: () => ({ attrs: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-notion-color]' }],
  renderHTML: ({ mark }) => {
    const colour = String(mark.attrs.attrs).match(/color="([a-z]+?)(_background)?"/);
    const css = colour ? NOTION_COLOURS[colour[1]] : undefined;
    const style = css ? (colour![2] ? `background-color: ${css}33` : `color: ${css}`) : '';
    return ['span', { 'data-notion-color': '', style }, 0];
  },
  markdownTokenName: 'notionColor',
  markdownTokenizer: {
    name: 'notionColor',
    level: 'inline',
    start: (src: string) => src.search(/<span\b/),
    tokenize: (src, _tokens, lexer) => {
      const match = src.match(/^<span\b([^>]*)>([\s\S]*?)<\/span>/);
      if (!match) return undefined;
      return { type: 'notionColor', raw: match[0], attrs: match[1], tokens: lexer.inlineTokens(match[2]) };
    },
  },
  parseMarkdown: (token, helpers) => helpers.applyMark('notionColor', helpers.parseInline(token.tokens ?? []), { attrs: token.attrs ?? '' }),
  renderMarkdown: (node, h) => `<span${String(node.attrs?.attrs ?? '')}>${h.renderChildren(node)}</span>`,
});

/** Notion's label attribute, added by the server for display only and never saved. */
const LABEL_ATTR = /\s*data-dash-label="[^"]*"/;

/** A Notion @mention (user, date, page…): shows its label, saves the original tag. */
const NotionMention = Node.create({
  name: 'notionMention',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  addAttributes: () => ({ raw: { default: '' }, label: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-notion-mention]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-notion-mention': '', class: 'notion-mention', contenteditable: 'false' }),
    node.attrs.label || 'mention',
  ],
  markdownTokenName: 'notionMention',
  markdownTokenizer: {
    name: 'notionMention',
    level: 'inline',
    start: (src: string) => src.search(/<mention-[a-z]+/),
    tokenize: (src: string) => {
      const match = src.match(/^<(mention-[a-z]+)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/);
      if (!match) return undefined;
      const label = match[0].match(/data-dash-label="([^"]*)"/)?.[1] ?? '';
      return { type: 'notionMention', raw: match[0], text: label };
    },
  },
  parseMarkdown: (token) => ({
    type: 'notionMention',
    attrs: { raw: String(token.raw).replace(LABEL_ATTR, ''), label: token.text ?? '' },
  }),
  renderMarkdown: (node) => String(node.attrs?.raw ?? ''),
});

/** Tags the editor understands itself; any other block-level tag is kept verbatim. */
const EDITABLE_TAGS = new Set(['br', 'span', 'table']); // span: NotionColor

/** Length of the balanced <tag>…</tag> (or self-closing tag) at the start of src, or 0. */
function blockTagLength(src: string): number {
  const open = src.match(/^<([a-z][a-z0-9_-]*)\b[^>]*?(\/?)>/);
  if (!open || EDITABLE_TAGS.has(open[1]) || open[1].startsWith('mention-')) return 0;
  if (open[2] === '/') return open[0].length;
  const tag = open[1];
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
  let depth = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[2] === '/') continue; // self-closing, no depth change
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return 0; // unbalanced: let Markdown handle it
}

/** Readable names for kept Notion blocks. */
function blockLabel(raw: string): string {
  const tag = raw.match(/^<([a-z][a-z0-9_-]*)/)?.[1] ?? 'block';
  const names: Record<string, string> = {
    'meeting-notes': 'AI meeting notes',
    callout: 'Callout',
    details: 'Toggle',
    page: 'Sub-page',
    database: 'Database',
    columns: 'Columns',
    file: 'File',
    pdf: 'PDF',
    video: 'Video',
    audio: 'Audio',
  };
  return names[tag] ?? `Notion ${tag.replace(/[-_]/g, ' ')}`;
}

/** A Notion-only block, shown read-only and saved exactly as it came. */
const NotionBlock = Node.create({
  name: 'notionBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ raw: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-notion-block]' }],
  renderHTML: ({ node, HTMLAttributes }) => {
    const raw = String(node.attrs.raw);
    const preview = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-notion-block': '', class: 'notion-block', contenteditable: 'false' }),
      ['div', { class: 'notion-block-label' }, `${blockLabel(raw)} · kept as-is, edit it in Notion`],
      ['div', { class: 'notion-block-preview' }, preview.length > 280 ? `${preview.slice(0, 280)}…` : preview],
    ];
  },
  markdownTokenName: 'notionBlock',
  markdownTokenizer: {
    name: 'notionBlock',
    level: 'block',
    start: (src: string) => src.search(/^<[a-z]/m),
    tokenize: (src: string) => {
      const length = blockTagLength(src);
      return length ? { type: 'notionBlock', raw: src.slice(0, length).replace(/\n+$/, '') + src.slice(length).match(/^\n*/)![0] } : undefined;
    },
  },
  parseMarkdown: (token) => ({ type: 'notionBlock', attrs: { raw: String(token.raw).replace(/\n+$/, '') } }),
  renderMarkdown: (node) => String(node.attrs?.raw ?? ''),
});

export function editorExtensions(placeholder = 'Start writing…') {
  return [
    StarterKit.configure({
      underline: false,
      hardBreak: false,
      paragraph: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    NotionParagraph,
    NotionHardBreak,
    NotionMention,
    NotionColor,
    NotionBlock,
    Image.configure({ inline: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder }),
    Markdown,
  ];
}
