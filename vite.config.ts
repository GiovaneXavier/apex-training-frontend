// Vitest 4: `defineConfig` de `vitest/config` aceita o bloco `test`.
// É um superset do `defineConfig` do `vite`, pode hospedar plugins normalmente.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// PWA — premissa: aluno abre o app no ginásio, conexão instável.
// Estratégia (PR #9): App Shell pré-cacheada (carrega offline) +
//   NetworkFirst para GET /api/* (offline-readable após primeiro fetch)
//   + StaleWhileRevalidate para imagens/fontes
//   + fila app-level (lib/offline/saveQueue) para POSTs.
//
// POSTs (mutações) NÃO entram no SW — usam fila própria em IDB que
// preserva auth/CSRF state. Workbox por default já ignora POST/PUT/DELETE.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' → SW novo fica em waiting; UI dispara skipWaiting via ReloadPrompt.
      // Aluno no meio do treino não perde estado por reload silencioso.
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Apex Training',
        short_name: 'Apex',
        description: 'Sistema multi-sports de prescrição e execução de treinos',
        // Coral é a cor de marca — usada na splash screen e barra do sistema
        theme_color: '#fc4c02',
        background_color: '#0a0a0b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        categories: ['fitness', 'health', 'sports'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App Shell — todos os assets do build entram no precache.
        // Garante que /aluno/treino/:id abra offline depois do primeiro acesso.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // SPA fallback: qualquer rota client-side serve o index.html cacheado.
        // É o que faz /aluno/treino/abc123 funcionar offline.
        navigateFallback: '/index.html',
        // Não interceptar chamadas à API — dados precisam ser frescos
        // (ou tratados pelo offline store da própria app).
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // 5 MB — cobre App Shell + ícones sem inflar o SW
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/api\/treinos(\/|\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'apex-api-treinos',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // /api/rotinas/* — listagens, rotina por id, dia.
            urlPattern: /\/api\/rotinas(\/|\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'apex-api-rotinas',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // /api/auth/me — hidratação da sessão. Cache curto (1h) porque
            // o cookie HttpOnly continua válido; estado do user muda lento.
            urlPattern: /\/api\/auth\/me(\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'apex-api-me',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Dados secundários: aluno (vinculos/desempenho), rps, evolucoes,
            // strava status/atividades. Cache curto (1 dia) — não mostrar
            // streak/RP defasado.
            urlPattern: /\/api\/(aluno|rps|evolucoes|strava)(\/|\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'apex-api-misc',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Fontes Google (CSS + arquivos .woff2) ─────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Imagens (ícones, S3/CloudFront de evolução) ──────────
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'apex-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Desligado em dev pra evitar surpresa de cache durante desenvolvimento.
        // Pra testar PWA localmente: `npm run build && npm run preview`.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
