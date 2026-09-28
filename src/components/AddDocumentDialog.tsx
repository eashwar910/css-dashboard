import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MAX_DOCUMENT_BYTES, type NewDocument } from '@/hooks/useDocuments';

interface AddDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: NewDocument) => Promise<void>;
  /** Existing `Document Type` values, offered as suggestions. */
  types: string[];
}

type Mode = 'file' | 'link';

/** Upload a file or save a link to the Notion Documents database. */
export function AddDocumentDialog({ open, onOpenChange, onAdd, types }: AddDocumentDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('file');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setMode('file');
    setName('');
    setType('');
    setUrl('');
    setFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const fileTooBig = file !== null && file.size > MAX_DOCUMENT_BYTES;
  const canSave = name.trim() !== '' && (mode === 'file' ? file !== null && !fileTooBig : url.trim() !== '') && !saving;

  const handleFileChange = (picked: File | null) => {
    setFile(picked);
    // Default the name to the file name (without extension) if it's still empty
    if (picked && !name.trim()) setName(picked.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const base = { name: name.trim(), type: type.trim() || undefined };
      await onAdd(mode === 'file' && file ? { ...base, file } : { ...base, url: url.trim() });
      toast({ title: 'Document added', description: 'Saved to the Documents page in Notion.' });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't add document", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ borderRadius: 0 }} className="border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add document</DialogTitle>
          <DialogDescription>
            It's saved to the Documents page in Notion and shows up in Quick Access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File / Link toggle */}
          <div className="flex w-fit items-center border border-border">
            {(
              [
                { id: 'file', label: 'Upload file', icon: Upload },
                { id: 'link', label: 'Link', icon: Link2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={mode === id}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <div className="space-y-1.5">
              <Label htmlFor="doc-file" className="text-xs">File</Label>
              <Input
                id="doc-file"
                type="file"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                style={{ borderRadius: 0 }}
                className="h-9 text-xs file:mr-3 file:text-xs"
              />
              <p className={cn('text-[11px]', fileTooBig ? 'text-destructive' : 'text-muted-foreground')}>
                {fileTooBig ? 'That file is over 4 MB. Upload it to Google Drive and add it as a link instead.' : 'Up to 4 MB.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="doc-url" className="text-xs">Link</Label>
              <Input
                id="doc-url"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ borderRadius: 0 }}
                className="h-9 text-xs"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="doc-name" className="text-xs">Name</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              style={{ borderRadius: 0 }}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-type" className="text-xs">
              Type <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="doc-type"
              list="doc-type-options"
              value={type}
              onChange={(e) => setType(e.target.value)}
              maxLength={100}
              style={{ borderRadius: 0 }}
              className="h-9 text-xs"
            />
            <datalist id="doc-type-options">
              {types.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" style={{ borderRadius: 0 }} onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={!canSave}>
              {saving ? (mode === 'file' ? 'Uploading…' : 'Saving…') : 'Add document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
