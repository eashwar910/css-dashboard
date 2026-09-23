import { useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Sidebar, type View } from '@/components/Sidebar';
import { HomeView } from '@/components/views/HomeView';
import { CalendarView } from '@/components/views/CalendarView';
import { TeamView } from '@/components/views/TeamView';

function App() {
  const [view, setView] = useState<View>('home');

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {view === 'home' && <HomeView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'team' && <TeamView />}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
