import { useState, useMemo } from 'react';
import { Mail, GraduationCap, Briefcase, Search, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamMembers } from '@/hooks/useTeamMembers';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TeamView() {
  const { data: members, byDepartment, byYear, isLoading, error } = useTeamMembers();

  // Dynamic stats derived from actual mock data array
  const departmentCount = Object.keys(byDepartment).length;
  const yearGroupCount = Object.keys(byYear).length;
  const roleCount = new Set(members.map((m) => m.role)).size;

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Dynamic lists of unique departments and years from data
  const departments = useMemo(() => {
    return Object.keys(byDepartment).sort();
  }, [byDepartment]);

  const years = useMemo(() => {
    return Object.keys(byYear).sort();
  }, [byYear]);

  // Combined client-side filtering
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesName =
        !searchQuery.trim() ||
        member.name.toLowerCase().includes(searchQuery.trim().toLowerCase());

      const matchesDepartment =
        selectedDepartment === 'all' || member.department === selectedDepartment;

      const matchesYear =
        selectedYear === 'all' || member.year === selectedYear;

      return matchesName && matchesDepartment && matchesYear;
    });
  }, [members, searchQuery, selectedDepartment, selectedYear]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedDepartment !== 'all' || selectedYear !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('all');
    setSelectedYear('all');
  };

  return (
    <div className="space-y-12 sm:space-y-14">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
          Team Directory
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Meet the executive board and coordinators of the CS Society.
        </p>
      </header>

      {/* ── Error Banner if any ──────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Couldn&apos;t load team directory — try refreshing.</span>
        </div>
      )}

      {/* ── KPI row — pull-quote numbers derived from mock data ─────── */}
      <section className="border-b border-border pb-10">
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
          {[
            { value: members.length, label: 'Members' },
            { value: departmentCount, label: 'Departments' },
            { value: yearGroupCount, label: 'Year Groups' },
            { value: roleCount, label: 'Roles' },
          ].map(({ value, label }) => (
            <div key={label}>
              {isLoading ? (
                <Skeleton className="h-12 w-16 mb-1" />
              ) : (
                <p className="stat-number text-5xl font-semibold text-primary leading-none">
                  {value}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team table & filters ──────────────────────────────────────── */}
      <section className="space-y-4">
        {/* Section title & Filter controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-lg font-semibold">Members</h2>
            <span className="text-xs text-muted-foreground">
              {isLoading
                ? 'Loading...'
                : `${filteredMembers.length} ${filteredMembers.length === 1 ? 'member' : 'members'}${
                    hasActiveFilters ? ` (filtered from ${members.length})` : ''
                  }`}
            </span>
          </div>

          {/* Search and Dropdown Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ borderRadius: 0 }}
                className="h-8 border-border bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search query"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Department dropdown */}
            <div className="w-full sm:w-44">
              <Select
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
              >
                <SelectTrigger
                  style={{ borderRadius: 0 }}
                  className="h-8 text-xs border-border bg-background"
                >
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent style={{ borderRadius: 0 }}>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year dropdown */}
            <div className="w-full sm:w-32">
              <Select
                value={selectedYear}
                onValueChange={setSelectedYear}
              >
                <SelectTrigger
                  style={{ borderRadius: 0 }}
                  className="h-8 text-xs border-border bg-background"
                >
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent style={{ borderRadius: 0 }}>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground hover:text-foreground underline px-1 py-1 whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table header (desktop only, hidden on mobile below 640px) */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 border-b border-border py-2 text-xs text-muted-foreground">
          <span>Name &amp; Role</span>
          <span>Department</span>
          <span>Year</span>
          <span>Contact</span>
        </div>

        {/* Rows & Skeletons */}
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] items-start sm:items-center gap-3 sm:gap-x-6 py-3.5"
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Skeleton className="h-7 w-7 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="hidden sm:block h-3.5 w-28" />
                <Skeleton className="hidden sm:block h-3.5 w-16" />
                <Skeleton className="h-3.5 w-12" />
              </div>
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {hasActiveFilters
              ? 'No team members match your search and filter criteria.'
              : 'No team members found in directory.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                /* Responsive degradation: stacked card on < 640px, tabular row on >= 640px */
                className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center gap-y-2.5 sm:gap-x-6 py-3.5 transition-colors hover:bg-secondary/40"
              >
                {/* Name + initials + role + mobile contact */}
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center border border-border text-[11px] font-semibold text-muted-foreground"
                    >
                      {getInitials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{member.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>

                  {/* Mobile-only contact button */}
                  <a
                    href={`mailto:${member.email}`}
                    className="flex sm:hidden items-center gap-1 border border-border px-2 py-1 text-xs text-primary hover:bg-muted/20"
                    aria-label={`Email ${member.name}`}
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span>Email</span>
                  </a>
                </div>

                {/* Mobile stacked badges for department & year */}
                <div className="flex sm:hidden items-center gap-3 text-xs text-muted-foreground pl-10">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3 shrink-0" />
                    <span>{member.department}</span>
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3 shrink-0" />
                    <span>{member.year}</span>
                  </span>
                </div>

                {/* Desktop: Department */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  <span>{member.department}</span>
                </div>

                {/* Desktop: Year */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  <span>{member.year}</span>
                </div>

                {/* Desktop: Contact link */}
                <a
                  href={`mailto:${member.email}`}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-primary hover:underline"
                  aria-label={`Email ${member.name}`}
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  <span>Email</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
