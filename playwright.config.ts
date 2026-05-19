import { defineConfig, devices } from '@playwright/test';

// PR #35 — Playwright E2E.
//
// Estratégia happy-paths: Vitest cobre lógica de componente; Playwright
// garante que o usuário entra, executa a ação que gera valor e sai com
// dados persistidos. Falhou aqui → deploy bloqueado.
//
// 3 Specs:
//   - treino-ciclo-vida   (Professor prescreve → Aluno executa)
//   - offline-write       (PWA queue + sync com context.setOffline)
//   - god-mode-admin      (PR #32.5: admin lê dados de qualquer aluno)
//
// Otimização-chave: globalSetup faz login UMA VEZ por role e salva
// storageState (cookies). Specs reutilizam — não há custo de auth por
// teste.

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:4173';
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests-e2e/specs',
  outputDir: './tests-e2e/.results',
  globalSetup: './tests-e2e/global-setup.ts',

  // 30s por teste é suficiente — happy paths não devem ser longos. Em CI
  // damos um pouco mais de folga pro cold start do backend.
  timeout: IS_CI ? 60_000 : 30_000,
  expect: { timeout: 10_000 },

  fullyParallel: false, // tocam o mesmo banco — evita race condition no seed
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: 1,

  reporter: IS_CI
    ? [['github'], ['html', { outputFolder: 'tests-e2e/.report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'tests-e2e/.report', open: 'never' }]],

  use: {
    baseURL: FRONTEND_URL,
    extraHTTPHeaders: {
      // Default não-auth — specs autenticadas injetam header de CSRF via context.
    },
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // PWA — service worker tem caching agressivo (PR #9 + PR #36). Deixamos
    // o browser registrar o SW normalmente; specs offline manipulam context.setOffline.
    serviceWorkers: 'allow',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile Safari simulação (sem login real — usa storageState global)
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // PR #35 — webServer não inicia o backend (Postgres + Prisma fica fora
  // do escopo do Playwright). CI script sobe back+front separadamente
  // antes de chamar `playwright test`. Em dev local, rodar manualmente.
  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: 'npm run preview -- --port 4173',
        url: FRONTEND_URL,
        reuseExistingServer: !IS_CI,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },

  metadata: {
    backendUrl: BACKEND_URL,
    frontendUrl: FRONTEND_URL,
  },
});
