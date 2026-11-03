import { useRef, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFinance } from '@/hooks/useFinance';
import { useEvents } from '@/hooks/useEvents';
import { formatRM } from '@/lib/money';
import { keywordCategory, matchEvent, parseLedger, type LedgerRow } from '@/lib/ledgerImport';
import type { Transaction } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// "Import ledger": pick the university ledger .xlsx, check every row in a
// preview, then save the ticked ones (Paid By = Society Account). Category and
// event come from the sheet or keyword rules first; the AI only fills gaps,
// and those cells are marked so they get a second look.
// ─────────────────────────────────────────────────────────────────────────────

const NO_EVENT = '__none__';

interface Draft {
  row: LedgerRow;
  include: boolean;
  date: string;
  category: string;
  eventId: string;
  /** Problem from the sheet, or a duplicate warning. */
  note: string | null;
  aiCategory: boolean;
  aiEvent: boolean;
}

const descriptionOf = (row: LedgerRow) => (row.reference ? `${row.description} (${row.reference})` : row.description);

/** Already in the tracker: same reference, or same date, type, amount and description. */
function duplicateOf(row: LedgerRow, existing: Transaction[]): string | null {
  const same = existing.find((t) =>
    row.reference
      ? t.description.includes(row.reference)
      : t.date === row.date && t.type === row.type && t.amount === row.amount && t.description.trim().toLowerCase() === row.description.toLowerCase()
  );
  return same ? 'Already imported' : null;
}

