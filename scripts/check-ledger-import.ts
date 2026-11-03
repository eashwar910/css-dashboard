// Self-check for src/lib/ledgerImport.ts, using the Sept 2025 ledger layout.
// Usage: npx tsx scripts/check-ledger-import.ts

import assert from 'node:assert/strict';
import { keywordCategory, matchEvent, parseLedger } from '../src/lib/ledgerImport';

const sheet = [
  [null, 'Computer Science Society (6094)'],
  [null, 'Ledger for the Academic Year 2025-2026 Ending 30/09/2025'],
  [],
  ['Date', 'Details', 'Event', 'Income', 'Expenses', 'OR No', 'CS-PV No', 'Balance'],
  [null, null, null, 'RM', 'RM', null, null, 'RM'],
  ['17-Sep', 'Balance b/fwd to Academic Year 2025/2026', null, null, null, null, null, 2320.02],
  [new Date(Date.UTC(2025, 8, 19)), "Fresher's Fair", "Fresher's Fair", null, 22, null, 'NN-EV0000002959', 2298.02],
  ['27-Sep', 'CSS T-Shirts', null, null, '1,055.50', null, 'NN-EV0000002960', 1242.52],
  [],
  [null, "Freshers' Fair Subsidy", null, 50, null, null, null, null],
  [null, '1 transaction on 25th Sept', null, 15, null, null, null, null],
  [null, 'Balance as per Sept25', null, null, null, null, null, 2385.02],
  ['28-Sep', 'Wrong balance', null, 10, null, null, null, 9999],
];

const rows = parseLedger(sheet);
assert.equal(rows.length, 5);
assert.deepEqual(
  rows.map((r) => [r.date, r.type, r.amount, r.reference, r.problem]),
  [
    ['2025-09-19', 'Expense', 22, 'NN-EV0000002959', null],
    ['2025-09-27', 'Expense', 1055.5, 'NN-EV0000002960', null],
    [null, 'Income', 50, null, 'No date'],
    [null, 'Income', 15, null, 'No date'],
    ['2025-09-28', 'Income', 10, null, 'Balance should be 1252.52, sheet says 9999.00'],
  ],
);
assert.equal(rows[0].eventName, "Fresher's Fair");

// Year rolls back for months after the ending month.
assert.equal(parseLedger([['Ending 31/01/2026'], ['Date', 'Details', 'Income'], ['17-Dec', 'x', 5]])[0].date, '2025-12-17');
assert.throws(() => parseLedger([['nothing here']]));

assert.equal(keywordCategory('CSS T-Shirts'), 'Merch');
assert.equal(keywordCategory('Pizza for hackathon'), 'Food');
assert.equal(keywordCategory("Fresher's Fair"), null);

const events = [{ id: 'a', title: "Freshers' Fair 2025" }, { id: 'b', title: 'Hackathon' }, { id: 'c', title: 'Hackathon Workshop' }];
assert.equal(matchEvent("Fresher's Fair", events)?.id, 'a');
assert.equal(matchEvent('hackathon', events)?.id, 'b'); // exact beats the looser match
assert.equal(matchEvent('Workshop', events)?.id, 'c');
assert.equal(matchEvent('Gala', events), null);

console.log('ledgerImport: all checks passed');
