import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import * as React from 'react';

import { supabase } from '@/lib/supabaseClient';

type StatoAuth = {
  /** true finché non sappiamo se esiste una sessione (evita flash del login). */
  inCaricamento: boolean;
  session: Session | null;
  user: User | null;
  /**
   * true quando la sessione attiva arriva da un link di recupero password:
   * l'utente è "tecnicamente" autenticato ma deve prima scegliere la password.
   */
  inRecuperoPassword: boolean;
  fineRecuperoPassword: () => void;
};

const AuthContext = React.createContext<StatoAuth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = React.useState<Session | null>(null);
  const [inCaricamento, setInCaricamento] = React.useState(true);
  const [inRecuperoPassword, setInRecuperoPassword] = React.useState(false);

  React.useEffect(() => {
    let attivo = true;

    // Sessione iniziale (da localStorage o dall'URL del link email).
    void supabase.auth.getSession().then(({ data }) => {
      if (!attivo) return;
      setSession(data.session);
      setInCaricamento(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((evento, nuovaSessione) => {
      setSession(nuovaSessione);
      setInCaricamento(false);

      switch (evento) {
        case 'PASSWORD_RECOVERY':
          setInRecuperoPassword(true);
          break;
        case 'SIGNED_OUT':
          setInRecuperoPassword(false);
          // I dati in cache appartengono all'utente uscito: via tutto.
          queryClient.clear();
          break;
        case 'SIGNED_IN':
          queryClient.invalidateQueries().catch(() => {
            // invalidazione best-effort: un errore qui non deve bloccare il login
          });
          break;
        default:
          break;
      }
    });

    return () => {
      attivo = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const fineRecuperoPassword = React.useCallback(() => {
    setInRecuperoPassword(false);
  }, []);

  const valore = React.useMemo<StatoAuth>(
    () => ({
      inCaricamento,
      session,
      user: session?.user ?? null,
      inRecuperoPassword,
      fineRecuperoPassword,
    }),
    [inCaricamento, session, inRecuperoPassword, fineRecuperoPassword],
  );

  return <AuthContext.Provider value={valore}>{children}</AuthContext.Provider>;
}

export function useAuth(): StatoAuth {
  const contesto = React.useContext(AuthContext);
  if (!contesto) throw new Error('useAuth richiede <AuthProvider>');
  return contesto;
}

/** Utente autenticato garantito: usabile solo dentro le route protette. */
export function useUtenteCorrente(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUtenteCorrente usato fuori da una route protetta');
  return user;
}
