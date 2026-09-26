import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Paperclip, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFinance } from '@/hooks/useFinance';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useEvents } from '@/hooks/useEvents';
import { formatRM } from '@/lib/money';
import { parseDate } from '@/lib/eventDates';
import type { FinanceTotals, PaidBy, ReimbursementStatus, Transaction, TransactionType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Finance building blocks shared by the event dialog's Finance tab and the
// Finance page. All amounts are ringgit; data comes from useFinance().
// ─────────────────────────────────────────────────────────────────────────────

export function FinanceSummary({ totals }: { totals: FinanceTotals }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <div className="flex items-center gap-1.5 border border-emerald-500/40 px-3 py-1.5 text-emerald-600">
        <TrendingUp className="h-3 w-3" />
        <span>Income: <strong>{formatRM(totals.income)}</strong></span>
      </div>
      <div className="flex items-center gap-1.5 border border-destructive/40 px-3 py-1.5 text-destructive">
        <TrendingDown className="h-3 w-3" />
        <span>Spending: <strong>{formatRM(totals.spending)}</strong></span>
      </div>
      <div
        className={cn(
          'flex items-center gap-1.5 border px-3 py-1.5 font-semibold',
          totals.balance >= 0 ? 'border-emerald-500/40 text-emerald-600' : 'border-destructive/40 text-destructive'
        )}
      >
        Balance: {formatRM(totals.balance)}
      </div>
      <div className="flex items-center gap-1.5 border border-amber-500/40 px-3 py-1.5 text-amber-600">
        Outstanding reimbursements: <strong>{formatRM(totals.outstanding)}</strong>
      </div>
    </div>
  );
}

