import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { BACKEND_URL, SEED_CREDENTIALS } from '../helpers/api';

// Spec C — God-Mode Admin (PR #32.5).
//
// O bypass de ACL é backend-only: usuário com role=ADMIN consegue ler
// dados de QUALQUER aluno via API (rotas que normalmente exigiriam
// vínculo professor↔aluno ou identidade do próprio aluno).
//
// Como o UI ainda não tem rota dedicada `/aluno/:id/progresso` para
// admin, validamos o bypass diretamente no nível da API — fonte da
// verdade do PR. Quando a UI de admin chegar, adicionamos um teste
// de navegação aqui.
//
// Validamos:
//   1. ADMIN obtém 200 em GET /api/aluno/:id/desempenho (deveria ser 403
//      para qualquer não-vinculado sem god-mode).
//   2. ADMIN obtém 200 em GET /api/evolucoes?alunoId=:id (idem).
//   3. ADMIN não escreve por engano — assertions read-only.

const PROGRESSO_PATHS = [
  // Endpoints que o WeeklyCheckinCard / StreakCard / SecaoDesempenho
  // consomem no Dashboard. Devem responder 200 pro admin lendo dados de
  // outra pessoa.
  (alunoId: string) => `/api/aluno/${alunoId}/desempenho`,
  (alunoId: string) => `/api/aluno/${alunoId}/volume`,
  (alunoId: string) => `/api/evolucoes?alunoId=${alunoId}&limit=5`,
];

test.describe('Spec C: god-mode admin (PR #32.5)', () => {
  test.skip(
    process.env.E2E_INCLUDE_ADMIN === 'false',
    'admin desligado (defina E2E_INCLUDE_ADMIN=true após rodar seed:admin)',
  );
  test.use({ storageState: SEED_CREDENTIALS.admin.storageStatePath });

  let adminCsrf = '';
  let alunoIdAlvo = '';

  test.beforeAll(async ({ playwright }) => {
    const raw = await fs.readFile(path.join('tests-e2e/.auth/csrf.json'), 'utf-8');
    const map = JSON.parse(raw) as Record<string, string>;
    adminCsrf = map[SEED_CREDENTIALS.admin.email];

    // Resolve um alunoId qualquer (Maria, do seed) via login independente
    // da professora pra evitar acoplar specs.
    const ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    try {
      const loginRes = await ctx.post('/api/auth/login', {
        data: {
          email: SEED_CREDENTIALS.maria.email,
          senha: SEED_CREDENTIALS.maria.senha,
        },
      });
      const body = (await loginRes.json()) as { user: { id: string; aluno?: { id: string } } };
      alunoIdAlvo = body.user.aluno?.id ?? body.user.id;
    } finally {
      await ctx.dispose();
    }
  });

  test('admin lê dashboard de outro aluno (bypass ACL)', async ({ request }) => {
    expect(adminCsrf, 'CSRF do admin presente (rode seed:admin)').toBeTruthy();
    expect(alunoIdAlvo, 'alunoId alvo resolvido').toBeTruthy();

    for (const buildPath of PROGRESSO_PATHS) {
      const url = `${BACKEND_URL}${buildPath(alunoIdAlvo)}`;
      const res = await request.get(url, {
        headers: { 'X-CSRF-Token': adminCsrf },
      });
      expect(
        res.status(),
        `Admin DEVE conseguir GET ${url} (status atual: ${res.status()})`,
      ).toBeLessThan(400);
    }
  });

  test('admin NÃO redireciona em rotas internas do aluno (UI)', async ({ page }) => {
    // Acessar /aluno/progresso como admin: PR #32.5 garante que admin não
    // é jogado pra /login nem vê 403 — o ProtectedRoute aceita ADMIN.
    await page.goto('/aluno/progresso');
    // Aceita qualquer URL que NÃO seja /login.
    await expect(page).not.toHaveURL(/\/login/);
    // Heurística: algum conteúdo de "Progresso" / "Desempenho" / "Evolução"
    // deve renderizar.
    await expect(
      page.getByText(/Desempenho|Evolu[çc][ãa]o|Progresso/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
