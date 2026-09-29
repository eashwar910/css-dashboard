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
  /** No individual PIC: only Notion's "Everyone" group, or nobody. */
  shared: boolean;
  /** "Everyone" or "Unassigned" for shared tasks. */
  sharedWith?: string;
  /** Notion `Week`: Monday (YYYY-MM-DD) of the week it was planned for. Undefined when unset. */
  week?: string;
  /** Individual PIC people; the Weekly tab groups by these. */
  assignees: { id: string; name: string }[];
  /** In the Weekly tab's "This week" (planned this week, or still open). */
  thisWeek: boolean;
  /** Open and planned for an earlier week. */
  carriedOver: boolean;
  /** In the Weekly tab's "Last week" (planned for last week, Done or not). */
  lastWeek: boolean;
  /** What the signed-in member may do. The server re-checks every write. */
  can: { toggle: boolean; edit: boolean; delete: boolean };
}

/** Fields that can be sent when creating or editing a task. null clears a field. */
export interface TaskInput {
  title?: string;
  /** YYYY-MM-DD, or null to clear. */
  dueDate?: string | null;
  status?: TaskStatus;
  /** Team Dashboard > Events page id, or null to unlink. */
  eventId?: string | null;
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

/** A row of Team Dashboard > Events. Meetings are a separate type (Meeting). */
export interface Event {
  id: string;
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
  /** Notion has no category; always 'other'. */
  category: EventCategory;
  /** No Notion source yet; always []. */
  agenda: AgendaItem[];
  /** No Notion source yet; always 0. */
  rsvpCount: number;
  /** Progression status label. Undefined for an unrecognised Notion status. */
  status?: EventStatus;
  /** Link to the event's Notion page. */
  notionUrl?: string;
  /** Per-event to-do items */
  todos?: EventTodoItem[];
  /** Per-event finance items */
  financeItems?: FinanceItem[];
}

// ── Meeting ──────────────────────────────────────────────────────────────────

/** A row of Team Dashboard > Meetings. Its minutes are the Notion page body. */
export interface Meeting {
  id: string;
  title: string;
  /** Same formats as Event.startDateTime. Undefined when the date is TBA. */
  startDateTime?: string;
  endDateTime?: string;
  allDay?: boolean;
  location?: string;
  /** Notion `Type`: JC / ExCo / Weekly Meeting. */
  type?: string;
  createdBy?: string;
  /** Notion `Attendees`: who's going (upcoming) or went (past). */
  attendees: MeetingAttendee[];
  /** Notion `Not Going`: who said they can't come. */
  notGoing: MeetingAttendee[];
  notionUrl: string;
}

export interface MeetingAttendee {
  /** Notion user id. */
  id: string;
  name: string;
}

/** A member's reply to a meeting; null = no reply. */
export type MeetingRsvp = 'going' | 'not-going' | null;

/** A committee member, for listing who hasn't replied to a meeting. */
export interface RosterMember {
  name: string;
  /** null when they have no matching Notion account; matched on name instead. */
  notionUserId: string | null;
}

/** A new meeting: date YYYY-MM-DD and time HH:mm (Malaysia time). */
export interface MeetingInput {
  title: string;
  date: string;
  time: string;
  notes?: string;
  venue?: string | null;
  type?: string | null;
}

/** Meeting edits. start null = date TBA; send start and end together. */
export interface MeetingEdit {
  title?: string;
  start?: string | null;
  end?: string | null;
  venue?: string | null;
  type?: string | null;
}

// ── TeamMember ───────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  /** Position from Notion; empty string when not set. */
  role: string;
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

// ── Finance (Finance Tracker > Transactions) ─────────────────────────────────

export type TransactionType = 'Income' | 'Expense';
export type PaidBy = 'Society Account' | 'Member';
export type ReimbursementStatus = 'Pending' | 'Approved' | 'Paid Back';

export interface Transaction {
  id: string;
  description: string;
  type: TransactionType | null;
  /** Ringgit (RM). */
  amount: number | null;
  /** ISO date. */
  date: string | null;
  /** Linked Team Dashboard > Events page id. */
  eventId: string | null;
  category: string | null;
  paidBy: PaidBy | null;
  claimant: { id: string; name: string | null } | null;
  reimbursementStatus: ReimbursementStatus | null;
  recordedBy: string | null;
  receiptCount: number;
  /** Notion page (receipts are viewed there). */
  url: string;
}

export interface FinanceTotals {
  income: number;
  spending: number;
  /** income − spending */
  balance: number;
  /** Paid By = Member and not Paid Back. */
  outstanding: number;
  count: number;
}

export interface FinanceOptions {
  types: TransactionType[];
  categories: string[];
  paidBy: PaidBy[];
  reimbursementStatuses: ReimbursementStatus[];
}

export interface TransactionInput {
  description: string;
  type: TransactionType;
  amount: number;
  /** YYYY-MM-DD; defaults to today (Kuala Lumpur). */
  date?: string;
  eventId?: string | null;
  category?: string | null;
  paidBy?: PaidBy;
  /** Login email of the member being reimbursed (Paid By = Member only). */
  claimantEmail?: string;
  reimbursementStatus?: ReimbursementStatus;
}
