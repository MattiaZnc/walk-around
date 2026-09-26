import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Variabili d'ambiente finte: src/lib/env.ts valida al primo import.
vi.stubEnv('VITE_SUPABASE_URL', 'https://progetto-di-test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chiave-anon-di-test-abcdefghijklmnop');
vi.stubEnv('VITE_APP_NAME', 'Walk Around');

// matchMedia non esiste in jsdom: serve al ThemeProvider.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

afterEach(() => {
  cleanup();
});
