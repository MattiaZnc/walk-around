import { useEffect } from 'react';

import { env } from '@/lib/env';

/** Aggiorna document.title: utile per accessibilità e cronologia del browser. */
export function useTitoloPagina(titolo: string): void {
  useEffect(() => {
    const precedente = document.title;
    document.title = `${titolo} · ${env.VITE_APP_NAME}`;
    return () => {
      document.title = precedente;
    };
  }, [titolo]);
}
