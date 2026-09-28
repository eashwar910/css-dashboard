import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AsyncResult, Meeting, MeetingInput } from '@/lib/types';
import { createApiStore } from '@/lib/apiStore';
import { eventStart, isTba, isUpcoming } from '@/lib/eventDates';
import { apiFetch } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// useMeetings
//
// Team Dashboard > Meetings from GET /api/meetings, shared across views.
// A meeting is upcoming until it's over (or while its date is TBA), then it
// moves to the minutes list. createMeeting saves to Notion (POST).
// ─────────────────────────────────────────────────────────────────────────────

interface MeetingDto {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
  type: string | null;
  createdBy: string | null;
  url: string;
}

interface MeetingsResponse {
  meetings: MeetingDto[];
  canCreate: boolean;
}

function toMeeting(dto: MeetingDto): Meeting {
  return {
    id: dto.id,
    title: dto.title,
    startDateTime: dto.start ?? undefined,
    endDateTime: dto.end ?? undefined,
    allDay: dto.allDay,
    location: dto.location ?? undefined,
    type: dto.type ?? undefined,
    createdBy: dto.createdBy ?? undefined,
    notionUrl: dto.url,
  };
}

const store = createApiStore<MeetingsResponse, { meetings: Meeting[]; canCreate: boolean }>(
  'meetings',
  (res) => ({ meetings: res.meetings.map(toMeeting), canCreate: res.canCreate }),
  { meetings: [], canCreate: false }
);

function startMs(m: Meeting): number | null {
  return eventStart(m)?.getTime() ?? null;
}

export interface MeetingsResult extends AsyncResult<Meeting[]> {
  /** Not over yet, soonest first; TBA meetings last. */
  upcoming: Meeting[];
  /** Over, most recent first: the meeting minutes. */
  past: Meeting[];
  /** The President, Vice President, Secretary and Head of Tech can add meetings. */
  canCreate: boolean;
  createMeeting: (input: MeetingInput) => Promise<Meeting>;
}

export function useMeetings(): MeetingsResult {
  const { value, isLoading, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    store.ensureFresh();
  }, []);

  const upcoming = useMemo(
    () =>
      value.meetings
        .filter((m) => isTba(m) || isUpcoming(m))
        .sort((a, b) => {
          const as = startMs(a);
          const bs = startMs(b);
          if (as !== null && bs !== null) return as - bs;
          if (as !== null) return -1;
          if (bs !== null) return 1;
          return a.title.localeCompare(b.title);
        }),
    [value.meetings]
  );

  const past = useMemo(
    () =>
      value.meetings
        .filter((m) => !isTba(m) && !isUpcoming(m))
        .sort((a, b) => (startMs(b) ?? 0) - (startMs(a) ?? 0)),
    [value.meetings]
  );

  const createMeeting = useCallback(async (input: MeetingInput): Promise<Meeting> => {
    const { meeting: dto } = await apiFetch<{ meeting: MeetingDto }>('meetings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const meeting = toMeeting(dto);
    store.update((v) => ({ ...v, meetings: [...v.meetings, meeting] }));
    return meeting;
  }, []);

  return { data: value.meetings, isLoading, error, upcoming, past, canCreate: value.canCreate, createMeeting };
}
