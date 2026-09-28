// ─────────────────────────────────────────────────────────────────────────────
// UI switches for event features that have no Notion source yet.
//
// The components stay in the codebase; flip a flag to true once Notion (and,
// for `editing`, an /api write endpoint) can back it. See docs/PLAN.md.
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_FEATURES = {
  /** Agenda / timeline segments. */
  agenda: false,
  /** RSVP counts and the "Going" button. */
  rsvp: false,
  /** Free-text event description. */
  description: false,
  /**
   * Delete events and change their status from the dashboard. Off because
   * these only change browser memory, so edits would silently vanish.
   * (Adding events, and editing an upcoming event's date, location and
   * Overview, do save to Notion and are always on.)
   */
  editing: false,
} as const;
