import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { SchermataCaricamento } from '@/components/layout/schermata-caricamento';
import { useAuth } from '@/features/auth/api/auth-provider';

type StatoPrecedente = { from?: { pathname?: string } };

/**
 * /login e /reset-password: se c'e' gia' una sessione l'utente va all'app.
 * Eccezione: durante il recupero password la sessione esiste ma serve restare
 * qui per impostare la nuova password.
 */
export function PublicOnlyRoute() {
  const { inCaricamento, session, inRecuperoPassword } = useAuth();
  const location = useLocation();

  if (inCaricamento) {
    return <SchermataCaricamento messaggio="Caricamento…" />;
  }

  if (session && !inRecuperoPassword) {
    const stato = location.state as StatoPrecedente | null;
    const destinazione = stato?.from?.pathname ?? '/';
    return <Navigate to={destinazione} replace />;
  }

  return <Outlet />;
}
