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
    name: 'Lee Yoonjae',
    role: 'President',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 1',
    email: 'hfyyl16@nottingham.edu.my',
  },
  {
    id: 'tm-002',
    name: 'Selina Yeoh Yun Ci',
    role: 'Vice President',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 2',
    email: 'hfysy6@nottingham.edu.my',
  },
  {
    id: 'tm-003',
    name: 'John Tiong Sie Ho',
    role: 'Treasurer',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 1',
    email: 'hfyjt16@nottingham.edu.my',
  },
  {
    id: 'tm-004',
    name: 'Min Pyae Phyo',
    role: 'Secretary',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 1',
    email: 'hfypm2@nottingham.edu.my',
  },
  {
    id: 'tm-005',
    name: 'Yau Jia Wei',
    role: 'Event Manager',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 2',
    email: 'hcyjy5@nottingham.edu.my',
  },
  {
    id: 'tm-006',
    name: 'Fathima Sakinah Dil Fairaz',
    role: 'Marketing Director',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 1',
    email: 'hcyfd1@nottingham.edu.my',
  },
  {
    id: 'tm-007',
    name: 'Wong Zi Xin',
    role: 'Creative Director I',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 2',
    email: 'hfyzw5@nottingham.edu.my',
  },
  {
    id: 'tm-008',
    name: 'Muhammad Faysal bin Md Mijanur Rahman',
    role: 'Creative Director II',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 1',
    email: 'hfymm22@nottingham.edu.my',
  },
  {
    id: 'tm-009',
    name: 'Eashwar Siddha Satish Nath',
    role: 'Head of Tech',
    department: 'Computer and Mathematical Sciences',
    year: 'Year 2',
    email: 'hcyes4@nottingham.edu.my',
  },
];
