// ─────────────────────────────────────────────────────────────────────────────
// UI switches for event features that have no Notion source yet.
//
// The components stay in the codebase; flip a flag to true once Notion can
// back it. See docs/PLAN.md. (Adding, editing and deleting events all save to
// Notion and are always on.)
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_FEATURES = {
  /** Agenda / timeline segments. */
  agenda: false,
  /** RSVP counts and the "Going" button. */
  rsvp: false,
  /** Free-text event description. */
  description: false,
} as const;
