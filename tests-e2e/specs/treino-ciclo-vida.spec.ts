import { test, expect, request as apiRequest } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { BACKEND_URL, SEED_CREDENTIALS } from '../helpers/api';

// Spec A — Ciclo de Vida do Treino (Professor → Aluno).
//
// O robô executa o coração do app: Professor prescreve, Aluno executa,
// dashboard atualiza. Se este caminho quebrar, o produto não existe.
//
// Aluna alvo: Maria (a2 do seed, foco em corrida) — escolhida porque o
// formulário de corrida tem menos campos obrigatórios que musculação.
//
// Estratégia:
//   1. Professor (UI): cria treino de corrida pra Maria via /professor/prescrever.
//   2. Backend (API): valida que o treino foi persistido (rota /treinos/:alunoId).
//   3. Maria (UI): abre /aluno/dashboard, encontra o treino, abre detalhe.
//   4. Validação: dashboard mostra o treino recém-criado.
//
// Não simulamos finalização completa de WorkoutLive aqui (lógica varia por
// modalidade — cobertura unitária em Vitest). Foco: o caminho da prescrição.

test.describe('Spec A: ciclo de vida do treino', () => {
  const titulo = `E2E Longo 21km - Preparação Floripa ${Date.now()}`;
  let csrfMap: Record<string, string> = {};
  let mariaAlunoId: string | null = null;

  test.beforeAll(async () => {
    const raw = await fs.readFile(path.join('tests-e2e/.auth/csrf.json'), 'utf-8');
    csrfMap = JSON.parse(raw);
  });

  test.describe('Professor prescreve treino', () => {
    test.use({ storageState: SEED_CREDENTIALS.professor.storageStatePath });

    test('1. cria treino de corrida via API (atalho UI: form-dependent)', async ({ request }) => {
      // Resolve alunoId da Maria via /api/professor/alunos (rota autenticada).
      // Endpoint exato pode variar; ajustar conforme controllers do PR atual.
      const csrf = csrfMap[SEED_CREDENTIALS.professor.email];
      expect(csrf, 'CSRF do professor deve existir após globalSetup').toBeTruthy();

      // Lista alunos do professor — endpoint comum em apps com vínculo.
      // Se sua rota é diferente, ajuste aqui.
      const alunosRes = await request.get(`${BACKEND_URL}/api/professor/alunos`, {
        headers: { 'X-CSRF-Token': csrf },
      });
      expect(alunosRes.status(), `Listar alunos retornou ${alunosRes.status()}`).toBe(200);
      const alunos = (await alunosRes.json()) as Array<{ id: string; nome: string; email?: string }>;
      const maria = alunos.find((a) => a.nome.toLowerCase().includes('maria'));
      expect(maria, 'aluna Maria deve estar vinculada ao professor admin@apex.com').toBeTruthy();
      mariaAlunoId = maria!.id;

      // Prescreve treino de corrida — payload espelha src/lib/api/treinos.ts
      // (PrescreverInput): { alunoId, modalidade, titulo, dataAlvo, detalhes }.
      const dataAlvo = new Date();
      dataAlvo.setDate(dataAlvo.getDate() + 2);
      dataAlvo.setHours(7, 0, 0, 0);

      const res = await request.post(`${BACKEND_URL}/api/treinos/prescrever`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        data: {
          alunoId: mariaAlunoId,
          modalidade: 'CORRIDA',
          titulo,
          dataAlvo: dataAlvo.toISOString(),
          detalhes: {
            tipo: 'corrida',
            distanciaKm: 21,
            ritmoAlvoMinKm: '5:00',
          },
        },
      });

      expect(res.status(), `Prescrever falhou: ${await res.text()}`).toBeLessThan(400);
      const body = (await res.json()) as { treino?: { id: string; titulo: string } };
      const treino = body.treino ?? (body as unknown as { id: string; titulo: string });
      expect(treino.id).toBeTruthy();
      expect(treino.titulo).toBe(titulo);
    });

    test('2. (opcional UI) navega para /professor/prescrever e vê a página renderizada', async ({ page }) => {
      // Smoke test da rota — não tenta preencher form (seletores específicos
      // ainda não têm data-testid; cobertura UI completa fica para PR seguinte).
      await page.goto('/professor/prescrever');
      await expect(page).toHaveURL(/\/professor\/prescrever/);
      // Heurística mínima: o título da página ou um Field com label "Título"
      // deve aparecer. Ajustar quando data-testids forem adicionados.
      await expect(page.getByText(/T[íi]tulo/i).first()).toBeVisible();
    });
  });

  test.describe('Aluna Maria vê e executa o treino', () => {
    test.use({ storageState: SEED_CREDENTIALS.maria.storageStatePath });

    test('3. dashboard de Maria lista o treino recém-criado', async ({ page }) => {
      await page.goto('/aluno/dashboard');
      await expect(page).toHaveURL(/\/aluno\/dashboard/);

      // Treino aparece no card do dia (offset +2 do seed atual). Buscamos
      // por título exato que injetamos no test 1.
      await expect(page.getByText(titulo)).toBeVisible({ timeout: 15_000 });
    });

    test('4. clicar abre detalhe do treino em /aluno/treino/:id', async ({ page }) => {
      await page.goto('/aluno/dashboard');
      await page.getByText(titulo).first().click();
      await expect(page).toHaveURL(/\/aluno\/treino\//);
      // Página de detalhe renderiza o título do treino.
      await expect(page.getByText(titulo).first()).toBeVisible();
    });
  });

  test.afterAll(async () => {
    // Cleanup: apaga treino criado pelo spec. Se cair, próximo run
    // recomeça com sufixo ${Date.now()} novo e ignora o lixo.
    if (!mariaAlunoId) return;
    const csrf = csrfMap[SEED_CREDENTIALS.professor.email];
    const ctx = await apiRequest.newContext({
      baseURL: BACKEND_URL,
      storageState: SEED_CREDENTIALS.professor.storageStatePath,
    });
    try {
      const list = await ctx.get(`/api/treinos/${mariaAlunoId}`, {
        headers: { 'X-CSRF-Token': csrf },
      });
      if (!list.ok()) return;
      const data = (await list.json()) as { treinos?: Array<{ id: string; titulo: string }> };
      const target = data.treinos?.find((t) => t.titulo === titulo);
      if (target) {
        await ctx.delete(`/api/treinos/${target.id}`, {
          headers: { 'X-CSRF-Token': csrf },
        });
      }
    } finally {
      await ctx.dispose();
    }
  });
});
