import { AuthError, type PostgrestError } from '@supabase/supabase-js';

/**
 * Errore applicativo con messaggio già pronto per l'utente (in italiano).
 * Tutti gli errori che arrivano all'UI passano da qui: i componenti non
 * interpretano mai i codici di Supabase.
 */
export class AppError extends Error {
  readonly code: string;
  override readonly cause?: unknown;

  constructor(message: string, code = 'unknown', cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

const MESSAGGI_AUTH: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti.',
  invalid_grant: 'Email o password non corretti.',
  email_not_confirmed: 'Questo indirizzo email non è ancora stato confermato.',
  user_not_found: 'Nessun account associato a questa email.',
  over_request_rate_limit: 'Troppi tentativi: riprova tra qualche minuto.',
  over_email_send_rate_limit: 'Troppe email inviate: riprova tra qualche minuto.',
  same_password: 'La nuova password deve essere diversa da quella attuale.',
  weak_password: 'La password è troppo debole: usa almeno 8 caratteri.',
  session_expired: 'La sessione è scaduta: accedi di nuovo.',
  signup_disabled: 'La registrazione è disabilitata: chiedi un account all’amministratore.',
  email_provider_disabled:
    'L’accesso con email è disattivato nel progetto Supabase: va riattivato dall’amministratore.',
  user_banned: 'Questo account è sospeso: contatta l’amministratore.',
  email_address_invalid: 'Indirizzo email non valido.',
  validation_failed: 'Dati non validi: controlla email e password.',
};

const MESSAGGI_POSTGREST: Record<string, string> = {
  '23505': 'Esiste già un elemento con questi dati.',
  '23503': 'Elemento collegato non trovato: ricarica la pagina e riprova.',
  '23514': 'Valore non valido: controlla i dati inseriti.',
  '42501': 'Non hai i permessi per questa operazione.',
  PGRST116: 'Elemento non trovato.',
  PGRST301: 'La sessione è scaduta: accedi di nuovo.',
};

function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'code' in value &&
    'details' in value
  );
}

/** Converte qualsiasi errore in un AppError con messaggio leggibile. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof AuthError) {
    const code = error.code ?? 'auth_error';
    return new AppError(MESSAGGI_AUTH[code] ?? error.message, code, error);
  }

  if (isPostgrestError(error)) {
    return new AppError(
      MESSAGGI_POSTGREST[error.code] ?? 'Errore durante il salvataggio dei dati.',
      error.code,
      error,
    );
  }

  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    return new AppError('Connessione non disponibile: controlla la rete.', 'network', error);
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'unknown', error);
  }

  return new AppError('Si è verificato un errore inatteso.', 'unknown', error);
}

/** Messaggio pronto per toast/alert. */
export function messaggioErrore(error: unknown): string {
  return toAppError(error).message;
}
