export interface Task {
  id: string;
  title: string;
  done: boolean;
  dueDate: string;
}

export interface EventItem {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  location?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  department: string;
  year: string;
}

export interface DocumentLink {
  id: string;
  title: string;
  description: string;
  icon: string;
  url: string;
}

export const documents: DocumentLink[] = [
  {
    id: 'doc1',
    title: 'Constitution',
    description: 'Official society bylaws and governance document',
    icon: 'ScrollText',
    url: '#',
  },
  {
    id: 'doc2',
    title: 'Meeting Minutes',
    description: 'Records from all general and executive meetings',
    icon: 'FileText',
    url: '#',
  },
  {
    id: 'doc3',
    title: 'Project Guidelines',
    description: 'Standards and procedures for society projects',
    icon: 'FolderKanban',
    url: '#',
  },
  {
    id: 'doc4',
    title: 'Resource Library',
    description: 'Shared learning materials and tutorials',
    icon: 'Library',
    url: '#',
  },
  {
    id: 'doc5',
    title: 'Budget Report',
    description: 'Current semester financial overview',
    icon: 'Wallet',
    url: '#',
  },
  {
    id: 'doc6',
    title: 'Event Templates',
    description: 'Reusable templates for planning events',
    icon: 'LayoutTemplate',
    url: '#',
  },
];

export const upcomingEvents: EventItem[] = [
  {
    id: 'evt1',
    title: 'Intro to Competitive Programming',
    start: '2026-09-24T18:00:00',
    end: '2026-09-24T20:00:00',
    description: 'A hands-on session covering basics of competitive programming. We will solve problems from Codeforces and discuss strategies for upcoming contests.',
    location: 'Engineering Building, Room 204',
  },
  {
    id: 'evt2',
    title: 'Hackathon Kickoff & Team Formation',
    start: '2026-09-27T10:00:00',
    end: '2026-09-27T12:00:00',
    description: 'Kickoff event for our annual 48-hour hackathon. Find teammates, brainstorm ideas, and learn the rules.',
    location: 'Student Union, Main Hall',
  },
  {
    id: 'evt3',
    title: 'Workshop: Web Dev with React',
    start: '2026-09-30T17:30:00',
    end: '2026-09-30T19:30:00',
    description: 'Interactive workshop covering React fundamentals, hooks, and building your first component library.',
    location: 'Computer Lab 3',
  },
  {
    id: 'evt4',
    title: 'Tech Talk: AI in Industry',
    start: '2026-10-03T16:00:00',
    end: '2026-10-03T17:30:00',
    description: 'Guest speaker from a leading AI company discusses current trends and career opportunities in artificial intelligence.',
    location: 'Auditorium B',
  },
];

export const monthlyEvents: EventItem[] = [
  ...upcomingEvents,
  {
    id: 'evt5',
    title: 'Game Night & Social',
    start: '2026-09-19T19:00:00',
    end: '2026-09-19T22:00:00',
    description: 'Casual game night with board games, video games, and pizza. Great opportunity to meet fellow members.',
    location: 'Lounge Area',
  },
  {
    id: 'evt6',
    title: 'Resume Review Session',
    start: '2026-09-16T15:00:00',
    end: '2026-09-16T17:00:00',
    description: 'Peer and mentor resume reviews. Bring a printed copy and get feedback from upperclassmen and alumni.',
    location: 'Career Services Center',
  },
  {
    id: 'evt7',
    title: 'General Body Meeting',
    start: '2026-09-12T18:30:00',
    end: '2026-09-12T19:30:00',
    description: 'Monthly general meeting covering society updates, upcoming events, and open floor for announcements.',
    location: 'Lecture Hall 1',
  },
  {
    id: 'evt8',
    title: 'Algorithms Study Group',
    start: '2026-09-22T16:00:00',
    end: '2026-09-22T18:00:00',
    description: 'Weekly study group focusing on data structures and algorithms. This week: graphs and dynamic programming.',
    location: 'Library Study Room 5',
  },
];

export const weeklyTasks: Task[] = [
  {
    id: 'task1',
    title: 'Finalize hackathon venue booking',
    done: true,
    dueDate: '2026-09-22',
  },
  {
    id: 'task2',
    title: 'Send newsletter to all members',
    done: false,
    dueDate: '2026-09-23',
  },
  {
    id: 'task3',
    title: 'Review project proposals from 3 teams',
    done: false,
    dueDate: '2026-09-24',
  },
  {
    id: 'task4',
    title: 'Update society social media pages',
    done: false,
    dueDate: '2026-09-25',
  },
  {
    id: 'task5',
    title: 'Prepare budget presentation for dean',
    done: false,
    dueDate: '2026-09-26',
  },
  {
    id: 'task6',
    title: 'Confirm guest speaker for AI tech talk',
    done: true,
    dueDate: '2026-09-21',
  },
  {
    id: 'task7',
    title: 'Order catering for workshop event',
    done: false,
    dueDate: '2026-09-28',
  },
];

export const teamMembers: TeamMember[] = [
  {
    id: 'tm1',
    name: 'Alex Chen',
    role: 'President',
    email: 'alex.chen@university.edu',
    department: 'Computer Science',
    year: 'Senior',
  },
  {
    id: 'tm2',
    name: 'Priya Patel',
    role: 'Vice President',
    email: 'priya.patel@university.edu',
    department: 'Computer Science',
    year: 'Junior',
  },
  {
    id: 'tm3',
    name: 'Marcus Johnson',
    role: 'Lead Developer',
    email: 'marcus.j@university.edu',
    department: 'Software Engineering',
    year: 'Senior',
  },
  {
    id: 'tm4',
    name: 'Sofia Rodriguez',
    role: 'Event Coordinator',
    email: 'sofia.r@university.edu',
    department: 'Information Systems',
    year: 'Junior',
  },
  {
    id: 'tm5',
    name: 'Kevin Park',
    role: 'Treasurer',
    email: 'kevin.park@university.edu',
    department: 'Computer Science',
    year: 'Sophomore',
  },
  {
    id: 'tm6',
    name: 'Aisha Mohammed',
    role: 'Marketing Lead',
    email: 'aisha.m@university.edu',
    department: 'Graphic Design',
    year: 'Junior',
  },
  {
    id: 'tm7',
    name: 'Daniel Kim',
    role: 'Webmaster',
    email: 'daniel.kim@university.edu',
    department: 'Computer Science',
    year: 'Sophomore',
  },
  {
    id: 'tm8',
    name: 'Emma Williams',
    role: 'Outreach Coordinator',
    email: 'emma.w@university.edu',
    department: 'Communications',
    year: 'Freshman',
  },
];
