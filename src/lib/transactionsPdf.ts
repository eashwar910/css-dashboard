import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatRM } from '@/lib/money';
import { parseDate } from '@/lib/eventDates';
import type { Transaction } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// PDF of chosen transactions: a table plus income, spending and net totals.
// Loaded with import() from the Finance page, so jsPDF isn't in the main bundle.
// ─────────────────────────────────────────────────────────────────────────────

/** Built-in PDF fonts can't draw a non-breaking space or U+2013; keep to plain ASCII. */
const money = (n: number | null) => formatRM(n).replace(/\u00a0/g, ' ');

export function exportTransactionsPdf(transactions: Transaction[], eventNames: Map<string, string>) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const now = new Date();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Transactions', 40, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${transactions.length} selected · exported ${format(now, 'd MMM yyyy, h:mm a')}`, 40, 60);
  doc.setTextColor(0);

  let income = 0;
  let spending = 0;
  const body = transactions.map((t) => {
    const amount = t.amount ?? 0;
    if (t.type === 'Income') income += amount;
    if (t.type === 'Expense') spending += amount;
    const when = parseDate(t.date);
    return [
      when ? format(when, 'd MMM yyyy') : '',
      t.description,
      t.type ?? '',
      t.category ?? '',
      t.eventId ? eventNames.get(t.eventId) ?? 'Event' : '',
      t.paidBy === 'Member' ? `Member (${t.claimant?.name ?? 'unknown'})` : t.paidBy ?? '',
      t.paidBy === 'Member' ? t.reimbursementStatus ?? '' : '',
      `${t.type === 'Income' ? '+' : '-'}${money(amount)}`,
    ];
  });

  autoTable(doc, {
    startY: 76,
    head: [['Date', 'Description', 'Type', 'Category', 'Event', 'Paid by', 'Reimbursement', 'Amount']],
    body,
    foot: [
      ['', 'Income', '', '', '', '', '', `+${money(income)}`],
      ['', 'Spending', '', '', '', '', '', `-${money(spending)}`],
      ['', 'Net', '', '', '', '', '', money(income - spending)],
    ],
    showFoot: 'lastPage',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, overflow: 'linebreak' },
    headStyles: { fillColor: [38, 36, 33], textColor: 255 },
    footStyles: { fillColor: [240, 238, 232], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 68 }, 1: { cellWidth: 'auto' }, 7: { halign: 'right', cellWidth: 90 } },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 7) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.column.index === 7) {
        data.cell.styles.textColor = transactions[data.row.index].type === 'Income' ? [5, 150, 105] : [200, 40, 40];
      }
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Page ${page}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
      doc.setTextColor(0);
    },
  });

  doc.save(`transactions-${format(now, 'yyyy-MM-dd')}.pdf`);
}
