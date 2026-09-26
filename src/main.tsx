import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import '@/index.css';

const contenitore = document.getElementById('root');
if (!contenitore) throw new Error('Elemento #root non trovato in index.html');

createRoot(contenitore).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