export function ImportLedger() {
  const { data: transactions, options, importTransactions, suggestLedger } = useFinance();
  const { data: events } = useEvents();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null);

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((list) => list && list.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const open = async (file: File) => {
    setBusy('reading');
    setFileName(file.name);
    try {
      const { readSheet } = await import('read-excel-file/browser');
      const rows = parseLedger((await readSheet(file)) as Parameters<typeof parseLedger>[0]);
      if (rows.length === 0) throw new Error('No income or expense rows were found in the first sheet.');

      const list: Draft[] = rows.map((row) => {
        const event = matchEvent(row.eventName, events);
        const note = row.problem ?? duplicateOf(row, transactions);
        return {
          row,
          include: note === null,
          date: row.date ?? '',
          category: keywordCategory(row.description) ?? '',
          eventId: event?.id ?? NO_EVENT,
          note,
          aiCategory: false,
          aiEvent: false,
        };
      });

      // Ask the AI only about rows with no category, or an event name that didn't match.
      const ask = list
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => !d.category || (d.row.eventName && d.eventId === NO_EVENT));
      if (ask.length > 0) {
        const { suggestions, warning } = await suggestLedger(
          ask.map(({ d }) => [d.row.type, d.row.description, d.row.eventName && `event: ${d.row.eventName}`].filter(Boolean).join(' | ')),
          events.map((e) => e.title)
        ).catch(() => ({ suggestions: [], warning: 'AI suggestions unavailable right now.' }));
        for (const s of suggestions) {
          const d = list[ask[s.index].i];
          if (!d.category && s.category) Object.assign(d, { category: s.category, aiCategory: true });
          const event = s.event ? events.find((e) => e.title === s.event) : undefined;
          if (d.eventId === NO_EVENT && event && d.row.eventName) Object.assign(d, { eventId: event.id, aiEvent: true });
        }
        if (warning) toast({ title: 'Categories need a manual pick', description: `${warning} Unfilled ones will be saved as Other.` });
      }
      setDrafts(list.map((d) => ({ ...d, category: d.category || 'Other' })));
    } catch (err) {
      toast({ title: "Couldn't read that ledger", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const ready = (d: Draft) => d.include && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.row.type !== null && (d.row.amount ?? 0) > 0;
  const picked = drafts?.filter(ready) ?? [];

  const save = async () => {
    setBusy('saving');
    try {
      const { created, failed } = await importTransactions(
        picked.map((d) => ({
          description: descriptionOf(d.row),
          type: d.row.type!,
          amount: d.row.amount!,
          date: d.date,
          category: d.category,
          eventId: d.eventId === NO_EVENT ? null : d.eventId,
          paidBy: 'Society Account',
        }))
      );
      if (failed.length === 0) {
        toast({ title: `Imported ${created} transaction${created === 1 ? '' : 's'}` });
        setDrafts(null);
      } else {
        // Keep only the rows that failed, with the reason, so they can be fixed and retried.
        const failedDrafts = failed.map((f) => ({ ...picked[f.index], note: f.error }));
        setDrafts(failedDrafts);
        toast({ title: `Imported ${created}, ${failed.length} failed`, description: 'The failed rows are still listed.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: "Couldn't import", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const small = 'h-8 text-xs';

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && open(e.target.files[0])}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        style={{ borderRadius: 0 }}
        className="h-8 text-xs"
        disabled={busy !== null}
        onClick={() => fileInput.current?.click()}
      >
        <FileUp className="mr-1 h-3.5 w-3.5" />
        {busy === 'reading' ? 'Reading ledger…' : 'Import ledger (.xlsx)'}
      </Button>

      <Dialog open={drafts !== null} onOpenChange={(o) => !o && busy !== 'saving' && setDrafts(null)}>
        <DialogContent style={{ borderRadius: 0 }} className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Import {fileName}</DialogTitle>
            <DialogDescription className="text-xs">
              Check each row, then import the ticked ones as Society Account transactions.
              <Sparkles className="mx-1 inline h-3 w-3 text-violet-500" />marks an AI guess worth a second look.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y divide-border text-xs">
            {drafts?.map((d, i) => (
              <div key={d.row.sheetRow} className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 py-2.5', !ready(d) && 'opacity-70')}>
                <Checkbox
                  className="mt-1"
                  checked={d.include}
                  disabled={d.row.type === null}
                  onCheckedChange={(v) => update(i, { include: v === true })}
                  aria-label={`Import row ${d.row.sheetRow}`}
                />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {descriptionOf(d.row)}
                      <span className="ml-2 font-normal text-muted-foreground">row {d.row.sheetRow}</span>
                    </span>
                    <span className={d.row.type === 'Income' ? 'text-emerald-600' : 'text-destructive'}>
                      {d.row.type ?? '?'} {d.row.amount !== null && formatRM(d.row.amount)}
                    </span>
                  </div>
                  {d.note && <p className="text-amber-600">{d.note}</p>}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input
                      type="date"
                      value={d.date}
                      onChange={(e) => update(i, { date: e.target.value })}
                      style={{ borderRadius: 0 }}
                      className={small}
                      aria-label="Date"
                    />
                    <Select value={d.category} onValueChange={(v) => update(i, { category: v, aiCategory: false })}>
                      <SelectTrigger style={{ borderRadius: 0 }} className={cn(small, d.aiCategory && 'border-violet-500/60')} aria-label="Category">
                        <span className="flex items-center gap-1">
                          {d.aiCategory && <Sparkles className="h-3 w-3 text-violet-500" />}
                          <SelectValue />
                        </span>
                      </SelectTrigger>
                      <SelectContent style={{ borderRadius: 0 }}>
                        {options.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={d.eventId} onValueChange={(v) => update(i, { eventId: v, aiEvent: false })}>
                      <SelectTrigger style={{ borderRadius: 0 }} className={cn(small, d.aiEvent && 'border-violet-500/60')} aria-label="Event">
                        <span className="flex items-center gap-1 truncate">
                          {d.aiEvent && <Sparkles className="h-3 w-3 shrink-0 text-violet-500" />}
                          <SelectValue />
                        </span>
                      </SelectTrigger>
                      <SelectContent style={{ borderRadius: 0 }}>
                        <SelectItem value={NO_EVENT}>{d.row.eventName ? `No match for "${d.row.eventName}"` : 'No event'}</SelectItem>
                        {events.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {picked.length} of {drafts?.length ?? 0} rows will be imported
            </span>
            <Button
              type="button"
              size="sm"
              style={{ borderRadius: 0 }}
              className="h-8 text-xs"
              disabled={picked.length === 0 || busy !== null}
              onClick={save}
            >
              {busy === 'saving' ? 'Importing…' : `Import ${picked.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
