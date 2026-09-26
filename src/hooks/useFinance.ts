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

export interface FinanceResult extends AsyncResult<Transaction[]> {
  totals: FinanceData['totals'];
  /** Canonical Notion option values (NOTION_MAPPING.md). */
  options: FinanceOptions;
  forEvent: (eventId: string) => Transaction[];
  totalsForEvent: (eventId: string) => FinanceTotals;
  createTransaction: (input: TransactionInput) => Promise<{ transaction: Transaction; warning: string | null }>;
  setReimbursementStatus: (id: string, status: ReimbursementStatus) => Promise<Transaction>;
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
  };
}
