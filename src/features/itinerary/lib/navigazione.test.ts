import { describe, expect, it } from 'vitest';

import type { Geometria, Manovra } from '@/features/itinerary/api/percorsi.api';
import {
  destinazioneGuida,
  dispositivoApple,
  linkAppleMaps,
  linkGoogleMaps,
  preparaPercorso,
  proiettaSulPercorso,
  rientroCompletato,
  sogliaFuoriPercorso,
  statoGuida,
  testoManovra,
} from '@/features/itinerary/lib/navigazione';
import type { Stop } from '@/types/models';

// Percorso a L nel centro di Roma: verso est per ~830 m, poi verso nord per ~1 km.
const A = { lat: 41.9, lng: 12.48 };
const B = { lat: 41.9, lng: 12.49 };
const C = { lat: 41.909, lng: 12.49 };

const GEOMETRIA: Geometria = {
  type: 'LineString',
  coordinates: [
    [A.lng, A.lat],
    [B.lng, B.lat],
    [C.lng, C.lat],
  ],
};

function manovra(extra: Partial<Manovra>): Manovra {
  return {
    tipo: 'svolta',
    direzione: null,
    strada: '',
    uscita: null,
    lat: 0,
    lng: 0,
    progressivaM: 0,
    ...extra,
  };
}

const MANOVRE: Manovra[] = [
  manovra({ tipo: 'partenza', ...A, progressivaM: 0 }),
  manovra({
    tipo: 'svolta',
    direzione: 'sinistra',
    strada: 'Via del Corso',
    ...B,
    progressivaM: 829,
  }),
  manovra({ tipo: 'arrivo', ...C, progressivaM: 1830 }),
];

const percorso = preparaPercorso(GEOMETRIA, MANOVRE, 24);

/** Punto a metà del primo tratto, spostato verso nord di `metri`. */
function aMetaPrimoTratto(metri = 0) {
  return { lat: 41.9 + metri / 111_320, lng: 12.485, accuratezza: 10 };
}

describe('preparaPercorso', () => {
  it('converte in [lat, lng] e misura la lunghezza', () => {
    expect(percorso.punti[0]).toEqual([A.lat, A.lng]);
    expect(percorso.progressive).toHaveLength(3);
    expect(percorso.lunghezzaM).toBeGreaterThan(1800);
    expect(percorso.lunghezzaM).toBeLessThan(1860);
  });
});

describe('proiettaSulPercorso', () => {
  it('trova la posizione lungo il tracciato', () => {
    const { progressivaM, scostamentoM } = proiettaSulPercorso(percorso, aMetaPrimoTratto());
    expect(progressivaM).toBeGreaterThan(400);
    expect(progressivaM).toBeLessThan(430);
    expect(scostamentoM).toBeLessThan(1);
  });

  it('misura lo scostamento dalla strada', () => {
    const { scostamentoM } = proiettaSulPercorso(percorso, aMetaPrimoTratto(50));
    expect(scostamentoM).toBeGreaterThan(48);
    expect(scostamentoM).toBeLessThan(52);
  });

  it('su andata e ritorno non torna indietro sulla parte già fatta', () => {
    const andataRitorno = preparaPercorso({
      type: 'LineString',
      coordinates: [
        [A.lng, A.lat],
        [B.lng, B.lat],
        [A.lng, A.lat],
      ],
    });
    const vicinoAllaPartenza = { lat: A.lat, lng: A.lng + 0.0005 };

    // Senza storia la posizione combacia con l'inizio...
    expect(proiettaSulPercorso(andataRitorno, vicinoAllaPartenza).progressivaM).toBeLessThan(50);
    // ...ma se si è già oltre la metà, è il ritorno.
    expect(
      proiettaSulPercorso(andataRitorno, vicinoAllaPartenza, 900).progressivaM,
    ).toBeGreaterThan(1500);
  });
});

describe('statoGuida', () => {
  it('indica la prossima svolta e quanto manca', () => {
    const stato = statoGuida(percorso, aMetaPrimoTratto(), 'piedi');
    expect(stato.prossimaManovra?.tipo).toBe('svolta');
    expect(stato.allaManovraM).toBeGreaterThan(400);
    expect(stato.allaManovraM).toBeLessThan(430);
    expect(stato.rimanenteM).toBeGreaterThan(1400);
    expect(stato.rimanenteM).toBeLessThan(1440);
    expect(stato.fuoriPercorso).toBe(false);
  });

  it('stima il tempo rimanente in proporzione', () => {
    const stato = statoGuida(percorso, aMetaPrimoTratto(), 'piedi');
    // 24 minuti per ~1830 m: ne restano ~1415, quindi circa 18-19 minuti.
    expect(stato.rimanenteMin).toBeGreaterThanOrEqual(18);
    expect(stato.rimanenteMin).toBeLessThanOrEqual(19);
  });

  it('dopo la svolta indica l’arrivo', () => {
    const sulSecondoTratto = { lat: 41.905, lng: 12.49, accuratezza: 10 };
    const stato = statoGuida(percorso, sulSecondoTratto, 'piedi', 900);
    expect(stato.prossimaManovra?.tipo).toBe('arrivo');
  });

  it('considera fatta una svolta a pochi metri', () => {
    const quasiInB = { lat: 41.9, lng: 12.49 - 3 / 83_000, accuratezza: 10 };
    const stato = statoGuida(percorso, quasiInB, 'piedi');
    expect(stato.prossimaManovra?.tipo).toBe('arrivo');
  });

  it('tollera qualche metro di GPS ma riconosce chi esce di strada', () => {
    expect(statoGuida(percorso, aMetaPrimoTratto(25), 'piedi').fuoriPercorso).toBe(false);
    expect(statoGuida(percorso, aMetaPrimoTratto(100), 'piedi').fuoriPercorso).toBe(true);
  });

  it('in auto la soglia è più larga', () => {
    expect(statoGuida(percorso, aMetaPrimoTratto(50), 'piedi').fuoriPercorso).toBe(true);
    expect(statoGuida(percorso, aMetaPrimoTratto(50), 'auto').fuoriPercorso).toBe(false);
  });

  it('non dichiara fuori percorso chi ha un segnale più vago dello scostamento', () => {
    const vago = { ...aMetaPrimoTratto(80), accuratezza: 100 };
    expect(statoGuida(percorso, vago, 'piedi').fuoriPercorso).toBe(false);
  });

  it('su un percorso stimato non si è mai fuori percorso', () => {
    const stimato = preparaPercorso(GEOMETRIA, [], 20, true);
    expect(statoGuida(stimato, aMetaPrimoTratto(500), 'piedi').fuoriPercorso).toBe(false);
  });

  it('senza manovre dà comunque la distanza rimanente', () => {
    const senzaManovre = preparaPercorso(GEOMETRIA);
    const stato = statoGuida(senzaManovre, aMetaPrimoTratto(), 'auto');
    expect(stato.prossimaManovra).toBeNull();
    expect(stato.allaManovraM).toBeNull();
    expect(stato.rimanenteMin).toBeNull();
    expect(stato.rimanenteM).toBeGreaterThan(1400);
  });
});

