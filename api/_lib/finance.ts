// Finance Tracker > Transactions: read with totals, create, change reimbursement status.
// Rules: docs/PLAN.md "Finance". Property names and options are the canonical
// ones from NOTION_MAPPING.md ("Paid By", "Reimbursement Status", "Recorded by").

import type { PageObjectResponse } from '@notionhq/client';
import type { CommitteeMember } from './auth.js';
import { HttpError, normalisePageId } from './http.js';
import { cached, cacheInvalidate, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { date, files, number, people, relationIds, select, title, write } from './props.js';
import { getNotionUserIdForMemberEmail, notionUserIdFor } from './users.js';

export const FINANCE_OPTIONS = {
  types: ['Income', 'Expense'],
  categories: ['Other', 'Prizes', 'Merch', 'Printing', 'Food', 'Membership', 'Ticket Sales', 'Sponsorship'],
  paidBy: ['Society Account', 'Member'],
  reimbursementStatuses: ['Pending', 'Approved', 'Paid Back'],
} as const;

type TxType = (typeof FINANCE_OPTIONS.types)[number];
type PaidBy = (typeof FINANCE_OPTIONS.paidBy)[number];
type ReimbursementStatus = (typeof FINANCE_OPTIONS.reimbursementStatuses)[number];

export interface TransactionDto {
  id: string;
  description: string;
  type: TxType | null;
  amount: number | null;
  /** ISO date from `Date`. */
  date: string | null;
  /** First linked Team Dashboard > Events page, or null. */
  eventId: string | null;
  category: string | null;
  paidBy: PaidBy | null;
  claimant: { id: string; name: string | null } | null;
  reimbursementStatus: ReimbursementStatus | null;
  recordedBy: string | null;
  /** Receipts are viewed on the Notion page (file URLs expire). */
  receiptCount: number;
  url: string;
}

export interface FinanceTotals {
  income: number;
  spending: number;
  /** income − spending */
  balance: number;
  /** Paid By = Member and Reimbursement Status ≠ Paid Back. */
  outstanding: number;
  count: number;
}

export interface FinanceData {
  transactions: TransactionDto[];
  totals: {
    overall: FinanceTotals;
    /** Keyed by event page id. */
    byEvent: Record<string, FinanceTotals>;
    /** Transactions not linked to an event. */
    unlinked: FinanceTotals;
  };
  options: typeof FINANCE_OPTIONS;
}

const oneOf = <T extends string>(options: readonly T[], value: string | null): T | null =>
  value !== null && (options as readonly string[]).includes(value) ? (value as T) : null;

export function toTransaction(page: PageObjectResponse): TransactionDto {
  const claimant = people(page, 'Claimant')[0];
  return {
    id: page.id,
    description: title(page, 'Description') ?? 'Untitled transaction',
    type: oneOf(FINANCE_OPTIONS.types, select(page, 'Type')),
    amount: number(page, 'Amount'),
    date: date(page, 'Date')?.start ?? null,
    eventId: relationIds(page, 'Event')[0] ?? null,
    category: select(page, 'Category'),
    paidBy: oneOf(FINANCE_OPTIONS.paidBy, select(page, 'Paid By')),
    claimant: claimant ? { id: claimant.id, name: claimant.name } : null,
    reimbursementStatus: oneOf(FINANCE_OPTIONS.reimbursementStatuses, select(page, 'Reimbursement Status')),
    recordedBy: people(page, 'Recorded by')[0]?.name ?? null,
    receiptCount: files(page, 'Receipt').length,
    url: page.url,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(transactions: TransactionDto[]): FinanceTotals {
  let income = 0;
  let spending = 0;
  let outstanding = 0;
  for (const t of transactions) {
    const amount = t.amount ?? 0;
    if (t.type === 'Income') income += amount;
    if (t.type === 'Expense') spending += amount;
    if (t.paidBy === 'Member' && t.reimbursementStatus !== 'Paid Back') outstanding += amount;
  }
  return {
    income: round2(income),
    spending: round2(spending),
    balance: round2(income - spending),
    outstanding: round2(outstanding),
    count: transactions.length,
  };
}

export async function loadFinance(): Promise<FinanceData> {
  const pages = await cached('transactions:pages', () =>
    queryAll(dataSourceId('transactions'), { sorts: [{ property: 'Date', direction: 'descending' }] }),
  );
  const transactions = pages.map(toTransaction);
  const grouped = new Map<string, TransactionDto[]>();
  for (const t of transactions) {
    if (t.eventId) grouped.set(t.eventId, [...(grouped.get(t.eventId) ?? []), t]);
  }
  return {
    transactions,
    totals: {
      overall: computeTotals(transactions),
      byEvent: Object.fromEntries([...grouped].map(([id, list]) => [id, computeTotals(list)])),
      unlinked: computeTotals(transactions.filter((t) => !t.eventId)),
    },
    options: FINANCE_OPTIONS,
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────

function requireOption<T extends string>(options: readonly T[], value: unknown, field: string): T {
  if (typeof value === 'string' && (options as readonly string[]).includes(value)) return value as T;
  throw new HttpError(400, `${field} must be one of: ${options.join(', ')}`);
}

/** Today's date in Asia/Kuala_Lumpur (UTC+8, no daylight saving), YYYY-MM-DD. */
function klToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface TransactionInput {
  description?: unknown;
  type?: unknown;
  amount?: unknown;
  date?: unknown;
  eventId?: unknown;
  category?: unknown;
  paidBy?: unknown;
  /** Login email of the committee member being reimbursed (from the Team list). */
  claimantEmail?: unknown;
  reimbursementStatus?: unknown;
}

/**
 * Create a transaction. Recorded by = the creator. Claimant and Reimbursement
 * Status are only allowed when Paid By = Member; a Member-paid expense
 * defaults to Pending, and to the creator as Claimant if none is chosen.
 */
export async function createTransaction(
  member: CommitteeMember,
  input: TransactionInput,
): Promise<{ transaction: TransactionDto; warning: string | null }> {
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) throw new HttpError(400, 'Description is required');
  if (description.length > 2000) throw new HttpError(400, 'Description must be 2000 characters or fewer');

  const type = requireOption(FINANCE_OPTIONS.types, input.type, 'Type');
  const amount = typeof input.amount === 'number' ? input.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Amount must be a number greater than 0');

  let txDate = klToday();
  if (input.date !== undefined && input.date !== null && input.date !== '') {
    if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) {
      throw new HttpError(400, 'Date must be YYYY-MM-DD');
    }
    txDate = input.date;
  }

  let eventId: string | null = null;
  if (input.eventId !== undefined && input.eventId !== null && input.eventId !== '') {
    eventId = normalisePageId(input.eventId);
    if (!eventId || !(await retrievePageIn('events', eventId))) throw new HttpError(400, 'Event not found');
  }

  const category =
    input.category === undefined || input.category === null || input.category === ''
      ? null
      : requireOption(FINANCE_OPTIONS.categories, input.category, 'Category');
  const paidBy: PaidBy =
    input.paidBy === undefined || input.paidBy === null || input.paidBy === ''
      ? 'Society Account'
      : requireOption(FINANCE_OPTIONS.paidBy, input.paidBy, 'Paid By');

  const hasClaimant = input.claimantEmail !== undefined && input.claimantEmail !== null && input.claimantEmail !== '';
  const hasStatus = input.reimbursementStatus !== undefined && input.reimbursementStatus !== null && input.reimbursementStatus !== '';
  if (paidBy !== 'Member' && (hasClaimant || hasStatus)) {
    throw new HttpError(400, 'Claimant and Reimbursement Status are only allowed when Paid By is Member');
  }
  if (paidBy === 'Member' && type !== 'Expense') {
    throw new HttpError(400, 'Paid By Member is only for expenses (a member paying and being reimbursed)');
  }

  const creatorId = await notionUserIdFor(member);
  let claimantId: string | null = null;
  let status: ReimbursementStatus | null = null;
  if (paidBy === 'Member') {
    status = hasStatus ? requireOption(FINANCE_OPTIONS.reimbursementStatuses, input.reimbursementStatus, 'Reimbursement Status') : 'Pending';
    if (hasClaimant) {
      if (typeof input.claimantEmail !== 'string') throw new HttpError(400, 'claimantEmail must be an email');
      claimantId = await getNotionUserIdForMemberEmail(input.claimantEmail);
      if (!claimantId) throw new HttpError(400, "That member doesn't have a Notion account, so they can't be the Claimant");
    } else {
      claimantId = creatorId;
      if (!claimantId) throw new HttpError(400, 'Choose a Claimant (your email has no Notion account)');
    }
  }

  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('transactions') },
    properties: {
      Description: write.title(description),
      Type: write.select(type),
      Amount: write.number(round2(amount)),
      Date: write.date(txDate),
      Event: write.relation(eventId ? [eventId] : []),
      Category: write.select(category),
      'Paid By': write.select(paidBy),
      Claimant: write.people(claimantId ? [claimantId] : []),
      'Reimbursement Status': write.select(status),
      'Recorded by': write.people(creatorId ? [creatorId] : []),
    },
  });
  cacheInvalidate('transactions:');

  const fresh = await retrievePageIn('transactions', page.id);
  if (!fresh) throw new HttpError(500, 'Transaction was created but could not be read back');
  return {
    transaction: toTransaction(fresh),
    warning: creatorId ? null : "Your email doesn't match a Notion account, so 'Recorded by' was left empty.",
  };
}

/** Change Reimbursement Status on a Member-paid transaction. Any committee member may do this. */
export async function setReimbursementStatus(transactionId: string, value: unknown): Promise<TransactionDto> {
  const status = requireOption(FINANCE_OPTIONS.reimbursementStatuses, value, 'Reimbursement Status');
  const page = await retrievePageIn('transactions', transactionId);
  if (!page) throw new HttpError(404, 'Transaction not found');
  if (select(page, 'Paid By') !== 'Member') {
    throw new HttpError(400, 'Only transactions paid by a member have a reimbursement status');
  }
  await notion().pages.update({ page_id: transactionId, properties: { 'Reimbursement Status': write.select(status) } });
  cacheInvalidate('transactions:');
  const fresh = await retrievePageIn('transactions', transactionId);
  if (!fresh) throw new HttpError(404, 'Transaction not found after update');
  return toTransaction(fresh);
}
