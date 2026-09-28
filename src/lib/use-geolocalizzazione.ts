import { useEffect, useRef, useState } from 'react';

import type { Posizione } from '@/features/itinerary/lib/prossimita';

export type StatoGeolocalizzazione = {
  posizione: Posizione | null;
  /** Messaggio già in italiano, pronto da mostrare. */
  errore: string | null;
  /** true finché non è arrivata la prima posizione. */
  inAttesa: boolean;
  supportata: boolean;
};

const MESSAGGI: Record<number, string> = {
  1: 'Permesso negato: consenti l’accesso alla posizione nelle impostazioni del browser.',
  2: 'Posizione non disponibile: prova a uscire all’aperto o attiva il GPS.',
  3: 'Il rilevamento della posizione sta impiegando troppo tempo.',
};

/**
 * Segue la posizione del dispositivo mentre `attiva` è true.
 *
 * L'ascolto parte solo su richiesta esplicita: `watchPosition` con alta
 * precisione tiene acceso il GPS e la batteria si consuma in fretta, quindi
 * non è qualcosa da lasciare attivo mentre si pianifica la giornata.
 */
export function useGeolocalizzazione(attiva: boolean): StatoGeolocalizzazione {
  const supportata = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const [posizione, setPosizione] = useState<Posizione | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inAttesa, setInAttesa] = useState(false);
  const identificativo = useRef<number | null>(null);

  useEffect(() => {
    if (!attiva || !supportata) {
      setInAttesa(false);
      return;
    }

    setInAttesa(true);
    setErrore(null);

    identificativo.current = navigator.geolocation.watchPosition(
      (rilevamento) => {
        setPosizione({
          lat: rilevamento.coords.latitude,
          lng: rilevamento.coords.longitude,
          accuratezza: Math.round(rilevamento.coords.accuracy),
        });
        setErrore(null);
        setInAttesa(false);
      },
      (problema) => {
        setErrore(MESSAGGI[problema.code] ?? 'Impossibile leggere la posizione.');
        setInAttesa(false);
      },
      {
        enableHighAccuracy: true,
        // Una posizione vecchia di più di dieci secondi non dice dove sei
        // adesso, se ti stai muovendo.
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );

    return () => {
      if (identificativo.current !== null) {
        navigator.geolocation.clearWatch(identificativo.current);
        identificativo.current = null;
      }
    };
  }, [attiva, supportata]);

  // Spegnendo l'ascolto la posizione precedente non è più attendibile.
  useEffect(() => {
    if (!attiva) setPosizione(null);
  }, [attiva]);

  return { posizione, errore, inAttesa, supportata };
}
