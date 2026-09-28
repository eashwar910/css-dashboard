import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { buildTimeline, type WhenValue } from '@/lib/eventWhen';

interface EventWhenFieldsProps {
  value: WhenValue;
  onChange: (value: WhenValue) => void;
  /** Prefix for input ids, so two forms can be on the page. */
  idPrefix: string;
  disabled?: boolean;
}

export function EventWhenFields({ value, onChange, idPrefix, disabled = false }: EventWhenFieldsProps) {
  const set = (patch: Partial<WhenValue>) => onChange({ ...value, ...patch });
  const timeline = buildTimeline(value);
  const error = typeof timeline === 'string' ? timeline : null;
  const { tba, allDay } = value;

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1.5 text-xs font-medium">When</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox checked={tba} disabled={disabled} onCheckedChange={(v) => set({ tba: v === true })} />
          Date TBA
        </label>
        <label className={cn('flex items-center gap-2 text-xs', tba ? 'opacity-50' : 'cursor-pointer')}>
          <Checkbox checked={allDay} disabled={tba || disabled} onCheckedChange={(v) => set({ allDay: v === true })} />
          All day
        </label>
      </div>

      {!tba && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-start-date`} className="text-xs">Start date *</Label>
            <Input
              id={`${idPrefix}-start-date`}
              type="date"
              value={value.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
              style={{ borderRadius: 0 }}
            />
          </div>
          {!allDay ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-start-time`} className="text-xs">Start time *</Label>
              <Input
                id={`${idPrefix}-start-time`}
                type="time"
                value={value.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
                style={{ borderRadius: 0 }}
              />
            </div>
          ) : (
            <div />
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-end-date`} className="text-xs">
              End date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`${idPrefix}-end-date`}
              type="date"
              value={value.endDate}
              min={value.startDate || undefined}
              onChange={(e) => set({ endDate: e.target.value })}
              style={{ borderRadius: 0 }}
            />
          </div>
          {!allDay && (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-end-time`} className="text-xs">
                End time <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${idPrefix}-end-time`}
                type="time"
                value={value.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
                style={{ borderRadius: 0 }}
              />
            </div>
          )}
        </div>
      )}
      {error && (value.startDate || value.endDate || value.endTime) && <p className="text-[11px] text-destructive">{error}</p>}
    </fieldset>
  );
}
