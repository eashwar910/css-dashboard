import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Processor } from 'unified';
import { useEffect, useState } from 'react';
import { AlertCircle, Check, ExternalLink, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useApiResource } from '@/hooks/useApiResource';
import { apiFetch } from '@/lib/api';

interface PageContentResponse {
  markdown: string;
  /** What the rich-text editor loads. */
  editorMarkdown: string;
  /** Notion's own Markdown; sent back as `base` so a save can't overwrite a newer edit. */
  source: string;
  truncated: boolean;
  canEdit: boolean;
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

/**
 * Notion indents child blocks with tabs and always fences real code with ```,
 * so an indented line must never become a code block.
 */
function remarkNoIndentedCode(this: Processor) {
  const data = this.data() as { micromarkExtensions?: unknown[] };
  (data.micromarkExtensions ??= []).push({ disable: { null: ['codeIndented'] } });
}

// Notion content is user-written: raw HTML is parsed (Notion uses a little of
// it, e.g. <br> and coloured <span>s), then sanitised to GitHub's safe subset.
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkNoIndentedCode];
const REHYPE_PLUGINS = [rehypeRaw, rehypeSanitize];

const components: Components = {
  h1: ({ children }) => <h3 className="mt-5 font-serif text-lg font-semibold text-foreground first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-5 font-serif text-base font-semibold text-foreground first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-4 text-sm font-semibold text-foreground first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children, className }) => (
    <ul className={className?.includes('contains-task-list') ? 'my-2 space-y-1 pl-1' : 'my-2 list-disc space-y-1 pl-5'}>{children}</ul>
  ),
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children, className }) => (
    <li className={className?.includes('task-list-item') ? 'flex list-none items-start gap-2' : 'leading-relaxed'}>{children}</li>
  ),
  input: ({ checked }) => <input type="checkbox" checked={checked} disabled readOnly className="mt-1 h-3.5 w-3.5 shrink-0 accent-primary" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-4 border-border" />,
  img: ({ src, alt }) => <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" className="my-3 max-h-80 max-w-full border border-border" />,
  code: ({ children }) => <code className="bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>,
  pre: ({ children }) => <pre className="my-2 max-w-full overflow-x-auto bg-muted p-3 text-xs">{children}</pre>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-muted/40 px-2.5 py-1.5 text-left font-semibold [overflow-wrap:anywhere]">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2.5 py-1.5 align-top [overflow-wrap:anywhere]">{children}</td>,
};

interface PageBodyProps {
  /** Event or meeting page id. */
  pageId: string;
  notionUrl?: string;
  /** What this page body is called, e.g. "Overview", "Notes", "Minutes". */
  noun: string;
  /** Shown when the page is empty. */
  emptyText?: string;
}

/**
 * An event's Overview or a meeting's notes/minutes: the Notion page body,
 * rendered, with a rich-text editor for members who may edit it.
 */
export function PageBody({ pageId, notionUrl, noun, emptyText }: PageBodyProps) {
  const { data: loaded, isLoading, error } = useApiResource<PageContentResponse>(`event-content?id=${encodeURIComponent(pageId)}`);
  // The last saved version replaces what was loaded, so a save shows at once
  const [saved, setSaved] = useState<PageContentResponse | null>(null);
  const data = saved ?? loaded;
  const [editing, setEditing] = useState(false);
  /** The edited document as Markdown; null until the first change. */
  const [draft, setDraft] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  // "Saved" fades after a few seconds
  useEffect(() => {
    if (save.kind !== 'saved') return;
    const timer = setTimeout(() => setSave({ kind: 'idle' }), 3000);
    return () => clearTimeout(timer);
  }, [save]);

  const stopEditing = () => {
    setEditing(false);
    setDraft(null);
  };

  const handleSave = async () => {
    if (draft === null || !data) return;
    setSave({ kind: 'saving' });
    try {
      const result = await apiFetch<PageContentResponse>(`event-content?id=${encodeURIComponent(pageId)}`, {
        method: 'PUT',
        body: JSON.stringify({ markdown: draft, base: data.source }),
      });
      setSaved(result);
      stopEditing();
      setSave({ kind: 'saved' });
    } catch (err) {
      // Keep the editor open so nothing typed is lost
      setSave({ kind: 'error', message: (err as Error).message });
    }
  };

  const notionLink = notionUrl && (
    <a
      href={notionUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
    >
      <ExternalLink className="h-3 w-3" />
      Open in Notion
    </a>
  );

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Couldn't load this page — try reopening it.
        </p>
        {notionLink}
      </div>
    );
  }

  if (editing) {
    const saving = save.kind === 'saving';
    return (
      <div className="min-w-0 space-y-3">
        <RichTextEditor
          initialMarkdown={data.editorMarkdown}
          onChange={setDraft}
          disabled={saving}
          label={noun}
          placeholder={`Write the ${noun.toLowerCase()}…`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" style={{ borderRadius: 0 }} onClick={handleSave} disabled={saving || draft === null}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : `Save ${noun.toLowerCase()}`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            style={{ borderRadius: 0 }}
            disabled={saving}
            onClick={() => {
              stopEditing();
              setSave({ kind: 'idle' });
            }}
          >
            Cancel
          </Button>
          {save.kind === 'error' && (
            <span role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Not saved: {save.message}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {data.markdown ? (
        <div className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={components}>
            {data.markdown}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">{emptyText ?? `No ${noun.toLowerCase()} yet.`}</p>
      )}
      {data.truncated && <p className="text-xs text-muted-foreground">This page is long, so only the start is shown. Edit it in Notion.</p>}
      <div className="flex flex-wrap items-center gap-4">
        {data.canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSave({ kind: 'idle' });
            }}
            className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Pencil className="h-3 w-3" />
            {data.markdown ? `Edit ${noun.toLowerCase()}` : `Write ${noun.toLowerCase()}`}
          </button>
        )}
        {notionLink}
        {save.kind === 'saved' && (
          <span role="status" className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
