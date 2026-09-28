import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { ExternalRelation, ExternalRelationInput, RelationType } from '@/hooks/useExternalRelations';

interface ExternalRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The row being edited, or null to add a new one. */
  relation: ExternalRelation | null;
  onSave: (input: ExternalRelationInput, id?: string) => Promise<void>;
}

/** "" → null, otherwise a number (the input only allows numbers). */
function toAmount(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

/** Add or edit a sponsor or partner in the Notion External Relations database. */
export function ExternalRelationDialog({ open, onOpenChange, relation, onSave }: ExternalRelationDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState<RelationType>('sponsor');
  const [name, setName] = useState('');
  const [valueProvided, setValueProvided] = useState('');
  const [bountyUsdt, setBountyUsdt] = useState('');
  const [opsMyr, setOpsMyr] = useState('');
  const [sponsorshipFormUrl, setSponsorshipFormUrl] = useState('');
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the row being edited (or blank fields) each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setType(relation?.type ?? 'sponsor');
    setName(relation?.name ?? '');
    setValueProvided(relation?.valueProvided ?? '');
    setBountyUsdt(relation?.bountyUsdt?.toString() ?? '');
    setOpsMyr(relation?.opsMyr?.toString() ?? '');
    setSponsorshipFormUrl(relation?.sponsorshipFormUrl ?? '');
    setProofOfPaymentUrl(relation?.proofOfPaymentUrl ?? '');
  }, [open, relation]);

  const handleOpenChange = (next: boolean) => {
    if (!saving) onOpenChange(next);
  };

  const canSave = name.trim() !== '' && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    // Only the selected type's fields are sent, so switching type never wipes the other's data
    const input: ExternalRelationInput =
      type === 'sponsor'
        ? {
            name: name.trim(),
            type,
            bountyUsdt: toAmount(bountyUsdt),
            opsMyr: toAmount(opsMyr),
            sponsorshipFormUrl: sponsorshipFormUrl.trim() || null,
            proofOfPaymentUrl: proofOfPaymentUrl.trim() || null,
          }
        : { name: name.trim(), type, valueProvided: valueProvided.trim() || null };
    setSaving(true);
    try {
      await onSave(input, relation?.id);
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
              {(['sponsor', 'partner'] as const).map((t) => (
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
            `${type === 'sponsor' ? 'Sponsor' : 'Partner'} name *`,
            <Input id="rel-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={{ borderRadius: 0 }} className="h-9 text-xs" required />
          )}

          {type === 'sponsor' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {field(
                  'rel-bounty',
                  'Bounty amount (USDT)',
                  <Input id="rel-bounty" type="number" min="0" step="0.01" value={bountyUsdt} onChange={(e) => setBountyUsdt(e.target.value)} style={{ borderRadius: 0 }} className="h-9 text-xs" />
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
              {field(
                'rel-proof',
                'Proof of payment (link)',
                <Input id="rel-proof" type="url" placeholder="https://…" value={proofOfPaymentUrl} onChange={(e) => setProofOfPaymentUrl(e.target.value)} style={{ borderRadius: 0 }} className="h-9 text-xs" />,
                'Add this once the sponsor has paid.'
              )}
            </>
          ) : (
            field(
              'rel-value',
              'Value provided',
              <Textarea
                id="rel-value"
                value={valueProvided}
                onChange={(e) => setValueProvided(e.target.value)}
                placeholder="e.g. $500 in AI credits for hackathon teams, venue for workshops"
                maxLength={2000}
                rows={4}
                style={{ borderRadius: 0 }}
                className="text-xs"
              />,
              'What the partner gives the society. Any form: credits, services, venue, prizes…'
            )
          )}

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
