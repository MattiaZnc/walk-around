import type { Session, User } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';

/** Percorso della pagina che gestisce il link di reset ricevuto per email. */
export const PERCORSO_RESET = '/reset-password';

export async function accedi(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAppError(error);
  return data.session;
}

export async function esci(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toAppError(error);
}

export async function richiediResetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${PERCORSO_RESET}`,
  });
  if (error) throw toAppError(error);
}

/** Imposta una nuova password usando la sessione di recupero già attiva. */
export async function impostaNuovaPassword(password: string): Promise<User> {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw toAppError(error);
  return data.user;
}

/**
 * Cambio password da utente autenticato: Supabase non chiede la password
 * attuale, quindi la verifichiamo noi con un re-login prima di aggiornare.
 */
export async function cambiaPassword(
  email: string,
  passwordAttuale: string,
  nuovaPassword: string,
): Promise<void> {
  const { error: erroreVerifica } = await supabase.auth.signInWithPassword({
    email,
    password: passwordAttuale,
  });
  if (erroreVerifica) {
    throw new AppError(
      'La password attuale non è corretta.',
      'invalid_credentials',
      erroreVerifica,
    );
  }

  const { error } = await supabase.auth.updateUser({ password: nuovaPassword });
  if (error) throw toAppError(error);
}

export async function sessioneCorrente(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw toAppError(error);
  return data.session;
}
