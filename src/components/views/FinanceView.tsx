import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinance } from '@/hooks/useFinance';
import { useEvents } from '@/hooks/useEvents';
import { formatRM } from '@/lib/money';
import { AddTransactionForm, FinanceSummary, TransactionList } from '@/components/finance/FinanceParts';

// ─────────────────────────────────────────────────────────────────────────────
// Finance page: society-wide totals, outstanding reimbursements, per-event
// totals and every transaction (Notion Finance Tracker > Transactions).
// ─────────────────────────────────────────────────────────────────────────────

export function FinanceView() {
  const { data: transactions, totals, isLoading, error } = useFinance();
  const { data: events } = useEvents();

  const outstanding = useMemo(
    () => transactions.filter((t) => t.paidBy === 'Member' && t.reimbursementStatus !== 'Paid Back'),
    [transactions]
  );
  const eventRows = useMemo(
    () =>
      Object.entries(totals.byEvent)
        .map(([id, t]) => ({ id, name: events.find((e) => e.id === id)?.title ?? 'Event', totals: t }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [totals.byEvent, events]
  );

  return (
    <div className="space-y-12 sm:space-y-14">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Finance</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Every ringgit in or out, from the Notion Finance Tracker. Receipts live on each transaction&apos;s Notion page.
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn&apos;t load finance — try refreshing.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">Overall</h2>
              <span className="text-xs text-muted-foreground">{totals.overall.count} transactions</span>
            </div>
            <FinanceSummary totals={totals.overall} />
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">Outstanding reimbursements</h2>
              <span className="text-xs text-muted-foreground">{formatRM(totals.overall.outstanding)}</span>
            </div>
            <TransactionList transactions={outstanding} emptyText="Nobody is waiting to be reimbursed." showEvent />
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">By event</h2>
            </div>
            {eventRows.length === 0 && totals.unlinked.count === 0 ? (
              <p className="text-xs text-muted-foreground italic">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-border text-xs">
                <div className="hidden grid-cols-[1fr_repeat(4,6.5rem)] gap-3 py-2 text-muted-foreground sm:grid">
                  <span>Event</span>
                  <span className="text-right">Income</span>
                  <span className="text-right">Spending</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Outstanding</span>
                </div>
                {[...eventRows, ...(totals.unlinked.count ? [{ id: 'unlinked', name: 'Not linked to an event', totals: totals.unlinked }] : [])].map((row) => (
                  <div key={row.id} className="grid grid-cols-2 gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[1fr_repeat(4,6.5rem)]">
                    <span className="col-span-2 font-medium sm:col-span-1">{row.name}</span>
                    <span className="text-emerald-600 sm:text-right">{formatRM(row.totals.income)}</span>
                    <span className="text-destructive sm:text-right">{formatRM(row.totals.spending)}</span>
                    <span className="font-semibold sm:text-right">{formatRM(row.totals.balance)}</span>
                    <span className="text-amber-600 sm:text-right">{formatRM(row.totals.outstanding)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-serif text-lg font-semibold">All transactions</h2>
            </div>
            <AddTransactionForm />
            <TransactionList transactions={transactions} emptyText="No transactions yet." showEvent />
          </section>
        </>
      )}
    </div>
  );
}
