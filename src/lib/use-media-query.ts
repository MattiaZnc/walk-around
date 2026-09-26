import { useEffect, useState } from 'react';

/**
 * Media query reattiva. Serve a scegliere fra dialog (desktop) e drawer
 * (telefono): la differenza non è solo estetica, cambia il componente montato.
 */
export function useMediaQuery(query: string): boolean {
  const [corrisponde, setCorrisponde] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    setCorrisponde(media.matches);

    const onChange = (evento: MediaQueryListEvent) => {
      setCorrisponde(evento.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [query]);

  return corrisponde;
}

/** Breakpoint `md` di Tailwind: da qui in su si usa il layout a due colonne. */
export function useDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
