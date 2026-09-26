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
   * Add / delete events, edit dates and change status from the dashboard.
   * Off because these only changed browser memory: Notion is the source of
   * truth and there is no event write endpoint, so edits would silently vanish.
   */
  editing: false,
  /** EPF (Event Planning Form) button. Off until there is a form to open. */
  epf: false,
} as const;
