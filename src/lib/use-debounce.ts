import { useEffect, useState } from 'react';

/**
 * Ritarda la propagazione di un valore.
 * Serve ai campi di ricerca: senza debounce ogni tasto premuto genererebbe una
 * richiesta al servizio di geocoding.
 */
export function useDebounce<T>(valore: T, millisecondi = 350): T {
  const [ritardato, setRitardato] = useState(valore);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRitardato(valore);
    }, millisecondi);

    return () => {
      clearTimeout(timer);
    };
  }, [valore, millisecondi]);

  return ritardato;
}
