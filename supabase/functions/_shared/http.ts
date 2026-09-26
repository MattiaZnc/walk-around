/** Utilità comuni alle Edge Function: CORS, risposte JSON, errori. */

export const intestazioniCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function rispostaPreflight(): Response {
  return new Response('ok', { headers: intestazioniCors });
}

export function rispostaJson(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...intestazioniCors, 'Content-Type': 'application/json' },
  });
}

export function rispostaErrore(messaggio: string, stato = 400): Response {
  return rispostaJson({ errore: messaggio }, stato);
}

/**
 * Timeout sulle chiamate esterne: senza questo una richiesta appesa consuma
 * tutto il tempo di esecuzione della funzione e l'utente resta a guardare.
 */
export async function fetchConTimeout(
  url: string,
  opzioni: RequestInit = {},
  millisecondi = 8000,
): Promise<Response> {
  const controllore = new AbortController();
  const timer = setTimeout(() => {
    controllore.abort();
  }, millisecondi);

  try {
    return await fetch(url, { ...opzioni, signal: controllore.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cache in memoria con scadenza. L'istanza della funzione è effimera, ma
 * durante una raffica di digitazioni (autocomplete) evita richieste ripetute
 * identiche al provider.
 */
export class CacheBreve<T> {
  private readonly voci = new Map<string, { valore: T; scadenza: number }>();

  constructor(
    private readonly durataMs = 5 * 60_000,
    private readonly massimo = 200,
  ) {}

  leggi(chiave: string): T | undefined {
    const voce = this.voci.get(chiave);
    if (!voce) return undefined;
    if (voce.scadenza < Date.now()) {
      this.voci.delete(chiave);
      return undefined;
    }
    return voce.valore;
  }

  scrivi(chiave: string, valore: T): void {
    if (this.voci.size >= this.massimo) {
      const piuVecchia = this.voci.keys().next().value;
      if (piuVecchia !== undefined) this.voci.delete(piuVecchia);
    }
    this.voci.set(chiave, { valore, scadenza: Date.now() + this.durataMs });
  }
}
