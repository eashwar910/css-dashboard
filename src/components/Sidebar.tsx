import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Code2, Home, CalendarDays, Users, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export type View = 'home' | 'calendar' | 'team';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'calendar', label: 'Calendar & Events', icon: CalendarDays },
  { id: 'team', label: 'Team Directory', icon: Users },
];

function SidebarContent({
  currentView,
  onNavigate,
}: {
  currentView: View;
  onNavigate: (view: View) => void;
}) {
  const { user, member, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Masthead */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-serif text-base font-semibold tracking-tight">CS Society</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground pl-6">Workspace</p>
      </div>

      {/* Navigation — plain text links, no icons in active state */}
      <nav className="flex-1 px-4 py-6">
        <p className="mb-3 text-xs text-muted-foreground">Navigation</p>
        <ul className="space-y-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <li key={item.id} className="rule">
                <button
                  onClick={() => onNavigate(item.id)}
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
          {/* closing hairline */}
          <li className="rule" />
        </ul>
      </nav>

      {/* Footer — signed-in member + log out (theme toggle is global) */}
      <div className="border-t border-border px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member?.full_name ?? user?.email}</p>
          {member?.role && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.role}</p>
          )}
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Log Out
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — no background elevation, just a right hairline */}
      <aside className="hidden w-56 shrink-0 border-r border-border lg:block">
        <SidebarContent currentView={currentView} onNavigate={onNavigate} />
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-5 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <span className="font-serif text-sm font-semibold">CS Society</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-0">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <div className="absolute right-4 top-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarContent
              currentView={currentView}
              onNavigate={(v) => {
                onNavigate(v);
                setMobileOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
