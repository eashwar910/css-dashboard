// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED — do not add new imports from this file.
//
// This file previously contained all interfaces and mock data.
// It now re-exports the new canonical types and mock arrays so any external
// references to @/data/mockData continue to compile during migration.
//
// Components should import from hooks instead:
//   useTasks()        → src/hooks/useTasks.ts
//   useEvents()       → src/hooks/useEvents.ts (real data via /api/events)
//   useTeamMembers()  → src/hooks/useTeamMembers.ts (real data via /api/team)
//   useDocuments()    → src/hooks/useDocuments.ts (real data via /api/documents)
// ─────────────────────────────────────────────────────────────────────────────

// Re-export canonical types (renamed for backward compat where needed)
export type { Task, Event as EventItem, TeamMember, Document as DocumentLink } from '@/lib/types';

// Re-export mock arrays under the old names
export { mockTasks as weeklyTasks } from './tasks';
