import type { Task } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock task data.
//
// Tasks map to a Notion database where each row represents one action item
// owned by a committee member. Projects correspond to Notion database
// "Group" select properties.
//
// Replace the array below with a real fetch when the Notion integration is
// ready — the hook (src/hooks/useTasks.ts) is the only place that needs to
// change.
// ─────────────────────────────────────────────────────────────────────────────

export const mockTasks: Task[] = [
  // ── Gilbot Project ──────────────────────────────────────────────────────────
  {
    id: 'task-001',
    title: 'Set up Discord bot command scaffolding',
    status: 'done',
    completed: true,
    project: 'Gilbot',
    dueDate: '2026-09-18',
  },
  {
    id: 'task-002',
    title: 'Implement /events slash command',
    status: 'in-progress',
    completed: false,
    project: 'Gilbot',
    dueDate: '2026-09-26',
  },
  {
    id: 'task-003',
    title: 'Write unit tests for message parser',
    status: 'todo',
    completed: false,
    project: 'Gilbot',
    dueDate: '2026-09-30',
  },
  {
    id: 'task-004',
    title: 'Deploy bot to production server',
    status: 'todo',
    completed: false,
    project: 'Gilbot',
    dueDate: '2026-10-04',
  },

  // ── Nottshack 2026 ──────────────────────────────────────────────────────────
  {
    id: 'task-005',
    title: 'Confirm venue booking with Student Union',
    status: 'done',
    completed: true,
    project: 'Nottshack26',
    dueDate: '2026-09-15',
  },
  {
    id: 'task-006',
    title: 'Open registration form for participants',
    status: 'done',
    completed: true,
    project: 'Nottshack26',
    dueDate: '2026-09-20',
  },
  {
    id: 'task-007',
    title: 'Source sponsorship from three local tech companies',
    status: 'in-progress',
    completed: false,
    project: 'Nottshack26',
    dueDate: '2026-09-28',
  },
  {
    id: 'task-008',
    title: 'Arrange overnight catering and dietary options',
    status: 'todo',
    completed: false,
    project: 'Nottshack26',
    dueDate: '2026-10-01',
  },
  {
    id: 'task-009',
    title: 'Brief judges on scoring criteria',
    status: 'todo',
    completed: false,
    project: 'Nottshack26',
    dueDate: '2026-10-08',
  },

  // ── Nottshack 2027 (early planning) ─────────────────────────────────────────
  {
    id: 'task-010',
    title: 'Draft proposal doc for committee review',
    status: 'in-progress',
    completed: false,
    project: 'Nottshack27',
    dueDate: '2026-10-15',
  },
  {
    id: 'task-011',
    title: "Survey this year's participants for feedback themes",
    status: 'todo',
    completed: false,
    project: 'Nottshack27',
    dueDate: '2026-10-20',
  },

  // ── OpenAI Workshop ─────────────────────────────────────────────────────────
  {
    id: 'task-012',
    title: 'Confirm speaker availability (Dr. Nadia Osei)',
    status: 'done',
    completed: true,
    project: 'OpenAI Workshop',
    dueDate: '2026-09-21',
  },
  {
    id: 'task-013',
    title: 'Prepare lab environment with API keys',
    status: 'in-progress',
    completed: false,
    project: 'OpenAI Workshop',
    dueDate: '2026-09-25',
  },
  {
    id: 'task-014',
    title: 'Write participant pre-reading guide (Python basics)',
    status: 'todo',
    completed: false,
    project: 'OpenAI Workshop',
    dueDate: '2026-09-27',
  },
  {
    id: 'task-015',
    title: 'Create feedback form and share after event',
    status: 'todo',
    completed: false,
    project: 'OpenAI Workshop',
    dueDate: '2026-10-02',
  },

  // ── General ops ─────────────────────────────────────────────────────────────
  {
    id: 'task-016',
    title: 'Send weekly newsletter to member list',
    status: 'todo',
    completed: false,
    project: 'Operations',
    dueDate: '2026-09-23',
  },
  {
    id: 'task-017',
    title: 'Prepare budget presentation for dean',
    status: 'todo',
    completed: false,
    project: 'Operations',
    dueDate: '2026-09-26',
  },
  {
    id: 'task-018',
    title: 'Update society social media pages with event banners',
    status: 'todo',
    completed: false,
    project: 'Operations',
    dueDate: '2026-09-25',
  },
];
