import { format, parseISO } from 'date-fns';

/**
 * Ora dell'arrivo in formato breve, dal timestamp salvato.
 * Vive a parte da prossimita.ts perché quel modulo non dipende da date-fns:
 * resta logica pura di distanze.
 */
export function oraDiArrivo(momento: string | null): string {
  if (!momento) return '';
  try {
    return format(parseISO(momento), 'HH:mm');
  } catch {
    // Un valore non leggibile non deve rompere la riga della tappa.
    return '';
  }
}
