import { useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useTheme } from '@/components/ThemeProvider';
import { Sidebar, type View } from '@/components/Sidebar';
import { HomeView } from '@/components/views/HomeView';
import { CalendarView } from '@/components/views/CalendarView';
import { TeamView } from '@/components/views/TeamView';
import { Sun, Moon } from 'lucide-react';

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

function App() {
  const [view, setView] = useState<View>('home');

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-5xl px-8 py-10 sm:px-12 lg:px-16">
            {view === 'home' && <HomeView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'team' && <TeamView />}
          </div>
        </main>
        <ThemeToggle />
      </div>
    </ThemeProvider>
  );
}

export default App;
