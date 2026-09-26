/**
 * Chiavi di cache centralizzate: un solo posto da cambiare quando servono
 * invalidazioni nuove, e nessun rischio di chiavi disallineate fra hook.
 */
export const chiaviItinerario = {
  tutte: ['itinerario'] as const,
  giornata: (data: string) => ['itinerario', 'giornata', data] as const,
  totali: (da: string, a: string) => ['itinerario', 'totali', da, a] as const,
} as const;

export const chiaviProfilo = {
  tutte: ['profilo'] as const,
  corrente: () => ['profilo', 'corrente'] as const,
} as const;
