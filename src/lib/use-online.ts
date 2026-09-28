import { useEffect, useState } from 'react';

/**
 * Stato della connessione.
 * `navigator.onLine` dice solo se esiste un'interfaccia di rete attiva, non se
 * si raggiunge davvero internet: è affidabile quando dice "offline", meno
 * quando dice "online". Basta per avvisare che i dati potrebbero non essere
 * aggiornati.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const vaOnline = () => {
      setOnline(true);
    };
    const vaOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', vaOnline);
    window.addEventListener('offline', vaOffline);
    return () => {
      window.removeEventListener('online', vaOnline);
      window.removeEventListener('offline', vaOffline);
    };
  }, []);

  return online;
}
