const rm = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });

/** "RM 12.50" (society money is in Malaysian ringgit). */
export function formatRM(amount: number | null | undefined): string {
  return rm.format(amount ?? 0);
}
