// Vitest 4: `defineConfig` de `vitest/config` aceita o bloco `test`.
// É um superset do `defineConfig` do `vite`, pode hospedar plugins normalmente.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// PWA — premissa: aluno abre o app no ginásio, conexão instável.
// Estratégia: App Shell pré-cacheada (carrega offline) + runtime caching
// para fontes/ícones/imagens. API NÃO é cacheada (dados de execução
// precisam de fonte da verdade — offline-first dos treinos é responsabilidade
// do store local, não do Service Worker).
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
            // Google Fonts (CSS) — quase imutável
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts (arquivos .woff2) — imutável, cache longo
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imagens (ícones de exercícios, fotos de evolução servidas pelo S3/CloudFront)
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
