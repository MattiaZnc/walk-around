import type { PartenzaSalvata } from '@/types/models';

export type NuovaPartenza = {
  label: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

/** Sotto questa distanza due partenze sono lo stesso posto (circa 30 metri). */
const TOLLERANZA_GRADI = 0.0003;

/**
 * Vero se la partenza è già nell'elenco: stesso punto sulla mappa oppure,
 * senza coordinate, stesso nome. Serve a non salvare "Casa" ogni volta che si
 * parte da casa cercandola di nuovo.
 */
export function giaSalvata(salvate: readonly PartenzaSalvata[], nuova: NuovaPartenza): boolean {
  return salvate.some((salvata) => {
    if (nuova.lat !== null && nuova.lng !== null && salvata.lat !== null && salvata.lng !== null) {
      return (
        Math.abs(salvata.lat - nuova.lat) < TOLLERANZA_GRADI &&
        Math.abs(salvata.lng - nuova.lng) < TOLLERANZA_GRADI
      );
    }
    return salvata.label.trim().toLowerCase() === nuova.label.trim().toLowerCase();
  });
}
