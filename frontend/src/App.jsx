import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import { TOKENS } from './styles/tokens';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SearchPage } from './pages/SearchPage';
import { DevicesPage } from './pages/DevicesPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReportPage } from './pages/ReportPage';

function AppShell() {
  const { currentUser: user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [searchPreset, setSearchPreset] = useState(null);

  useEffect(() => {
    if (searchPreset) setPage('search');
  }, [searchPreset]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: TOKENS.bg }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${TOKENS.border}`, borderTop: `3px solid ${TOKENS.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const navigateTo = (target, preset = null) => {
    if (preset) setSearchPreset(preset);
    else setSearchPreset(null);
    setPage(target);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage onNavigate={navigateTo} />;
      case 'search':    return <SearchPage preset={searchPreset} onPresetConsumed={() => setSearchPreset(null)} />;
      case 'devices':   return <DevicesPage onNavigate={navigateTo} />;
      case 'users':     return <UsersPage />;
      case 'settings':  return <SettingsPage onNavigate={navigateTo} />;
      case 'reports':   return <ReportPage />;
      default:          return <DashboardPage onNavigate={navigateTo} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: TOKENS.bg, color: TOKENS.text, fontFamily: TOKENS.font, overflow: 'hidden' }}>
      <Sidebar currentPage={page} onNavigate={(p) => navigateTo(p)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LangProvider>
  );
}
