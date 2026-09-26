import { cn } from '@/lib/utils';

/** Marks an event or meeting whose date isn't set in Notion yet. */
export function TbaTag({ className }: { className?: string }) {
  return (
    <span
      title="Date not set in Notion yet"
      className={cn(
        'border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600',
        className
      )}
    >
      TBA
    </span>
  );
}