describe('sogliaFuoriPercorso', () => {
  it('non scende mai sotto l’incertezza del segnale', () => {
    expect(sogliaFuoriPercorso('piedi', 10)).toBe(40);
    expect(sogliaFuoriPercorso('auto', 10)).toBe(60);
    expect(sogliaFuoriPercorso('piedi', 90)).toBe(90);
  });
});

describe('testoManovra', () => {
  it('compone il testo con la strada', () => {
    expect(testoManovra(manovra({ direzione: 'destra', strada: 'Via del Corso' }))).toBe(
      'Gira a destra in Via del Corso',
    );
    expect(testoManovra(manovra({ direzione: 'leggermente-sinistra' }))).toBe('Tieni la sinistra');
  });

  it('gestisce rotonde, inversioni e arrivo', () => {
    expect(testoManovra(manovra({ tipo: 'rotonda', uscita: 2, strada: 'Via Appia' }))).toBe(
      'Alla rotonda prendi la 2ª uscita verso Via Appia',
    );
    expect(testoManovra(manovra({ tipo: 'rotonda' }))).toBe('Entra nella rotonda');
    expect(testoManovra(manovra({ tipo: 'inversione' }))).toBe('Fai inversione');
    expect(testoManovra(manovra({ tipo: 'arrivo', strada: 'Via X' }))).toBe('Arrivo alla tappa');
    expect(testoManovra(manovra({ tipo: 'prosegui', strada: '' }))).toBe('Prosegui dritto');
    expect(testoManovra(manovra({ tipo: 'prosegui', strada: 'Via Nazionale' }))).toBe(
      'Prosegui su Via Nazionale',
    );
  });
});

function tappa(
  id: string,
  coordinate: { lat: number; lng: number } | null,
  extra: Partial<Stop> = {},
): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position: 1,
    label: id,
    address: null,
    lat: coordinate?.lat ?? null,
    lng: coordinate?.lng ?? null,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
    created_at: '2026-09-29T09:00:00Z',
    updated_at: '2026-09-29T09:00:00Z',
    ...extra,
  };
}

const RAGGIUNTA = { reached_at: '2026-09-29T10:00:00Z' };

describe('destinazioneGuida', () => {
  it('sceglie la prima tappa non raggiunta con coordinate', () => {
    const tappe = [
      tappa('casa', A, { is_start: true, ...RAGGIUNTA }),
      tappa('senza-coordinate', null),
      tappa('museo', B),
      tappa('bar', C),
    ];
    expect(destinazioneGuida(tappe, false)).toMatchObject({
      tappa: { id: 'museo' },
      rientro: false,
    });
  });

  it('finite le tappe riporta alla partenza, se previsto', () => {
    const tappe = [tappa('casa', A, RAGGIUNTA), tappa('museo', B, RAGGIUNTA)];
    expect(destinazioneGuida(tappe, true)).toMatchObject({ tappa: { id: 'casa' }, rientro: true });
    expect(destinazioneGuida(tappe, false)).toBeNull();
  });

  it('con la sola partenza non c’è rientro', () => {
    expect(destinazioneGuida([tappa('casa', A, RAGGIUNTA)], true)).toBeNull();
  });
});

describe('rientroCompletato', () => {
  it('scatta entro il raggio di arrivo', () => {
    expect(rientroCompletato(A, { lat: A.lat + 0.0003, lng: A.lng, accuratezza: 10 })).toBe(true);
    expect(rientroCompletato(A, { lat: A.lat + 0.003, lng: A.lng, accuratezza: 10 })).toBe(false);
  });
});

describe('collegamenti ai navigatori', () => {
  it('Google Maps con destinazione e mezzo', () => {
    const url = new URL(linkGoogleMaps(B, 'piedi'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('destination')).toBe('41.9,12.49');
    expect(url.searchParams.get('travelmode')).toBe('walking');
    expect(new URL(linkGoogleMaps(B, 'auto')).searchParams.get('travelmode')).toBe('driving');
  });

  it('Mappe Apple con destinazione e mezzo', () => {
    const url = new URL(linkAppleMaps(B, 'auto'));
    expect(url.searchParams.get('daddr')).toBe('41.9,12.49');
    expect(url.searchParams.get('dirflg')).toBe('d');
  });

  it('riconosce i dispositivi Apple', () => {
    expect(dispositivoApple('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
    expect(dispositivoApple('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(false);
  });
});
