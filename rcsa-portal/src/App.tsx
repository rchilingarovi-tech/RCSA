import { AppShell } from './components/layout/AppShell';
import { AppStoreProvider } from './state/AppStore';
import { ModalsProvider } from './state/ModalsProvider';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './components/auth/LoginPage';

// AuthProvider is the outermost seam (local auth now, server session after
// migration). When signed out we show the login page; when signed in, the RCSA
// store + modals wrap the shell so the RCSA pages share one data layer.
function AuthGate() {
  const { session } = useAuth();
  if (!session) return <LoginPage />;
  return (
    <AppStoreProvider>
      <ModalsProvider>
        <AppShell />
      </ModalsProvider>
    </AppStoreProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
