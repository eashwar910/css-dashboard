import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useTheme } from '@/components/ThemeProvider';
import { Sidebar, type View } from '@/components/Sidebar';
import { HomeView } from '@/components/views/HomeView';
import { CalendarView } from '@/components/views/CalendarView';
import { TeamView } from '@/components/views/TeamView';
import { FinanceView } from '@/components/views/FinanceView';
import { Sun, Moon } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/AuthProvider';
import { LoginView } from '@/components/views/LoginView';
import { useAuth } from '@/hooks/useAuth';

const LOGIN_PATH = '/login';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ borderRadius: 0 }}
      className="fixed top-4 right-5 z-50 flex h-8 w-8 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

function Dashboard() {
  const [view, setView] = useState<View>('home');

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar currentView={view} onNavigate={setView} />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-5xl px-8 py-10 sm:px-12 lg:px-16">
          {view === 'home' && <HomeView onNavigate={setView} />}
          {view === 'calendar' && <CalendarView />}
          {view === 'team' && <TeamView />}
          {view === 'finance' && <FinanceView />}
        </div>
      </main>
    </div>
  );
}

/**
 * Route guard: signed-out users only ever see /login, signed-in users are
 * bounced off /login to the dashboard. Renders a neutral loading screen while
 * the initial session check runs so the login page never flashes.
 */
function AuthGate() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const onLogin = window.location.pathname === LOGIN_PATH;
    if (!session && !onLogin) window.history.replaceState(null, '', LOGIN_PATH);
    if (session && onLogin) window.history.replaceState(null, '', '/');
  }, [session, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return session ? <Dashboard /> : <LoginView />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
        <ThemeToggle />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
