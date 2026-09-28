import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Processor } from 'unified';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/hooks/useApiResource';

interface EventContentResponse {
  markdown: string;
  truncated: boolean;
}

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

/** The event's Notion page content, rendered in place of an "Open in Notion" link. */
export function EventOverview({ eventId, notionUrl }: { eventId: string; notionUrl?: string }) {
  const { data, isLoading, error } = useApiResource<EventContentResponse>(`event-content?id=${encodeURIComponent(eventId)}`);

  const notionLink = notionUrl && (
    <a
      href={notionUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
    >
      <ExternalLink className="h-3 w-3" />
      Edit in Notion
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
          Couldn't load this event's page — try reopening it.
        </p>
        {notionLink}
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
        <p className="text-xs italic text-muted-foreground">Nothing written on this event's Notion page yet.</p>
      )}
      {data.truncated && <p className="text-xs text-muted-foreground">This page is long, so only the start is shown.</p>}
      {notionLink}
    </div>
  );
}
