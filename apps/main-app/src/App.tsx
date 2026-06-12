import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SocialCallbackPage } from './pages/SocialCallbackPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <h2>Worknity に接続中...</h2>
        <p style={{ color: 'var(--text-muted)' }}>セッションを読み込んでいます。</p>
      </div>
    );
  }

  // Simple client-side router based on URL pathname
  if (window.location.pathname === '/social-callback') {
    return <SocialCallbackPage />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <DashboardPage />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
