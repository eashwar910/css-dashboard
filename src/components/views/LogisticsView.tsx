import { useId, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
import { AlertCircle, Check, ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLogistics, type InventoryInput, type InventoryItem } from '@/hooks/useLogistics';

const COLUMNS: { key: keyof InventoryInput; label: string; list?: string }[] = [
  { key: 'item', label: 'Item' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'qtyNeeded', label: 'Qty Needed' },
  { key: 'location', label: 'Location', list: 'logistics-locations' },
  { key: 'event', label: 'Event', list: 'logistics-events' },
];

const EMPTY: InventoryInput = { item: '', quantity: null, qtyNeeded: null, location: null, event: null };

const iconButton = 'p-1 text-muted-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40';

/** A row of inputs, for adding an item or editing one in place. */
function EditRow({
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial: InventoryInput;
  onSave: (input: InventoryInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const formId = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.item.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      if (!onCancel) setDraft(EMPTY);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-muted/20">
      {COLUMNS.map((c, i) => (
        <td key={c.key} className="px-2 py-1.5">
          <Input
            value={draft[c.key] ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
            list={c.list}
            placeholder={i === 0 ? 'New item…' : c.label}
            aria-label={c.label}
            maxLength={200}
            disabled={saving}
            autoFocus={i === 0 && !!onCancel}
            form={formId}
            style={{ borderRadius: 0 }}
            className="h-8 min-w-[6rem] text-xs"
          />
        </td>
      ))}
      <td className="px-2 py-1.5">
        <form id={formId} onSubmit={submit} className="flex items-center justify-end gap-1">
          <button type="submit" title={submitLabel} aria-label={submitLabel} disabled={saving || !draft.item.trim()} className={iconButton}>
            {onCancel ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
          {onCancel && (
            <button type="button" title="Cancel" aria-label="Cancel" disabled={saving} onClick={onCancel} className={iconButton}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      </td>
    </tr>
  );
}

/** Team Dashboard > Logistics in Notion: the Inventory table, editable in place. */
export function LogisticsView() {
  const { items, isLoading, error, save, remove } = useLogistics();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  // Existing select options, suggested while typing (a new name adds an option in Notion)
  const options = (key: 'location' | 'event') => [...new Set(items.map((i) => i[key]).filter((v): v is string => !!v))].sort();

  const saveOrToast = async (input: InventoryInput, id?: string) => {
    try {
      await save(input, id);
      setEditingId(null);
    } catch (err) {
      toast({ title: "Couldn't save item", description: (err as Error).message, variant: 'destructive' });
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await remove(deleting.id);
      toast({ title: 'Item deleted', description: `"${deleting.item}" was moved to Notion's trash.` });
      setDeleting(null);
    } catch (err) {
      toast({ title: "Couldn't delete", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Logistics</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          What the society has, how much each event needs, and who's holding it. From the Logistics inventory in Notion.
        </p>
      </header>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn't load the inventory — try refreshing.</span>
        </div>
      ) : (
        <section>
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-serif text-lg font-semibold">Inventory</h2>
            <span className="text-xs text-muted-foreground">{isLoading ? 'Loading...' : `${items.length} items`}</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="px-2 py-2 font-semibold">
                        {c.label}
                      </th>
                    ))}
                    <th className="w-24 px-2 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) =>
                    editingId === item.id ? (
                      <EditRow
                        key={item.id}
                        initial={item}
                        submitLabel="Save"
                        onSave={(input) => saveOrToast(input, item.id)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <tr key={item.id} className="group">
                        {COLUMNS.map((c) => (
                          <td key={c.key} className={c.key === 'item' ? 'px-2 py-2.5 font-medium' : 'px-2 py-2.5 text-muted-foreground'}>
                            {item[c.key] || <span className="text-muted-foreground/50">—</span>}
                          </td>
                        ))}
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" title="Open in Notion" aria-label={`Open ${item.item} in Notion`} className={iconButton}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button type="button" title="Edit" aria-label={`Edit ${item.item}`} onClick={() => setEditingId(item.id)} className={iconButton}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              aria-label={`Delete ${item.item}`}
                              onClick={() => setDeleting(item)}
                              className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                  <EditRow initial={EMPTY} submitLabel="Add item" onSave={(input) => saveOrToast(input)} />
                </tbody>
              </table>
              <datalist id="logistics-locations">
                {options('location').map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
              <datalist id="logistics-events">
                {options('event').map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
          )}
        </section>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <AlertDialogContent style={{ borderRadius: 0 }} className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">Delete item</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              &ldquo;{deleting?.item}&rdquo; will be moved to Notion&apos;s trash. It can be restored from the trash in Notion for 30 days.
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
