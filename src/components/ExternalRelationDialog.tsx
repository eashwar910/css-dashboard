import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import type { ExternalRelation, ExternalRelationInput, RelationType } from '@/hooks/useExternalRelations';

interface ExternalRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The row being edited, or null to add a new one. */
  relation: ExternalRelation | null;
  /** Type preselected when adding. */
  defaultType?: RelationType;
  onSave: (input: ExternalRelationInput, id?: string) => Promise<void>;
}

/** "" → null, otherwise a number (the input only allows numbers). */
function toAmount(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

const TYPE_LABEL: Record<RelationType, string> = { sponsor: 'Sponsor', partner: 'Partner', speaker: 'Speaker' };

/** The relation's Notion page body, as /api/event-content returns it. */
interface NotesContent {
  editorMarkdown: string;
  /** Sent back as `base` so a save can't overwrite a newer edit made in Notion. */
  source: string;
  truncated: boolean;
}

type NotesState = { kind: 'loading' } | { kind: 'ready'; content: NotesContent | null } | { kind: 'error' };

/** Add or edit a sponsor, partner or speaker in the Notion External Relations database. */
export function ExternalRelationDialog({ open, onOpenChange, relation, defaultType = 'sponsor', onSave }: ExternalRelationDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState<RelationType>('sponsor');
  const [name, setName] = useState('');
  const [valueProvided, setValueProvided] = useState('');
  const [bountyMyr, setBountyMyr] = useState('');
  const [opsMyr, setOpsMyr] = useState('');
  const [sponsorshipFormUrl, setSponsorshipFormUrl] = useState('');
  const [notes, setNotes] = useState<NotesState>({ kind: 'ready', content: null });
  /** The edited notes as Markdown; null until the first change. */
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load the row being edited (or blank fields) each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setType(relation?.type ?? defaultType);
    setName(relation?.name ?? '');
    setValueProvided(relation?.valueProvided ?? '');
    setBountyMyr(relation?.bountyMyr?.toString() ?? '');
    setOpsMyr(relation?.opsMyr?.toString() ?? '');
    setSponsorshipFormUrl(relation?.sponsorshipFormUrl ?? '');
    setNotesDraft(null);
    if (!relation) {
      setNotes({ kind: 'ready', content: null });
      return;
    }
    // Editing: load the notes (the Notion page body)
    let cancelled = false;
    setNotes({ kind: 'loading' });
    apiFetch<NotesContent>(`event-content?id=${encodeURIComponent(relation.id)}`)
      .then((content) => !cancelled && setNotes({ kind: 'ready', content }))
      .catch(() => !cancelled && setNotes({ kind: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [open, relation, defaultType]);

  const handleOpenChange = (next: boolean) => {
    if (!saving) onOpenChange(next);
  };

  const canSave = name.trim() !== '' && !saving && notes.kind !== 'loading';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    // Only the selected type's fields are sent, so switching type never wipes the other's data
    const input: ExternalRelationInput =
      type === 'sponsor'
        ? {
            name: name.trim(),
            type,
            bountyMyr: toAmount(bountyMyr),
            opsMyr: toAmount(opsMyr),
            sponsorshipFormUrl: sponsorshipFormUrl.trim() || null,
          }
        : { name: name.trim(), type, valueProvided: valueProvided.trim() || null };
    // New rows get their notes with the row; existing rows save them to the page body below
    if (!relation && notesDraft?.trim()) input.notes = notesDraft;
    setSaving(true);
    try {
      await onSave(input, relation?.id);
      if (relation && notesDraft !== null && notes.kind === 'ready' && notes.content) {
        await apiFetch(`event-content?id=${encodeURIComponent(relation.id)}`, {
          method: 'PUT',
          body: JSON.stringify({ markdown: notesDraft, base: notes.content.source }),
        });
      }
      toast({ title: relation ? 'Relation updated' : 'Relation added', description: 'Saved to External Relations in Notion.' });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't save", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {input}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ borderRadius: 0 }} className="max-h-[90vh] max-w-lg overflow-y-auto border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{relation ? 'Edit relation' : 'Add relation'}</DialogTitle>
          <DialogDescription className="text-xs">Saved to the External Relations database in Notion.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sponsor / Partner */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Type</p>
            <div className="flex w-fit items-center border border-border">
              {(['sponsor', 'partner', 'speaker'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'px-4 py-1.5 text-xs font-medium capitalize transition-colors',
                    type === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={type === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {field(
            'rel-name',
            `${TYPE_LABEL[type]} name *`,
            <Input id="rel-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={{ borderRadius: 0 }} className="h-9 text-xs" required />
          )}

          {type === 'sponsor' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {field(
                  'rel-bounty',
                  'Bounty amount (MYR)',
                  <Input id="rel-bounty" type="number" min="0" step="0.01" value={bountyMyr} onChange={(e) => setBountyMyr(e.target.value)} style={{ borderRadius: 0 }} className="h-9 text-xs" />
                )}
                {field(
                  'rel-ops',
                  'Ops amount (MYR)',
                  <Input id="rel-ops" type="number" min="0" step="0.01" value={opsMyr} onChange={(e) => setOpsMyr(e.target.value)} style={{ borderRadius: 0 }} className="h-9 text-xs" />
                )}
              </div>
              {field(
                'rel-form',
                'Sponsorship form (link)',
                <Input id="rel-form" type="url" placeholder="https://…" value={sponsorshipFormUrl} onChange={(e) => setSponsorshipFormUrl(e.target.value)} style={{ borderRadius: 0 }} className="h-9 text-xs" />
              )}
            </>
          ) : (
            field(
              'rel-value',
              type === 'speaker' ? 'Talk details' : 'Value provided',
              <Textarea
                id="rel-value"
                value={valueProvided}
                onChange={(e) => setValueProvided(e.target.value)}
                placeholder={
                  type === 'speaker'
                    ? 'e.g. Talk on LLM agents at Tech Week; engineer at Grab; contact via LinkedIn'
                    : 'e.g. $500 in AI credits for hackathon teams, venue for workshops'
                }
                maxLength={2000}
                rows={4}
                style={{ borderRadius: 0 }}
                className="text-xs"
              />,
              type === 'speaker'
                ? 'Topic, event, organisation, contact: whatever the team needs to know.'
                : 'What the partner gives the society. Any form: credits, services, venue, prizes…'
            )
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Notes</p>
            {notes.kind === 'loading' ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ) : notes.kind === 'error' ? (
              <p className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Couldn't load the notes. Edit them in Notion, or reopen this to try again.
              </p>
            ) : notes.content?.truncated ? (
              <p className="text-xs text-muted-foreground">These notes are too long to edit here. Edit them in Notion.</p>
            ) : (
              <RichTextEditor
                // Remount when the loaded notes change, so the editor starts from them
                key={relation?.id ?? 'new'}
                initialMarkdown={notes.content?.editorMarkdown ?? ''}
                onChange={setNotesDraft}
                disabled={saving}
                label="Notes"
                placeholder="Payment status, contacts, what was agreed…"
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" style={{ borderRadius: 0 }} onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" style={{ borderRadius: 0 }} disabled={!canSave}>
              {saving ? 'Saving…' : relation ? 'Save changes' : 'Add relation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
