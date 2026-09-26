/**
 * calculate-route — distanza, durata e geometria fra coppie di coordinate.
 *
 * Perché sta qui e non nel browser:
 *  - l'eventuale ORS_API_KEY resta lato server (nel frontend finirebbe nel bundle);
 *  - il provider si può cambiare senza rilasciare una nuova versione dell'app.
 *
 * Non fallisce mai del tutto: se i provider esterni non rispondono, restituisce
 * una stima marcata con isEstimate, così l'utente può proseguire e correggere
 * il valore a mano.
 */
import { coordinataValida } from '../_shared/geo.ts';
import { CacheBreve, rispostaErrore, rispostaJson, rispostaPreflight } from '../_shared/http.ts';
import { providerInOrdine, type Profilo } from '../_shared/providers/percorsi.ts';
import type { RichiestaPercorso, RispostaPercorso, Tratto } from '../_shared/tipi.ts';

const MASSIMO_COPPIE = 25;
const cache = new CacheBreve<Tratto>(10 * 60_000, 300);

function chiaveCache(
  da: { lat: number; lng: number },
  a: { lat: number; lng: number },
  profilo: Profilo,
): string {
  const arrotonda = (valore: number) => valore.toFixed(5);
  return `${profilo}:${arrotonda(da.lat)},${arrotonda(da.lng)}->${arrotonda(a.lat)},${arrotonda(a.lng)}`;
}

function profiloValido(valore: string | undefined): Profilo {
  return valore === 'piedi' || valore === 'bici' ? valore : 'auto';
}

Deno.serve(async (richiesta) => {
  if (richiesta.method === 'OPTIONS') return rispostaPreflight();
  if (richiesta.method !== 'POST') return rispostaErrore('Metodo non consentito', 405);

  let corpo: RichiestaPercorso;
  try {
    corpo = (await richiesta.json()) as RichiestaPercorso;
  } catch {
    return rispostaErrore('Corpo della richiesta non è JSON valido');
  }

  const coppie = corpo.coppie;
  if (!Array.isArray(coppie) || coppie.length === 0) {
    return rispostaErrore('Serve almeno una coppia di coordinate');
  }
  if (coppie.length > MASSIMO_COPPIE) {
    return rispostaErrore(`Massimo ${MASSIMO_COPPIE} tratte per richiesta`);
  }

  const profilo = profiloValido(corpo.profilo);
  const provider = providerInOrdine();

  const tratti = await Promise.all(
    coppie.map(async (coppia) => {
      if (!coordinataValida(coppia?.from) || !coordinataValida(coppia?.to)) {
        return { errore: 'Coordinate mancanti o non valide' };
      }

      const chiave = chiaveCache(coppia.from, coppia.to, profilo);
      const inCache = cache.leggi(chiave);
      if (inCache) return inCache;

      const problemi: string[] = [];

      // I provider vengono provati in ordine: il primo che risponde vince.
      for (const candidato of provider) {
        try {
          const tratto = await candidato.calcola(coppia.from, coppia.to, profilo);
          cache.scrivi(chiave, tratto);
          return tratto;
        } catch (errore) {
          problemi.push(`${candidato.nome}: ${errore instanceof Error ? errore.message : 'errore'}`);
        }
      }

      console.error('Nessun provider ha risposto', problemi);
      return { errore: 'Nessun servizio di calcolo percorsi disponibile' };
    }),
  );

  const risposta: RispostaPercorso = { tratti };
  return rispostaJson(risposta);
});
