// ─────────────────────────────────────────────────────────────────────────────
// Canonical domain types for the CS Society dashboard.
//
// These interfaces are the single source of truth used by:
//   - mock data files  (src/data/)
//   - data-access hooks (src/hooks/)
//   - UI view components
//
// When real Notion API calls replace the mocks, only the hook implementations
// change — these interfaces and the components that use them stay the same.
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
  /** Project or category tag shown as a label next to the task title. */
  project: string;
  /** ISO-8601 date string, e.g. "2026-09-24" */
  dueDate: string;
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

export interface Event {
  id: string;
  title: string;
  description: string;
  /** ISO-8601 datetime string, e.g. "2026-09-24T18:00:00" */
  startDateTime: string;
  /** ISO-8601 datetime string */
  endDateTime: string;
  location?: string;
  category: EventCategory;
  agenda: AgendaItem[];
  rsvpCount: number;
}

// ── TeamMember ───────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  /** Academic year label, e.g. "Senior", "Junior", "Year 3" */
  year: string;
  email: string;
  /** Optional URL to a profile photo; falls back to initials avatar in UI. */
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
