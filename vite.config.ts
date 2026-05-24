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
      // PR #26 — migrado de generateSW → injectManifest pra suportar
      // push/notificationclick listeners customizados em src/sw.ts.
      // injectManifest substitui `self.__WB_MANIFEST` no build pelo array
      // real de assets a precache; precacheAndRoute() no SW consome.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',

      // 'prompt' → SW novo fica em waiting; UI dispara skipWaiting via ReloadPrompt.
      // Aluno no meio do treino não perde estado por reload silencioso.
      registerType: 'prompt',
      // Os PNGs (icon-192/512/maskable, favicon.ico/svg, apple-touch-icon)
      // ainda não foram gerados — manifest apontava pra arquivos inexistentes
      // e o console acusava 404/warning. Enquanto `npm run generate-pwa-assets`
      // não roda numa esteira separada, fallback pro `logo.svg` (escalável,
      // sirva qualquer tamanho). TODO: gerar PNGs e restaurar os 3 entries.
      includeAssets: ['logo.svg', 'robots.txt'],
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
          // SVG escalável cobre "any" + "maskable" enquanto os PNGs não saem.
          // sizes:"any" diz ao browser "use em qualquer dimensão".
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },

      // injectManifest config — substitui o bloco `workbox.*` antigo.
      // runtimeCaching foi portado 1:1 pra src/sw.ts usando workbox-* APIs.
      injectManifest: {
        // Mesmo padrão de globs do antigo bloco workbox.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // 5 MB — cobre App Shell + ícones sem inflar o manifest.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },

      // O bloco `workbox:` antigo (generateSW) foi removido. Toda a lógica
      // de runtimeCaching + navigateFallback agora vive em src/sw.ts via
      // workbox-routing/strategies. Ver comentários lá pra mapeamento 1:1.

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
    // PR #38/#39 — Vitest não deve tentar carregar specs Playwright
    // (eles importam @playwright/test e quebram o resolver). E2E roda
    // separado via `npm run test:e2e`. Mesma exclusão será aplicada pelo
    // PR #38; ficar idempotente aqui evita teste vermelho desta branch.
    exclude: ['node_modules', 'dist', 'tests-e2e/**'],
  },
});
