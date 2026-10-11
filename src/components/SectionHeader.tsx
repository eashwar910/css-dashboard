/** A section title with optional meta text and an action on the right. */
export function SectionHeader({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <div className="flex items-center gap-3">
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        {action}
      </div>
    </div>
  );
}