/** Reimbursement status control for Member-paid rows (any committee member may change it). */
function StatusSelect({ transaction }: { transaction: Transaction }) {
  const { options, setReimbursementStatus } = useFinance();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const change = async (value: string) => {
    setSaving(true);
    try {
      await setReimbursementStatus(transaction.id, value as ReimbursementStatus);
    } catch (err) {
      toast({ title: "Couldn't update status", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={transaction.reimbursementStatus ?? undefined} onValueChange={change} disabled={saving}>
      <SelectTrigger style={{ borderRadius: 0 }} className="h-7 w-[118px] text-[11px]" aria-label="Reimbursement status">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent style={{ borderRadius: 0 }}>
        {options.reimbursementStatuses.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TransactionList({
  transactions,
  emptyText,
  showEvent = false,
}: {
  transactions: Transaction[];
  emptyText: string;
  showEvent?: boolean;
}) {
  const { data: events } = useEvents();
  const eventNames = useMemo(() => new Map(events.map((e) => [e.id, e.title])), [events]);

  if (transactions.length === 0) return <p className="text-xs text-muted-foreground italic">{emptyText}</p>;

  return (
    <div className="divide-y divide-border">
      {transactions.map((t) => {
        const income = t.type === 'Income';
        const when = parseDate(t.date);
        const meta = [
          when ? format(when, 'd MMM yyyy') : null,
          t.category,
          showEvent && t.eventId ? eventNames.get(t.eventId) ?? 'Event' : null,
          t.paidBy === 'Member' ? `Paid by ${t.claimant?.name ?? 'a member'}` : null,
        ].filter(Boolean);
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
            <span className={cn('text-xs shrink-0', income ? 'text-emerald-600' : 'text-destructive')}>
              {income ? '+' : '–'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground">{t.description}</p>
              {meta.length > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.join(' · ')}</p>}
            </div>
            {t.paidBy === 'Member' && <StatusSelect transaction={t} />}
            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t.receiptCount ? 'View receipt in Notion' : 'Open in Notion (add a receipt there)'}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              {t.receiptCount ? <Paperclip className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
              {t.receiptCount ? 'Receipt' : 'Notion'}
            </a>
            <span className={cn('w-24 shrink-0 text-right text-xs font-semibold', income ? 'text-emerald-600' : 'text-destructive')}>
              {formatRM(t.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const NO_EVENT = 'none';
const NO_CATEGORY = 'none';

/**
 * Add a transaction. With `eventId` it's fixed to that event; otherwise an
 * event can be picked. Claimant (from the Team list) and reimbursement status
 * only apply when Paid By = Member.
 */
export function AddTransactionForm({ eventId }: { eventId?: string }) {
  const { options, createTransaction } = useFinance();
  const { data: members } = useTeamMembers();
  const { data: events } = useEvents();
  const { toast } = useToast();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('Expense');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState(NO_CATEGORY);
  const [paidBy, setPaidBy] = useState<PaidBy>('Society Account');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [status, setStatus] = useState<ReimbursementStatus>('Pending');
  const [pickedEvent, setPickedEvent] = useState(NO_EVENT);
  const [saving, setSaving] = useState(false);

  const claimants = members.filter((m) => m.email);
  const memberPaid = type === 'Expense' && paidBy === 'Member';
  const value = Number.parseFloat(amount);
  const valid = description.trim() !== '' && Number.isFinite(value) && value > 0;

  const reset = () => {
    setDescription('');
    setAmount('');
    setDate('');
    setCategory(NO_CATEGORY);
    setPaidBy('Society Account');
    setClaimantEmail('');
    setStatus('Pending');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { warning } = await createTransaction({
        description: description.trim(),
        type,
        amount: value,
        date: date || undefined,
        eventId: eventId ?? (pickedEvent === NO_EVENT ? null : pickedEvent),
        category: category === NO_CATEGORY ? null : category,
        paidBy: memberPaid ? 'Member' : 'Society Account',
        ...(memberPaid ? { reimbursementStatus: status, ...(claimantEmail ? { claimantEmail } : {}) } : {}),
      });
      toast({ title: 'Transaction added', description: warning ?? undefined });
      reset();
    } catch (err) {
      toast({ title: "Couldn't add transaction", description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectClass = 'h-8 text-xs';

  return (
    <form onSubmit={submit} className="space-y-2.5 border border-border bg-muted/10 p-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description..."
          style={{ borderRadius: 0 }}
          className="h-8 min-w-[140px] flex-1 text-xs"
          aria-label="Description"
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount RM"
          min="0"
          step="0.01"
          style={{ borderRadius: 0 }}
          className="h-8 w-28 text-xs"
          aria-label="Amount in ringgit"
        />
        <div className="flex border border-border text-xs">
          {(['Income', 'Expense'] as TransactionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                t === 'Expense' && 'border-l border-border',
                type === t
                  ? t === 'Income' ? 'bg-emerald-500 text-white' : 'bg-destructive text-destructive-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ borderRadius: 0 }} className={selectClass} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger style={{ borderRadius: 0 }} className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent style={{ borderRadius: 0 }}>
              <SelectItem value={NO_CATEGORY}>None</SelectItem>
              {options.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {type === 'Expense' && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Paid by</Label>
            <Select value={paidBy} onValueChange={(v) => setPaidBy(v as PaidBy)}>
              <SelectTrigger style={{ borderRadius: 0 }} className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent style={{ borderRadius: 0 }}>
                {options.paidBy.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {!eventId && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Event</Label>
            <Select value={pickedEvent} onValueChange={setPickedEvent}>
              <SelectTrigger style={{ borderRadius: 0 }} className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent style={{ borderRadius: 0 }}>
                <SelectItem value={NO_EVENT}>No event</SelectItem>
                {events.filter((ev) => ev.kind === 'event').map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {memberPaid && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Claimant (who paid)</Label>
            <Select value={claimantEmail || 'me'} onValueChange={(v) => setClaimantEmail(v === 'me' ? '' : v)}>
              <SelectTrigger style={{ borderRadius: 0 }} className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent style={{ borderRadius: 0 }}>
                <SelectItem value="me">Me</SelectItem>
                {claimants.map((m) => <SelectItem key={m.id} value={m.email!}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Reimbursement status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ReimbursementStatus)}>
              <SelectTrigger style={{ borderRadius: 0 }} className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent style={{ borderRadius: 0 }}>
                {options.reimbursementStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Receipts: add them on the Notion page after saving.</p>
        <Button type="submit" size="sm" variant="outline" style={{ borderRadius: 0 }} className="h-8 text-xs" disabled={!valid || saving}>
          <Plus className="mr-1 h-3 w-3" />
          {saving ? 'Adding…' : 'Add'}
        </Button>
      </div>
    </form>
  );
}
