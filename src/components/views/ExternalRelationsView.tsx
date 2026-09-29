import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, ExternalLink, Gift, Handshake, Mic, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatRM } from '@/lib/money';
import { useExternalRelations, type ExternalRelation } from '@/hooks/useExternalRelations';
import { ExternalRelationDialog } from '@/components/ExternalRelationDialog';

const usdt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatUsdt(amount: number | null) {
  return amount === null ? '—' : `${usdt.format(amount)} USDT`;
}

function sum(values: (number | null)[]) {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0);
}

function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </div>
  );
}

function DocLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="text-muted-foreground/60">{label}: not added</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 transition-colors hover:text-primary">
      <ExternalLink className="h-3 w-3 shrink-0" />
      {label}
    </a>
  );
}

function RowActions({ relation, onEdit, onDelete }: { relation: ExternalRelation; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <a
        href={relation.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Notion"
        aria-label={`Open ${relation.name} in Notion`}
        className="p-1 text-muted-foreground transition-colors hover:text-primary"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <button
        type="button"
        onClick={onEdit}
        title="Edit"
        aria-label={`Edit ${relation.name}`}
        className="p-1 text-muted-foreground transition-colors hover:text-primary"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Delete"
        aria-label={`Delete ${relation.name}`}
        className="p-1 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ExternalRelationsView() {
  const { sponsors, partners, speakers, uncategorised, isLoading, error, save, remove } = useExternalRelations();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalRelation | null>(null);
  const [deleting, setDeleting] = useState<ExternalRelation | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await remove(deleting.id);
      toast({ title: 'Relation deleted', description: `"${deleting.name}" was moved to Notion's trash.` });
      setDeleting(null);
    } catch (err) {
      toast({ title: "Couldn't delete", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeletePending(false);
    }
  };
  const openEdit = (relation: ExternalRelation) => {
    setEditing(relation);
    setDialogOpen(true);
  };

  const skeleton = (
    <div className="divide-y divide-border">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-2 py-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-12">
      <header className="border-b border-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">External Relations</h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Sponsors, partners and speakers, from the External Relations database in Notion.
            </p>
          </div>
          <button
            onClick={openAdd}
            style={{ borderRadius: 0 }}
            className="flex w-fit items-center gap-2 border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add relation
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load external relations — try refreshing.</span>
        </div>
      ) : (
        <>
          {/* ── Sponsors ──────────────────────────────────────────────── */}
          <section>
            <SectionHeader
              title="Sponsors"
              meta={
                isLoading
                  ? 'Loading...'
                  : `${sponsors.length} · ${formatUsdt(sum(sponsors.map((s) => s.bountyUsdt)))} bounty · ${formatRM(sum(sponsors.map((s) => s.opsMyr)))} ops`
              }
            />
            {isLoading ? (
              skeleton
            ) : sponsors.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">No sponsors yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {sponsors.map((s) => (
                  <article key={s.id} className="flex items-start gap-4 py-4">
                    <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground">{s.name}</h3>
                      <div className="mt-1.5 grid gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                        <span>
                          Bounty: <span className="text-foreground">{formatUsdt(s.bountyUsdt)}</span>
                        </span>
                        <span>
                          Ops: <span className="text-foreground">{s.opsMyr === null ? '—' : formatRM(s.opsMyr)}</span>
                        </span>
                        <DocLink href={s.sponsorshipFormUrl} label="Sponsorship form" />
                        <DocLink href={s.proofOfPaymentUrl} label="Proof of payment" />
                      </div>
                    </div>
                    <RowActions relation={s} onEdit={() => openEdit(s)} onDelete={() => setDeleting(s)} />
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ── Partners ──────────────────────────────────────────────── */}
          <section>
            <SectionHeader title="Partners" meta={isLoading ? 'Loading...' : `${partners.length}`} />
            {isLoading ? (
              skeleton
            ) : partners.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">No partners yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {partners.map((p) => (
                  <article key={p.id} className="flex items-start gap-4 py-4">
                    <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground">{p.name}</h3>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {p.valueProvided ?? 'Value provided not added yet.'}
                      </p>
                    </div>
                    <RowActions relation={p} onEdit={() => openEdit(p)} onDelete={() => setDeleting(p)} />
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ── Speakers ──────────────────────────────────────────────── */}
          <section>
            <SectionHeader title="Speakers" meta={isLoading ? 'Loading...' : `${speakers.length}`} />
            {isLoading ? (
              skeleton
            ) : speakers.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">No speakers yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {speakers.map((sp) => (
                  <article key={sp.id} className="flex items-start gap-4 py-4">
                    <Mic className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground">{sp.name}</h3>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {sp.valueProvided ?? 'Talk details not added yet.'}
                      </p>
                    </div>
                    <RowActions relation={sp} onEdit={() => openEdit(sp)} onDelete={() => setDeleting(sp)} />
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ── Rows in Notion with no Type of Relation yet ───────────── */}
          {!isLoading && uncategorised.length > 0 && (
            <section>
              <SectionHeader title="Needs a type" meta={`${uncategorised.length}`} />
              <p className="mb-2 text-xs text-muted-foreground">
                These rows have no Sponsor/Partner/Speaker type in Notion. Edit one to choose.
              </p>
              <div className="divide-y divide-border">
                {uncategorised.map((r) => (
                  <article key={r.id} className="flex items-center gap-4 py-3">
                    <span className="flex-1 text-sm">{r.name}</span>
                    <RowActions relation={r} onEdit={() => openEdit(r)} onDelete={() => setDeleting(r)} />
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ExternalRelationDialog open={dialogOpen} onOpenChange={setDialogOpen} relation={editing} onSave={save} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">Delete relation</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              &ldquo;{deleting?.name}&rdquo; will be moved to Notion&apos;s trash. It can be restored from the trash in Notion for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel style={{ borderRadius: 0 }} disabled={deletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ borderRadius: 0 }}
              disabled={deletePending}
              onClick={(e) => {
                // Keep the dialog open until Notion confirms
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
