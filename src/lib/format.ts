import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

/** Formato usato su tutte le chiavi data (colonna `date` di itineraries). */
export const FORMATO_DATA_ISO = 'yyyy-MM-dd';

/** Data di oggi come stringa ISO nel fuso locale (non UTC). */
export function oggiISO(): string {
  return format(new Date(), FORMATO_DATA_ISO);
}

/** Converte 'yyyy-MM-dd' in Date locale, evitando lo shift di fuso di new Date(). */
export function dataDaISO(iso: string): Date {
  return parseISO(iso);
}

export function isoDaData(data: Date): string {
  return format(data, FORMATO_DATA_ISO);
}

/** Es. "lunedì 6 gennaio 2025" */
export function dataLunga(iso: string): string {
  return format(dataDaISO(iso), 'EEEE d MMMM yyyy', { locale: it });
}

/** Es. "lun 6 gen" */
export function dataBreve(iso: string): string {
  return format(dataDaISO(iso), 'EEE d MMM', { locale: it });
}

/** Es. "gennaio 2025" */
export function meseAnno(data: Date): string {
  return format(data, 'LLLL yyyy', { locale: it });
}

const formatterKm = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatterNumero = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 2,
});

/** Es. "12,4 km" */
export function km(valore: number): string {
  return `${formatterKm.format(valore)} km`;
}

export function numero(valore: number): string {
  return formatterNumero.format(valore);
}

/** Minuti in forma compatta: "45 min", "2 h 5 min". */
export function durata(minuti: number | null): string {
  if (minuti === null || !Number.isFinite(minuti)) return '—';
  const arrotondati = Math.round(minuti);
  if (arrotondati < 60) return `${arrotondati} min`;
  const ore = Math.floor(arrotondati / 60);
  const resto = arrotondati % 60;
  return resto === 0 ? `${ore} h` : `${ore} h ${resto} min`;
}

/** 'HH:mm:ss' del DB → 'HH:mm' per l'UI. */
export function oraBreve(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/** Es. "6 gen 2025" */
export function dataMedia(iso: string): string {
  return format(dataDaISO(iso), 'd MMM yyyy', { locale: it });
}

/** Es. "lunedì" */
export function giornoSettimana(iso: string): string {
  return format(dataDaISO(iso), 'EEEE', { locale: it });
}

/** Es. "martedì 29 settembre": l'anno si omette quando è quello in corso. */
export function dataSenzaAnno(iso: string): string {
  return format(dataDaISO(iso), 'EEEE d MMMM', { locale: it });
}

/** true se la data cade nell'anno corrente. */
export function annoCorrente(iso: string): boolean {
  return iso.slice(0, 4) === String(new Date().getFullYear());
}
