import { useEffect } from 'react';
import { toast } from 'sonner';

import { useProgressi } from '@/features/traguardi/api/use-traguardi';
import { idOttenuti, nuoviTraguardi, traguardoPerId } from '@/features/traguardi/lib/traguardi';

const CHIAVE = 'walk-around-traguardi-visti';

function leggiVisti(): string[] | null {
  try {
    const salvato = localStorage.getItem(CHIAVE);
    if (salvato === null) return null;
    const valore: unknown = JSON.parse(salvato);
    return Array.isArray(valore)
      ? valore.filter((voce): voce is string => typeof voce === 'string')
      : null;
  } catch {
    return null;
  }
}

function salvaVisti(ids: string[]): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(ids));
  } catch {
    // Senza storage (navigazione privata) l'avviso può ripetersi: accettabile.
  }
}

/**
 * Annuncia i traguardi appena sbloccati.
 *
 * Il ricordo di quelli già visti sta nel dispositivo e non sul database: è
 * un'informazione di presentazione, e perderla (altro telefono, dati cancellati)
 * significa al massimo non rivedere un avviso. Al primo avvio non si annuncia
 * nulla: partirebbe una raffica per traguardi raggiunti settimane fa.
 */
export function AvvisoNuoviTraguardi() {
  const { data: progressi } = useProgressi();

  useEffect(() => {
    if (!progressi) return;

    const ora = idOttenuti(progressi);
    const nuovi = nuoviTraguardi(leggiVisti(), ora);
    salvaVisti(ora);

    for (const id of nuovi) {
      const traguardo = traguardoPerId(id);
      if (!traguardo) continue;
      toast.success(`Nuovo traguardo: ${traguardo.titolo}`, {
        description: traguardo.descrizione,
        duration: 8000,
      });
    }
  }, [progressi]);

  return null;
}
