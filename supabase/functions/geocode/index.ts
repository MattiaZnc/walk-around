/**
 * geocode — cerca luoghi e indirizzi per l'autocompletamento.
 *
 * Risponde sia a nomi di luoghi ("Colosseo") sia a indirizzi
 * ("Via Roma 1, Milano"). La chiamata passa da qui e non dal browser così la
 * scelta del provider (ed eventuali chiavi) resta lato server.
 */
import { CacheBreve, rispostaErrore, rispostaJson, rispostaPreflight } from '../_shared/http.ts';
import { providerLuoghiInOrdine } from '../_shared/providers/luoghi.ts';
import type { Luogo, RispostaGeocoding } from '../_shared/tipi.ts';

const LUNGHEZZA_MINIMA = 3;
const cache = new CacheBreve<{ luoghi: Luogo[]; provider: string }>(10 * 60_000, 200);

type RichiestaGeocoding = {
  testo?: string;
  /** Punto di riferimento facoltativo per dare priorità ai risultati vicini. */
  vicinoA?: { lat: number; lng: number };
};

Deno.serve(async (richiesta) => {
  if (richiesta.method === 'OPTIONS') return rispostaPreflight();
  if (richiesta.method !== 'POST') return rispostaErrore('Metodo non consentito', 405);

  let corpo: RichiestaGeocoding;
  try {
    corpo = (await richiesta.json()) as RichiestaGeocoding;
  } catch {
    return rispostaErrore('Corpo della richiesta non è JSON valido');
  }

  const testo = corpo.testo?.trim() ?? '';
  if (testo.length < LUNGHEZZA_MINIMA) {
    // Meno di tre caratteri produce risultati inutili e spreca richieste.
    const vuota: RispostaGeocoding = { luoghi: [], provider: 'nessuno' };
    return rispostaJson(vuota);
  }

  const vicinoA =
    corpo.vicinoA &&
    Number.isFinite(corpo.vicinoA.lat) &&
    Number.isFinite(corpo.vicinoA.lng)
      ? corpo.vicinoA
      : undefined;

  const chiave = `${testo.toLowerCase()}|${vicinoA ? `${vicinoA.lat.toFixed(2)},${vicinoA.lng.toFixed(2)}` : ''}`;
  const inCache = cache.leggi(chiave);
  if (inCache) return rispostaJson(inCache satisfies RispostaGeocoding);

  const problemi: string[] = [];

  for (const provider of providerLuoghiInOrdine()) {
    try {
      const luoghi = await provider.cerca(testo, vicinoA);
      const risposta: RispostaGeocoding = { luoghi, provider: provider.nome };
      // Anche un elenco vuoto va in cache: ripetere la stessa ricerca senza
      // risultati non cambierebbe nulla.
      cache.scrivi(chiave, risposta);
      return rispostaJson(risposta);
    } catch (errore) {
      problemi.push(`${provider.nome}: ${errore instanceof Error ? errore.message : 'errore'}`);
    }
  }

  console.error('Geocoding non disponibile', problemi);
  return rispostaErrore('Ricerca indirizzi momentaneamente non disponibile', 503);
});
