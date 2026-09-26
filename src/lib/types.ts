// ─────────────────────────────────────────────────────────────────────────────
// Canonical domain types for the CS Society dashboard.
//
// These interfaces are the single source of truth used by:
//   - data-access hooks (src/hooks/), which map /api/* responses into them
//   - UI view components
//
// The /api functions read Notion (see NOTION_MAPPING.md and docs/PLAN.md);
// hooks translate their responses so components never see Notion shapes.
// ─────────────────────────────────────────────────────────────────────────────

// ── Task ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  /** Normalised status; UI should use this, not the legacy `done` boolean. */
  status: TaskStatus;
  /** Convenience accessor derived from status === 'done'. */
  completed: boolean;
  /** Linked event's name, shown as a label next to the title. Undefined (hidden) when there's no event. */
  project?: string;
  /** ISO-8601 date or datetime from Notion `Due Date`. Undefined when unset. */
  dueDate?: string;
  /** Linked Team Dashboard > Events page ids. */
  eventIds: string[];
  /** The signed-in member is a PIC on this task. */
  mine: boolean;
  /** Included in the weekly scrum view (mine; not Done, or Done this week). */
  weekly: boolean;
}

// ── Event ────────────────────────────────────────────────────────────────────

export interface AgendaItem {
  /** Display time label, e.g. "6:00 PM" or "18:00" */
  time: string;
  title: string;
  description?: string;
}

export type EventCategory =
  | 'workshop'
  | 'social'
  | 'meeting'
  | 'talk'
  | 'hackathon'
  | 'other';

/** Progression status for an event */
export type EventStatus = 'scheduled' | 'planning-in-progress' | 'done';

export interface EventTodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface FinanceItem {
  id: string;
  description: string;
  amount: number;
  /** 'income' | 'expense' */
  type: 'income' | 'expense';
}

/** Team Dashboard > Events rows are 'event'; Team Dashboard > Meetings rows are 'meeting'. */
export type EventKind = 'event' | 'meeting';

export interface Event {
  id: string;
  kind: EventKind;
  title: string;
  /** No Notion source yet; always '' (hidden in the UI, see EVENT_FEATURES). */
  description: string;
  /**
   * ISO-8601 date ("2026-09-30", when allDay) or datetime with offset
   * ("2026-09-30T19:00:00.000+08:00"). Undefined when the date is TBA.
   */
  startDateTime?: string;
  /** Same format as startDateTime. Undefined when there's no end or no date. */
  endDateTime?: string;
  /** True when Notion holds a date without a time. */
  allDay?: boolean;
  location?: string;
  /** Notion has no category; derived from kind ('meeting' or 'other'). */
  category: EventCategory;
  /** No Notion source yet; always []. */
  agenda: AgendaItem[];
  /** No Notion source yet; always 0. */
  rsvpCount: number;
  /** Progression status label. Undefined for meetings. */
  status?: EventStatus;
  /** Link to the event's Notion page. */
  notionUrl?: string;
  /** Per-event to-do items */
  todos?: EventTodoItem[];
  /** Per-event finance items */
  financeItems?: FinanceItem[];
}

// ── TeamMember ───────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  /** Position from Notion; empty string when not set. */
  role: string;
  /** From api/_lib/memberDetails.ts; undefined until filled in. */
  department?: string;
  /** Academic year label, e.g. "Year 2". From api/_lib/memberDetails.ts. */
  year?: string;
  /** From Supabase committee_members; undefined when unmatched. */
  email?: string;
  /** Notion-hosted photo URL (expires after ~1h); falls back to initials. */
  avatarUrl?: string;
}

// ── Document ─────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  name: string;
  /** Direct URL to the Notion page (or any external resource). */
  url: string;
  /**
   * Lucide icon name as a string key, resolved at render time via iconMap.
   * Kept optional so documents without a custom icon fall back to FileText.
   */
  icon?: string;
  /** Logical grouping shown in filter/sidebar UI. */
  category?: string;
}

// ── Shared utility types ─────────────────────────────────────────────────────

/**
 * Generic async result shape returned by every data-access hook.
 * Mirrors the contract of libraries like SWR / React Query so the
 * hook bodies can be swapped without touching consuming components.
 */
export interface AsyncResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}
