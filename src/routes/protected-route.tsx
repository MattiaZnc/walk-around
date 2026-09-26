import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { SchermataCaricamento } from '@/components/layout/schermata-caricamento';
import { useAuth } from '@/features/auth/api/auth-provider';

/**
 * Consente l'accesso solo con sessione valida. Reagisce a onAuthStateChange
 * tramite AuthProvider: se la sessione cade (logout o token non rinnovabile)
 * l'utente viene riportato al login conservando la pagina di partenza.
 */
export function ProtectedRoute() {
  const { inCaricamento, session, inRecuperoPassword } = useAuth();
  const location = useLocation();

  if (inCaricamento) {
    return <SchermataCaricamento messaggio="Verifica della sessione…" />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Sessione nata da un link di recupero: prima si sceglie la nuova password.
  if (inRecuperoPassword) {
    return <Navigate to="/reset-password" replace />;
  }

  return <Outlet />;
}
