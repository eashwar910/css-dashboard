import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type {
  AsyncResult,
  FinanceOptions,
  FinanceTotals,
  ReimbursementStatus,
  Transaction,
  TransactionInput,
} from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// useFinance
//
// Finance Tracker > Transactions from /api/finance: every transaction plus
// totals overall, per event and unlinked. Writes return the refreshed data,
// so totals always come from the server.
// ─────────────────────────────────────────────────────────────────────────────

interface FinanceData {
  transactions: Transaction[];
  totals: { overall: FinanceTotals; byEvent: Record<string, FinanceTotals>; unlinked: FinanceTotals };
  options: FinanceOptions;
}

export const ZERO_TOTALS: FinanceTotals = { income: 0, spending: 0, balance: 0, outstanding: 0, count: 0 };

const EMPTY: FinanceData = {
  transactions: [],
  totals: { overall: ZERO_TOTALS, byEvent: {}, unlinked: ZERO_TOTALS },
  options: { types: [], categories: [], paidBy: [], reimbursementStatuses: [] },
};

const store = createApiStore<FinanceData, FinanceData>('finance', (res) => res, EMPTY);

async function createTransaction(input: TransactionInput) {
  const res = await apiFetch<{ transaction: Transaction; warning: string | null; finance: FinanceData }>('finance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  store.update(() => res.finance);
  return { transaction: res.transaction, warning: res.warning };
}

async function setReimbursementStatus(id: string, reimbursementStatus: ReimbursementStatus) {
  const res = await apiFetch<{ transaction: Transaction; finance: FinanceData }>(`finance?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ reimbursementStatus }),
  });
  store.update(() => res.finance);
  return res.transaction;
}

/** Save many transactions in one request (ledger import). Rows that fail come back in `failed`. */
async function importTransactions(transactions: TransactionInput[]) {
  const res = await apiFetch<{ created: number; failed: { index: number; error: string }[]; finance: FinanceData }>(
    'finance?import=save',
    { method: 'POST', body: JSON.stringify({ transactions }) }
  );
  store.update(() => res.finance);
  return { created: res.created, failed: res.failed };
}

/** AI category/event guesses for ledger lines; empty (with a warning) when the AI is unavailable. */
async function suggestLedger(rows: string[], events: string[]) {
  return apiFetch<{ suggestions: { index: number; category: string | null; event: string | null }[]; warning: string | null }>(
    'finance?import=suggest',
    { method: 'POST', body: JSON.stringify({ rows, events }) }
  );
}

/** Move to Notion's trash. The row disappears once the server confirms. */
async function deleteTransaction(id: string) {
  const res = await apiFetch<{ finance: FinanceData }>(`finance?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  store.update(() => res.finance);
}

export interface FinanceResult extends AsyncResult<Transaction[]> {
  totals: FinanceData['totals'];
  /** Canonical Notion option values (NOTION_MAPPING.md). */
  options: FinanceOptions;
  forEvent: (eventId: string) => Transaction[];
  totalsForEvent: (eventId: string) => FinanceTotals;
  createTransaction: (input: TransactionInput) => Promise<{ transaction: Transaction; warning: string | null }>;
  setReimbursementStatus: (id: string, status: ReimbursementStatus) => Promise<Transaction>;
  importTransactions: typeof importTransactions;
  suggestLedger: typeof suggestLedger;
  /** Admins, or whoever recorded it (see Transaction.canDelete). */
  deleteTransaction: (id: string) => Promise<void>;
}

export function useFinance(): FinanceResult {
  const { value, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const forEvent = useCallback(
    (eventId: string) => value.transactions.filter((t) => t.eventId === eventId),
    [value]
  );
  const totalsForEvent = useCallback((eventId: string) => value.totals.byEvent[eventId] ?? ZERO_TOTALS, [value]);

  return {
    data: value.transactions,
    isLoading,
    error,
    totals: value.totals,
    options: value.options,
    forEvent,
    totalsForEvent,
    createTransaction,
    setReimbursementStatus,
    deleteTransaction,
    importTransactions,
    suggestLedger,
  };
}
