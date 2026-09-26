import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/index.css';
import { mostraErroreAvvio } from '@/lib/errore-avvio';

const contenitore = document.getElementById('root');
if (!contenitore) throw new Error('Elemento #root non trovato in index.html');

/**
 * L'app viene importata dinamicamente di proposito.
 * Con un import statico, un errore durante la valutazione dei moduli (per
 * esempio variabili d'ambiente mancanti, controllate in lib/env.ts) impedisce
 * l'esecuzione di questo file: il risultato è una pagina bianca senza
 * spiegazioni. Così invece l'errore è catturabile e mostrabile.
 */
async function avvia(radice: HTMLElement): Promise<void> {
  try {
    const { App } = await import('@/app');
    createRoot(radice).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (errore) {
    mostraErroreAvvio(radice, errore);
  }
}

void avvia(contenitore);
