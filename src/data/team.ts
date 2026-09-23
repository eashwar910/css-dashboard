import type { TeamMember } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock team member data.
//
// Maps to a Notion database of committee members. avatarUrl is intentionally
// left undefined here so the UI falls back to initials — real URLs can be
// filled in from Notion file properties later without any interface change.
// ─────────────────────────────────────────────────────────────────────────────

export const mockTeamMembers: TeamMember[] = [
  {
    id: 'tm-001',
    name: 'Alex Chen',
    role: 'President',
    department: 'Computer Science',
    year: 'Year 4',
    email: 'alex.chen@university.edu',
  },
  {
    id: 'tm-002',
    name: 'Priya Patel',
    role: 'Vice President',
    department: 'Computer Science',
    year: 'Year 3',
    email: 'priya.patel@university.edu',
  },
  {
    id: 'tm-003',
    name: 'Marcus Johnson',
    role: 'Lead Developer',
    department: 'Software Engineering',
    year: 'Year 4',
    email: 'marcus.j@university.edu',
  },
  {
    id: 'tm-004',
    name: 'Sofia Rodriguez',
    role: 'Event Coordinator',
    department: 'Information Systems',
    year: 'Year 3',
    email: 'sofia.r@university.edu',
  },
  {
    id: 'tm-005',
    name: 'Kevin Park',
    role: 'Treasurer',
    department: 'Computer Science',
    year: 'Year 2',
    email: 'kevin.park@university.edu',
  },
  {
    id: 'tm-006',
    name: 'Aisha Mohammed',
    role: 'Marketing Lead',
    department: 'Graphic Design',
    year: 'Year 3',
    email: 'aisha.m@university.edu',
  },
  {
    id: 'tm-007',
    name: 'Daniel Kim',
    role: 'Webmaster',
    department: 'Computer Science',
    year: 'Year 2',
    email: 'daniel.kim@university.edu',
  },
  {
    id: 'tm-008',
    name: 'Emma Williams',
    role: 'Outreach Coordinator',
    department: 'Communications',
    year: 'Year 1',
    email: 'emma.w@university.edu',
  },
  {
    id: 'tm-009',
    name: 'Liam Okafor',
    role: 'Workshop Organiser',
    department: 'Computer Science',
    year: 'Year 3',
    email: 'liam.o@university.edu',
  },
  {
    id: 'tm-010',
    name: 'Yuki Tanaka',
    role: 'Competitions Lead',
    department: 'Mathematics & CS',
    year: 'Year 4',
    email: 'yuki.t@university.edu',
  },
];
