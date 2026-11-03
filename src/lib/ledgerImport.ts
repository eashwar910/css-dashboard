// ─────────────────────────────────────────────────────────────────────────────
// Ledger .xlsx → transactions to import (Finance page, "Import ledger").
//
// Built for the university's "Computer Science Society (6094) Ledger" sheet:
// a title row ("... Ending 30/09/2025"), a header row (Date, Details, Income,
// Expenses, OR No, CS-PV No, Event, Balance — found by name, any order), then
// one row per entry. Rules:
//   - A row with no Income and no Expenses (blank, "Balance b/fwd", "Balance as
//     per ...") is skipped.
//   - A row is ready only with a date and exactly one of Income / Expenses.
//     Anything else is listed but left unticked with the reason.
//   - Dates without a year ("17-Sep") take it from the title's ending date.
//   - Where Balance is filled in, it must equal the previous balance + income
//     − expenses; a row that doesn't add up is flagged.
// ─────────────────────────────────────────────────────────────────────────────

import { sameName } from './memberOrder';

type Cell = string | number | boolean | Date | null;

export interface LedgerRow {
  /** 1-based sheet row, for messages. */
  sheetRow: number;
  date: string | null;
  description: string;
  type: 'Income' | 'Expense' | null;
  amount: number | null;
  /** CS-PV No or OR No, if any. */
  reference: string | null;
  /** Event name as written in the sheet. */
  eventName: string | null;
  /** Why the row can't be imported as-is; null when it's ready. */
  problem: string | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const COLUMNS = {
  date: /^date$/,
  details: /^(details|description|particulars)$/,
  income: /^income/,
  expense: /^expense/,
  or: /^or\s*no/,
  pv: /pv\s*no/,
  event: /^event/,
  balance: /^balance/,
} as const;
type Column = keyof typeof COLUMNS;

const text = (c: Cell) => (c === null || c === undefined ? '' : c instanceof Date ? '' : String(c).trim());
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function money(c: Cell): number | null {
  if (typeof c === 'number') return Number.isFinite(c) && c !== 0 ? Math.round(c * 100) / 100 : null;
  const s = text(c).replace(/rm|,|\s/gi, '');
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) && n !== 0 ? Math.round(n * 100) / 100 : null;
}

/** The title's "Ending dd/mm/yyyy", used for dates written without a year. */
function endingDate(rows: Cell[][]): { year: number; month: number } | null {
  for (const row of rows.slice(0, 10)) {
    for (const c of row) {
      const m = /ending\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/i.exec(text(c));
      if (m) return { year: Number(m[3]), month: Number(m[2]) };
    }
  }
  return null;
}

function parseDate(c: Cell, ending: { year: number; month: number } | null): string | null {
  // Excel dates arrive as Date at UTC midnight.
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10);
  const s = text(c);
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(y, Number(m[2]), Number(m[1]));
  }
  m = /^(\d{1,2})[\s-]([a-z]{3})[a-z]*(?:[\s-](\d{2,4}))?$/i.exec(s);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (!month) return null;
  let year = m[3] ? (Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])) : ending?.year;
  if (!year) return null;
  // "17-Dec" in a ledger ending 31/01/2026 is December 2025.
  if (!m[3] && ending && month > ending.month) year -= 1;
  return iso(year, month, Number(m[1]));
}

/** Parse the sheet. Throws if the header row can't be found. */
export function parseLedger(rows: Cell[][]): LedgerRow[] {
  const headerIndex = rows.findIndex((row) => {
    const labels = row.map((c) => text(c).toLowerCase());
    return labels.some((l) => COLUMNS.details.test(l)) && labels.some((l) => COLUMNS.income.test(l) || COLUMNS.expense.test(l));
  });
  if (headerIndex === -1) throw new Error('No header row with "Details" and "Income"/"Expenses" columns was found.');

  const col: Partial<Record<Column, number>> = {};
  rows[headerIndex].forEach((c, i) => {
    const label = text(c).toLowerCase();
    for (const key of Object.keys(COLUMNS) as Column[]) {
      if (col[key] === undefined && COLUMNS[key].test(label)) col[key] = i;
    }
  });
  const at = (row: Cell[], key: Column): Cell => (col[key] === undefined ? null : row[col[key]!] ?? null);
  const ending = endingDate(rows);

  const out: LedgerRow[] = [];
  let balance: number | null = null;
  rows.slice(headerIndex + 1).forEach((row, i) => {
    const sheetRow = headerIndex + 2 + i;
    const income = money(at(row, 'income'));
    const expense = money(at(row, 'expense'));
    const rowBalance = money(at(row, 'balance'));
    const description = text(at(row, 'details'));

    if (income === null && expense === null) {
      // Opening balance ("Balance b/fwd") seeds the running check.
      if (rowBalance !== null && /b\/?\s*f(w)?d|brought forward/i.test(description)) balance = rowBalance;
      return;
    }

    const date = parseDate(at(row, 'date'), ending);
    let problem: string | null = null;
    if (income !== null && expense !== null) problem = 'Both Income and Expenses are filled in';
    else if (!date) problem = text(at(row, 'date')) ? `Can't read the date "${text(at(row, 'date'))}"` : 'No date';
    else if (!description) problem = 'No details';

    if (balance !== null && rowBalance !== null) {
      const expected = Math.round((balance + (income ?? 0) - (expense ?? 0)) * 100) / 100;
      if (Math.abs(expected - rowBalance) > 0.005) problem ??= `Balance should be ${expected.toFixed(2)}, sheet says ${rowBalance.toFixed(2)}`;
    }
    if (rowBalance !== null) balance = rowBalance;

    out.push({
      sheetRow,
      date,
      description: description || '(no details)',
      type: income !== null && expense === null ? 'Income' : expense !== null && income === null ? 'Expense' : null,
      amount: income ?? expense,
      reference: text(at(row, 'pv')) || text(at(row, 'or')) || null,
      eventName: text(at(row, 'event')) || null,
      problem,
    });
  });
  return out;
}

const KEYWORDS: [string, RegExp][] = [
  ['Merch', /\b(t-?shirts?|shirts?|merch\w*|hoodies?|lanyards?|stickers?|totes?|jerseys?)\b/i],
  ['Food', /\b(food|catering|snacks?|drinks?|pizza|lunch|dinner|breakfast|refreshments?|meals?|beverages?)\b/i],
  ['Printing', /\b(print\w*|banners?|posters?|buntings?|flyers?|brochures?|bookmarks?)\b/i],
  ['Prizes', /\b(prizes?|vouchers?|awards?|trophy|trophies|hampers?|giveaways?)\b/i],
  ['Membership', /\bmembership\b/i],
  ['Ticket Sales', /\b(tickets?|registration|entry fees?)\b/i],
  ['Sponsorship', /\b(sponsor\w*)\b/i],
];

/** Category from obvious words in the details, or null to ask the AI. */
export function keywordCategory(description: string): string | null {
  return KEYWORDS.find(([, re]) => re.test(description))?.[0] ?? null;
}

/** The one event whose title matches the sheet's event name as whole words; null if none or ambiguous. */
export function matchEvent<E extends { id: string; title: string }>(name: string | null, events: E[]): E | null {
  if (!name) return null;
  // Apostrophes dropped, so "Fresher's Fair" = "Freshers' Fair".
  const norm = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const exact = events.filter((e) => norm(e.title) === norm(name));
  if (exact.length === 1) return exact[0];
  const loose = events.filter((e) => sameName(norm(e.title), norm(name)));
  return loose.length === 1 ? loose[0] : null;
}
