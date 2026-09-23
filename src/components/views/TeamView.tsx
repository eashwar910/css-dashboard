import { Mail, GraduationCap, Briefcase } from 'lucide-react';
import { teamMembers } from '@/data/mockData';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TeamView() {
  return (
    <div className="space-y-14">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
          Team Directory
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Meet the executive board and coordinators of the CS Society.
        </p>
      </header>

      {/* ── KPI row — pull-quote numbers, no cards ───────────────────── */}
      <section className="border-b border-border pb-10">
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
          {[
            { value: teamMembers.length, label: 'Members' },
            { value: 4, label: 'Departments' },
            { value: 4, label: 'Year Groups' },
            { value: 8, label: 'Roles' },
          ].map(({ value, label }) => (
            <div key={label}>
              {/* Large serif number — pull-quote style */}
              <p className="stat-number text-5xl font-semibold text-primary leading-none">
                {value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team table ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 border-b border-border pb-2">
          <h2 className="font-serif text-lg font-semibold">Members</h2>
        </div>

        {/* Table header row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 border-b border-border py-2 text-xs text-muted-foreground">
          <span>Name & Role</span>
          <span className="hidden sm:block">Department</span>
          <span className="hidden sm:block">Year</span>
          <span>Contact</span>
        </div>

        {/* Table rows — hairline dividers, no alternating backgrounds */}
        <div className="divide-y divide-border">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 py-3.5 transition-colors hover:bg-secondary/40"
            >
              {/* Name + role */}
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{member.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{member.role}</p>
              </div>

              {/* Department */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3 shrink-0" />
                <span>{member.department}</span>
              </div>

              {/* Year */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span>{member.year}</span>
              </div>

              {/* Contact — plain text link */}
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                aria-label={`Email ${member.name}`}
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">Email</span>
              </a>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
