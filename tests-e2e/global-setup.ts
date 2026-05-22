import fs from 'node:fs/promises';
import path from 'node:path';

import { type FullConfig, request } from '@playwright/test';

import { BACKEND_URL, loginViaApi, SEED_CREDENTIALS, type SeedUser } from './helpers/api';

// PR #35 — Login UMA VEZ por role; salva storageState com cookies.
//
// Cada spec pode escolher qual session reutilizar via:
//   test.use({ storageState: 'tests-e2e/.auth/aluno.json' })
//
// Também grava o CSRF token em paralelo (.csrf.json) pra specs que
// disparam mutations diretas na API (Spec B/C usam isso).

async function loginAndPersist(user: SeedUser, csrfStore: Record<string, string>): Promise<void> {
  const ctx = await request.newContext({ baseURL: BACKEND_URL });
  try {
    const { csrf, user: u } = await loginViaApi(ctx, user.email, user.senha);
    csrfStore[user.email] = csrf;
    console.log(`  ✓ ${user.role.padEnd(13)} ${user.email}  (userId=${u.id.slice(0, 8)}…)`);
    await fs.mkdir(path.dirname(user.storageStatePath), { recursive: true });
    await ctx.storageState({ path: user.storageStatePath });
  } finally {
    await ctx.dispose();
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('\n[playwright] global setup — login + storageState\n');

  const csrfStore: Record<string, string> = {};
  const users: SeedUser[] = [
    SEED_CREDENTIALS.professor,
    SEED_CREDENTIALS.aluno,
    SEED_CREDENTIALS.maria,
    SEED_CREDENTIALS.pedro,
  ];

  // Admin é opcional — se o seed:admin não rodou, pula com aviso.
  if (process.env.E2E_INCLUDE_ADMIN !== 'false') {
    users.push(SEED_CREDENTIALS.admin);
  }

  for (const user of users) {
    try {
      await loginAndPersist(user, csrfStore);
    } catch (err) {
      if (user.role === 'ADMIN') {
        console.warn(`  ⚠ admin login falhou — pulando (rode 'npm run seed:admin' no backend): ${(err as Error).message}`);
        continue;
      }
      throw err;
    }
  }

  // Tokens CSRF são úteis em specs que disparam mutations sem UI.
  // O JWT está no cookie httpOnly (storageState), mas CSRF só circula
  // em memória do client — precisamos passá-lo explicitamente pros specs.
  await fs.writeFile(
    path.join('tests-e2e/.auth', 'csrf.json'),
    JSON.stringify(csrfStore, null, 2),
  );

  console.log('\n[playwright] global setup OK\n');
}
