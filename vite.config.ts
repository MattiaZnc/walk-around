import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // L'app si aggiorna da sola: chi la usa non deve accorgersi dei rilasci.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Walk Around — itinerari e chilometri',
        short_name: 'Walk Around',
        description: 'Pianifica le tappe della giornata e tieni traccia dei chilometri percorsi.',
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#1b7a54',
        categories: ['travel', 'productivity'],
        icons: [
          { src: '/icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icona-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icona-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            // La variante maskable ha il disegno più interno: Android la
            // ritaglia in cerchio e i bordi andrebbero persi.
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Giornata di oggi', url: '/day', description: 'Apri le tappe di oggi' },
          { name: 'Report', url: '/report', description: 'Totali ed esportazione' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // I file .map non servono a chi usa l'app e peserebbero sulla cache.
        globIgnores: ['**/*.map'],
        navigateFallback: '/index.html',
        // Le mattonelle della mappa si conservano per un po': tornando su una
        // zona già vista si vede subito, anche con la rete lenta. Il tetto
        // evita che la cache cresca senza limite.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mattonelle-mappa',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Mappa vettoriale OpenFreeMap: stili, caratteri, icone e
            // mattonelle. Pesano poco e cambiano di rado.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mappa-vettoriale',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Le chiamate a Supabase non vanno mai in cache: i dati devono essere
        // quelli veri, e le risposte dipendono dall'utente autenticato.
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//, /^\/auth\//],
      },
      devOptions: {
        // Il service worker in sviluppo intercetterebbe il ricaricamento a caldo.
        enabled: false,
      },
    }),
  ],
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
