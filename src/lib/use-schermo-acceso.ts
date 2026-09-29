import { useEffect } from 'react';

/**
 * Tiene lo schermo acceso finché `attivo` è true (Screen Wake Lock API).
 *
 * Serve al navigatore: un browser smette di ricevere la posizione quando il
 * telefono si blocca, quindi lo schermo spento significa navigatore fermo.
 * Il sistema rilascia il blocco quando si cambia app: lo si richiede di nuovo
 * al ritorno. Dove l'API non esiste (browser vecchi) non succede nulla.
 */
export function useSchermoAcceso(attivo: boolean): void {
  useEffect(() => {
    if (!attivo || !('wakeLock' in navigator)) return;

    let blocco: WakeLockSentinel | null = null;
    let finito = false;

    const richiedi = async () => {
      try {
        const ottenuto = await navigator.wakeLock.request('screen');
        if (finito) {
          void ottenuto.release();
          return;
        }
        blocco = ottenuto;
      } catch {
        // Risparmio energetico o pagina non visibile: si prosegue senza.
      }
    };

    const alRitorno = () => {
      if (document.visibilityState === 'visible') void richiedi();
    };

    void richiedi();
    document.addEventListener('visibilitychange', alRitorno);

    return () => {
      finito = true;
      document.removeEventListener('visibilitychange', alRitorno);
      void blocco?.release();
    };
  }, [attivo]);
}
