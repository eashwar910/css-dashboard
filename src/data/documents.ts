import type { Document } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock document data.
//
// Each entry represents a Notion page linked from the society workspace.
// The `icon` field is a Lucide icon name resolved at render time via the
// view's iconMap. The `category` field is used for grouping / filtering.
//
// Replace with a real Notion page-list fetch; the Document interface and
// hooks contract do not change.
// ─────────────────────────────────────────────────────────────────────────────

export const mockDocuments: Document[] = [
  // ── Governance ──────────────────────────────────────────────────────────────
  {
    id: 'doc-001',
    name: 'Meeting Minutes',
    url: '#',
    icon: 'FileText',
    category: 'Governance',
  },

  // ── Projects ────────────────────────────────────────────────────────────────
  {
    id: 'doc-002',
    name: 'NottsHack 2027',
    url: '#',
    icon: 'LayoutTemplate',
    category: 'Projects',
  },

  // ── Resources ───────────────────────────────────────────────────────────────
  {
    id: 'doc-003',
    name: 'Workshop Slides Archive',
    url: '#',
    icon: 'Presentation',
    category: 'Resources',
  },

  // ── Finance ─────────────────────────────────────────────────────────────────
  {
    id: 'doc-004',
    name: 'Budget Report',
    url: '#',
    icon: 'Wallet',
    category: 'Finance',
  },
];
