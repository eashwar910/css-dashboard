import type { Event } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock event data.
//
// Maps to a Notion calendar / events database. The `agenda` array maps to a
// Notion sub-property or linked database. `rsvpCount` maps to a rollup from
// an RSVP relation.
//
// When real data replaces this, the transformation layer lives in the hook
// (src/hooks/useEvents.ts) — not here and not in the UI.
// ─────────────────────────────────────────────────────────────────────────────

export const mockEvents: Event[] = [
  // ── September 2026 ──────────────────────────────────────────────────────────
  {
    id: 'evt-001',
    title: 'General Body Meeting',
    description:
      'Monthly general meeting covering society updates, upcoming events, and an open floor for announcements and questions.',
    startDateTime: '2026-09-12T18:30:00',
    endDateTime: '2026-09-12T19:30:00',
    location: 'Lecture Hall 1',
    category: 'meeting',
    rsvpCount: 42,
    agenda: [
      { time: '6:30 PM', title: 'Welcome & roll call' },
      { time: '6:35 PM', title: 'Committee updates', description: 'Each officer gives a 2-min update.' },
      { time: '6:55 PM', title: 'Upcoming events preview' },
      { time: '7:10 PM', title: 'Open floor & Q&A' },
      { time: '7:25 PM', title: 'Close' },
    ],
  },
  {
    id: 'evt-002',
    title: 'Resume Review Session',
    description:
      'Peer and mentor resume reviews. Bring a printed copy and get feedback from upperclassmen and alumni volunteers.',
    startDateTime: '2026-09-16T15:00:00',
    endDateTime: '2026-09-16T17:00:00',
    location: 'Career Services Centre',
    category: 'workshop',
    rsvpCount: 28,
    agenda: [
      { time: '3:00 PM', title: 'Introduction & format overview' },
      { time: '3:10 PM', title: 'Round 1 reviews (25 min)' },
      { time: '3:35 PM', title: 'Group tips session', description: 'Common mistakes and quick wins.' },
      { time: '4:00 PM', title: 'Round 2 reviews (45 min)' },
      { time: '4:45 PM', title: 'Wrap up & resources shared' },
    ],
  },
  {
    id: 'evt-003',
    title: 'Game Night & Social',
    description:
      'Casual game night with board games, video games, and pizza. A great opportunity to unwind and meet fellow members.',
    startDateTime: '2026-09-19T19:00:00',
    endDateTime: '2026-09-19T22:00:00',
    location: 'Student Lounge',
    category: 'social',
    rsvpCount: 55,
    agenda: [],
  },
  {
    id: 'evt-004',
    title: 'Algorithms Study Group',
    description:
      'Weekly study group focusing on data structures and algorithms. This session: graphs and dynamic programming.',
    startDateTime: '2026-09-22T16:00:00',
    endDateTime: '2026-09-22T18:00:00',
    location: 'Library Study Room 5',
    category: 'workshop',
    rsvpCount: 18,
    agenda: [
      { time: '4:00 PM', title: 'Graph traversal review (BFS / DFS)' },
      { time: '4:40 PM', title: 'Dynamic programming patterns', description: 'Top-down vs bottom-up, memoisation.' },
      { time: '5:20 PM', title: 'Live problem-solving session' },
      { time: '5:50 PM', title: 'Wrap up & next week preview' },
    ],
  },
  {
    id: 'evt-005',
    title: 'Intro to Competitive Programming',
    description:
      'A hands-on session covering the basics of competitive programming. We will solve problems from Codeforces and discuss strategies for upcoming contests.',
    startDateTime: '2026-09-24T18:00:00',
    endDateTime: '2026-09-24T20:00:00',
    location: 'Engineering Building, Room 204',
    category: 'workshop',
    rsvpCount: 34,
    agenda: [
      { time: '6:00 PM', title: 'What is competitive programming?', description: 'Platforms, contest formats, rating systems.' },
      { time: '6:20 PM', title: 'Problem-solving framework' },
      { time: '6:40 PM', title: 'Live coding: warm-up problem' },
      { time: '7:05 PM', title: 'Team problem: medium difficulty' },
      { time: '7:40 PM', title: 'Debrief & resources' },
    ],
  },
  {
    id: 'evt-006',
    title: 'Hackathon Kickoff & Team Formation',
    description:
      'Kickoff event for our annual 48-hour Nottshack hackathon. Find teammates, brainstorm project ideas, and learn the judging criteria.',
    startDateTime: '2026-09-27T10:00:00',
    endDateTime: '2026-09-27T12:00:00',
    location: 'Student Union, Main Hall',
    category: 'hackathon',
    rsvpCount: 76,
    agenda: [
      { time: '10:00 AM', title: 'Opening remarks & sponsor intro' },
      { time: '10:20 AM', title: 'Theme reveal & judging criteria' },
      { time: '10:35 AM', title: 'Team formation speed-round' },
      { time: '11:00 AM', title: 'Idea pitching (2 min per team)' },
      { time: '11:30 AM', title: 'Q&A with judges' },
      { time: '11:50 AM', title: 'Hackathon officially begins' },
    ],
  },
  {
    id: 'evt-007',
    title: 'Workshop: Web Dev with React',
    description:
      'Interactive workshop covering React fundamentals, hooks, and building your first component library with Tailwind CSS.',
    startDateTime: '2026-09-30T17:30:00',
    endDateTime: '2026-09-30T19:30:00',
    location: 'Computer Lab 3',
    category: 'workshop',
    rsvpCount: 40,
    agenda: [
      { time: '5:30 PM', title: 'Why React? A quick history' },
      { time: '5:45 PM', title: 'JSX, props, and state', description: 'Live-coded counter demo.' },
      { time: '6:15 PM', title: 'Hooks deep-dive: useState, useEffect' },
      { time: '6:45 PM', title: 'Build-along: mini to-do app' },
      { time: '7:20 PM', title: 'Tailwind styling & wrap up' },
    ],
  },
  {
    id: 'evt-008',
    title: 'OpenAI API Workshop',
    description:
      'Hands-on session building applications with the OpenAI API. Participants will build a simple chatbot and an image-generation tool during the session.',
    startDateTime: '2026-10-02T17:00:00',
    endDateTime: '2026-10-02T19:30:00',
    location: 'Computer Lab 3',
    category: 'workshop',
    rsvpCount: 48,
    agenda: [
      { time: '5:00 PM', title: 'Intro to LLMs & the OpenAI product suite' },
      { time: '5:25 PM', title: 'API authentication & rate limits', description: 'Setting up your dev environment.' },
      { time: '5:45 PM', title: 'Build 1: simple chatbot (chat completions API)' },
      { time: '6:30 PM', title: 'Build 2: image generator (DALL·E endpoint)' },
      { time: '7:10 PM', title: 'Prompt engineering tips' },
      { time: '7:20 PM', title: 'Q&A & next steps' },
    ],
  },
  {
    id: 'evt-009',
    title: 'Tech Talk: AI in Industry',
    description:
      'Guest speaker Dr. Nadia Osei from DeepMind discusses current trends, ethical considerations, and career paths in artificial intelligence.',
    startDateTime: '2026-10-03T16:00:00',
    endDateTime: '2026-10-03T17:30:00',
    location: 'Auditorium B',
    category: 'talk',
    rsvpCount: 90,
    agenda: [
      { time: '4:00 PM', title: 'Introduction of speaker' },
      { time: '4:05 PM', title: 'Talk: state of AI in industry' },
      { time: '4:45 PM', title: 'Career paths & advice for students' },
      { time: '5:05 PM', title: 'Audience Q&A' },
      { time: '5:25 PM', title: 'Networking & close' },
    ],
  },

  // ── October 2026 ────────────────────────────────────────────────────────────
  {
    id: 'evt-010',
    title: 'Nottshack26 — 48hr Hackathon',
    description:
      'The annual CS Society hackathon. 48 hours to build something remarkable. Prizes for Best Overall, Best Social Impact, and Best Beginner Project.',
    startDateTime: '2026-10-10T09:00:00',
    endDateTime: '2026-10-12T09:00:00',
    location: 'Student Union, Main Hall',
    category: 'hackathon',
    rsvpCount: 112,
    agenda: [
      { time: 'Sat 9:00 AM', title: 'Hacking begins' },
      { time: 'Sat 12:00 PM', title: 'Lunch provided' },
      { time: 'Sat 6:00 PM', title: 'Dinner & optional mini talks' },
      { time: 'Sun 9:00 AM', title: 'Hacking ends — submissions close' },
      { time: 'Sun 10:00 AM', title: 'Project demos to judges' },
      { time: 'Sun 12:00 PM', title: 'Award ceremony & close' },
    ],
  },
  {
    id: 'evt-011',
    title: 'Data Science Crash Course',
    description:
      'A two-hour introduction to data science using Python: pandas, matplotlib, and a walkthrough of a real Kaggle dataset.',
    startDateTime: '2026-10-14T17:00:00',
    endDateTime: '2026-10-14T19:00:00',
    location: 'Computer Lab 3',
    category: 'workshop',
    rsvpCount: 36,
    agenda: [
      { time: '5:00 PM', title: 'Python recap & notebook setup' },
      { time: '5:20 PM', title: 'Data wrangling with pandas' },
      { time: '5:50 PM', title: 'Visualisation with matplotlib & seaborn' },
      { time: '6:20 PM', title: 'Kaggle walkthrough: Titanic dataset' },
      { time: '6:50 PM', title: 'Next steps: ML intro' },
    ],
  },
];
