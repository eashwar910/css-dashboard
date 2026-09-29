import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DetailFact {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

/**
 * The when/where of an event or meeting as a labelled strip, so it reads
 * clearly above the page body instead of blending into it.
 */
export function DetailFacts({ facts }: { facts: DetailFact[] }) {
  return (
    <dl className="grid grid-cols-1 divide-y divide-border border border-border bg-muted/20 sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
      {facts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-w-0 items-start gap-2.5 px-3 py-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
