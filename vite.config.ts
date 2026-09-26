import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Sorgenti separate: utili a leggere gli errori di produzione, non servite
    // al browser se non si aprono gli strumenti di sviluppo.
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Le dipendenze che cambiano raramente stanno in chunk propri: dopo un
         * rilascio il browser riscarica solo il codice dell'app, non anche
         * React e Supabase.
         */
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)
          ) {
            return 'react';
          }
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@tanstack')) return 'query';
          if (/react-hook-form|@hookform|[\\/]zod[\\/]/.test(id)) return 'form';

          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
