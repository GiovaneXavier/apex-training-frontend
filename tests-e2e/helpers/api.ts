import type { APIRequestContext, BrowserContext } from '@playwright/test';

// PR #35 — helpers de integração com a API do Apex Training.
//
// Auth pattern do backend (apex-training-backend/src/controllers/auth.controller.js):
//   POST /api/auth/login  body { email, senha }  → set-cookie `apex.token`
//                                                  body { user, csrf }
//
//   Cookie httpOnly carrega o JWT. CSRF token só circula em memória do
//   client (header X-CSRF-Token em todo POST/PUT/PATCH/DELETE).
//
// Aqui exportamos:
//   - BACKEND_URL: configurável via env (default localhost:3000).
//   - SEED_CREDENTIALS: credenciais que o `prisma/seed.js` cria.
//   - loginViaApi(): chama login direto na API (sem UI) — usado pelo
//     globalSetup pra popular storageState e pelos specs pra obter CSRF.

export const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3000';
export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:4173';

export type SeedUser = {
  role: 'PROFESSOR' | 'ALUNO' | 'ADMIN' | 'NUTRICIONISTA';
  email: string;
  senha: string;
  storageStatePath: string;
};

// Credenciais espelham `apex-training-backend/prisma/seed.js`:
//   - admin@apex.com    → PROFESSOR (head do seed; rotina + alunos vinculados)
//   - aluno@apex.com    → ALUNO (a1, foco musculação)
//   - maria@apex.com    → ALUNO (a2, foco corrida)
//   - pedro@apex.com    → ALUNO (a3, foco triathlon)
//   - admin-god@apex.com → ADMIN (god-mode, vem do `seed:admin`)
//
// A senha de ADMIN é controlada pelo seed-admin.js — ajuste aqui se mudar.
export const SEED_CREDENTIALS = {
  professor: {
    role: 'PROFESSOR',
    email: 'admin@apex.com',
    senha: 'admin123',
    storageStatePath: 'tests-e2e/.auth/professor.json',
  },
  aluno: {
    role: 'ALUNO',
    email: 'aluno@apex.com',
    senha: 'aluno123',
    storageStatePath: 'tests-e2e/.auth/aluno.json',
  },
  // Aluna de corrida — usada na Spec A (Professor prescreve para Maria).
  maria: {
    role: 'ALUNO',
    email: 'maria@apex.com',
    senha: 'maria123',
    storageStatePath: 'tests-e2e/.auth/maria.json',
  },
  // Aluno triatleta — Spec B (ciclismo offline).
  pedro: {
    role: 'ALUNO',
    email: 'pedro@apex.com',
    senha: 'pedro123',
    storageStatePath: 'tests-e2e/.auth/pedro.json',
  },
  admin: {
    role: 'ADMIN',
    email: process.env.E2E_ADMIN_EMAIL || 'admin-god@apex.com',
    senha: process.env.E2E_ADMIN_SENHA || 'changeme-god-mode',
    storageStatePath: 'tests-e2e/.auth/admin.json',
  },
} as const satisfies Record<string, SeedUser>;

export type LoginResult = {
  csrf: string;
  user: {
    id: string;
    email: string;
    role: string;
    nome: string;
  };
};

// Login direto pela API. NÃO usa Playwright UI — é o caminho rápido pro
// globalSetup popular cookies.
export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  senha: string,
): Promise<LoginResult> {
  const res = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { email, senha },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login falhou (${res.status()}): ${body}`);
  }
  return (await res.json()) as LoginResult;
}

// Injeta header X-CSRF-Token no contexto pra todas as requests do browser.
// Cookie (apex.token) já vai automaticamente porque o storageState carrega.
export async function attachCsrfToContext(
  context: BrowserContext,
  csrf: string,
): Promise<void> {
  await context.setExtraHTTPHeaders({ 'X-CSRF-Token': csrf });
}

// Helper pra specs que precisam fazer chamada autenticada direto na API
// (sem ir pela UI). Reusa cookies do storageState + injeta CSRF.
export async function apiRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  csrf: string,
  body?: unknown,
) {
  return request.fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    data: body ? JSON.stringify(body) : undefined,
  });
}
