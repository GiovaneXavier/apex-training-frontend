# Apex Training — E2E Playwright (PR #35)

Cobertura de **happy paths**. Vitest cuida da lógica unitária; Playwright
garante que o usuário consegue entrar, executar a ação que gera valor e
sair com os dados persistidos. Falhou aqui → deploy bloqueado.

## Specs

| Arquivo | O que cobre |
|---|---|
| `specs/treino-ciclo-vida.spec.ts` | Professor prescreve → Aluno vê → Aluno executa. |
| `specs/offline-write.spec.ts` | PWA: finaliza treino offline, sincroniza ao voltar (PR #9). |
| `specs/god-mode-admin.spec.ts` | Admin bypassa ACL e lê dados de qualquer aluno (PR #32.5). |

## Setup local

```bash
# 1. Instalar dependências (uma vez)
cd apex-training-frontend
npm install
npx playwright install --with-deps chromium

# 2. Backend rodando + banco seedado
cd ../apex-training-backend
npm run db:seed          # cria professor/alunos do seed
npm run seed:admin       # cria admin god-mode (PR #32.5)
npm run dev              # porta 3000

# 3. Frontend em preview (testa build real, igual à CI)
cd ../apex-training-frontend
npm run build
npm run preview -- --port 4173

# 4. Rodar specs
npm run test:e2e            # headless
npm run test:e2e:ui         # interactive
npm run test:e2e:report     # abrir HTML do último run
```

## Variáveis de ambiente

| Var | Default | Uso |
|---|---|---|
| `E2E_BACKEND_URL` | `http://localhost:3000` | URL da API. |
| `E2E_FRONTEND_URL` | `http://localhost:4173` | URL do preview. |
| `E2E_ADMIN_EMAIL` | `admin-god@apex.com` | Email do user ADMIN do seed. |
| `E2E_ADMIN_SENHA` | `changeme-god-mode` | Senha do ADMIN. |
| `E2E_INCLUDE_ADMIN` | `true` | `false` pula Spec C (sem seed:admin). |
| `E2E_NO_WEB_SERVER` | unset | Define pra desativar o `webServer` (CI já sobe). |

## Estratégia de auth

`global-setup.ts` loga UMA VEZ por role via `POST /api/auth/login`
direto na API e salva o `storageState` (cookies httpOnly) em
`tests-e2e/.auth/<role>.json`. CSRF token vai pra `.auth/csrf.json`
porque o cookie sozinho não basta — backend exige header `X-CSRF-Token`
em toda mutation.

Especs usam `test.use({ storageState: SEED_CREDENTIALS.<role>.storageStatePath })`
pra herdar a sessão sem custo extra.

## Pasta `.auth/`

Não commitar — está no `.gitignore`. Cada CI run regenera via
`global-setup` contra um banco de teste limpo (`db:seed`).

## TODOs (incremental)

- [ ] Adicionar `data-testid` nos elementos críticos de prescrição (form
      Field, botão de salvar) pra remover seletores por texto.
- [ ] Adicionar `data-testid="treino-finalizar"` no botão de finalizar
      em cada `*Live` (CiclismoLive, CorridaLive, etc.) pra firmar a
      Spec B sem fallback.
- [ ] Tag `data-testid="toast-offline"` no toast de salvamento offline
      (string exata indefinida hoje).
- [ ] Spec D futuro: registro de novo aluno + onboarding (PR #37+).
