import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Code2, Home, CalendarDays, Users, Menu, Sun, Moon, X } from 'lucide-react';

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
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
          <Code2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">CS Society</p>
          <p className="text-xs text-muted-foreground">Workspace</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {theme === 'dark' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            <span>{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
          </div>
          <button
            onClick={toggleTheme}
            className="relative h-6 w-11 rounded-full bg-secondary transition-colors"
            aria-label="Toggle theme"
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow transition-transform',
                theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <SidebarContent currentView={currentView} onNavigate={onNavigate} />
      </aside>

      {/* Mobile header with hamburger */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">CS Society</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
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
