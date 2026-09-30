import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import {
  Code2,
  Home,
  CalendarRange,
  ListChecks,
  NotebookPen,
  Users,
  Wallet,
  Handshake,
  Menu,
  LogOut,
  Sun,
  Moon,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';

export type View = 'home' | 'weekly' | 'events' | 'meetings' | 'team' | 'finance' | 'external';

interface NavbarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  /** Search across events, docs and members; results show on Home. */
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const navItems: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'weekly', label: 'Weekly', icon: ListChecks },
  { id: 'events', label: 'Events', icon: CalendarRange },
  { id: 'meetings', label: 'Meetings', icon: NotebookPen },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'external', label: 'External Relations', icon: Handshake },
];

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ borderRadius: 0 }}
      className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function SearchBox({ value, onChange, className }: { value: string; onChange: (query: string) => void; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search events, docs, members..."
        aria-label="Search events, docs and members"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ borderRadius: 0 }}
        className="h-8 border-border bg-background pl-8 pr-7 text-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Navbar({ currentView, onNavigate, searchQuery, onSearchChange }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, member, signOut } = useAuth();
  const displayName = member?.full_name ?? user?.email;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-3 px-5 sm:px-6 lg:gap-8">
        {/* Masthead */}
        <div className="flex shrink-0 items-center gap-2">
          <Code2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-serif text-base font-semibold tracking-tight">CS Society</span>
        </div>

        {/* Desktop navigation — plain text links, active one underlined */}
        <nav className="hidden h-full flex-1 lg:block">
          <ul className="flex h-full items-stretch gap-4 xl:gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      '-mb-px flex h-full items-center gap-2 whitespace-nowrap border-b-2 text-sm transition-colors',
                      active
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="hidden h-3.5 w-3.5 shrink-0 opacity-60 2xl:block" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Desktop search + account — signed-in member, log out, theme toggle */}
        <div className="hidden shrink-0 items-center gap-4 lg:flex">
          <SearchBox value={searchQuery} onChange={onSearchChange} className="w-44" />
          <div className="hidden min-w-0 max-w-[12rem] text-right xl:block">
            <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
            {member?.role && (
              <p className="truncate text-xs text-muted-foreground">{member.role}</p>
            )}
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Log out"
            title="Log out"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <ThemeToggleButton />
        </div>

        {/* Mobile: search, theme toggle + menu */}
        <SearchBox value={searchQuery} onChange={onSearchChange} className="ml-auto min-w-0 max-w-xs flex-1 lg:hidden" />
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggleButton />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="p-0">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <nav className="px-5 pb-2 pt-12">
                <ul>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = currentView === item.id;
                    return (
                      <li key={item.id} className="rule">
                        <button
                          onClick={() => {
                            onNavigate(item.id);
                            setMobileOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 py-2.5 text-sm transition-colors text-left',
                            active
                              ? 'text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                  <li className="rule" />
                </ul>
              </nav>
              <div className="px-5 py-4">
                <p className="truncate text-sm font-medium">{displayName}</p>
                {member?.role && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.role}</p>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-3 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  Log Out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
