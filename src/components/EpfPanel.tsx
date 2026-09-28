import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, FileCheck2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MAX_EPF_BYTES, useEpfs } from '@/hooks/useEpfs';

/** The event's EPFs (newest first) and an upload button. Events only, not meetings. */
export function EpfPanel({ eventId }: { eventId: string }) {
  const { byEvent, isLoading, uploadEpf } = useEpfs();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const epfs = byEvent[eventId] ?? [];

  const handleFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_EPF_BYTES) {
      toast({ title: 'EPF is too large', description: 'Files must be 4 MB or smaller.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      await uploadEpf(eventId, file);
      toast({ title: 'EPF uploaded', description: 'Saved to Event Proposal Forms in Notion.' });
    } catch (err) {
      toast({ title: "Couldn't upload EPF", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <FileCheck2 className="h-3.5 w-3.5" />
          Event Proposal Form
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          {uploading ? 'Uploading…' : epfs.length ? 'Upload new version' : 'Upload EPF'}
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
      </div>

      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : epfs.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No EPF uploaded yet. Up to 4 MB.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {epfs.map((epf, i) => (
            <li key={epf.id}>
              <a
                href={epf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 py-1.5 text-xs transition-colors hover:text-primary"
              >
                <span className="min-w-0 flex-1 truncate">{epf.fileName ?? epf.name}</span>
                {i === 0 && epfs.length > 1 && <span className="text-[10px] uppercase tracking-wider text-primary">Latest</span>}
                <span className="shrink-0 text-muted-foreground">{format(new Date(epf.uploadedAt), 'MMM d')}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
