# Monorepo Migration Plan — Apex Training

**Autor:** Time de engenharia (spike PR #40)
**Data:** 2026-05-20
**Status:** Draft — pendente revisão e go/no-go
**Contexto:** Sprint 14 (Road to Race Day) — entrega final
**Referências:** [SPRINT13_POSTMORTEM.md](SPRINT13_POSTMORTEM.md)

---

## TL;DR

Sprint 13+14 expuseram custo recorrente do split em dois repos (`apex-training-frontend` ↔ `apex-training-backend`): ~6-8h perdidas em fricção cross-stack, 15 schemas Zod sem espelho seguro no client (drift silencioso), pipelines de CI bloqueadas por permissão cross-repo.

**Recomendação: GO** para migração em monorepo único com **pnpm workspaces + Turborepo**, em janela de **3 dias dedicados** (Sprint 15 ou 16).

Não-recomendação para `npm package interno publicado` (alternativa) — burocracia de publish supera o ganho de extrair só os tipos.

---

## 1. Diagnóstico atual (custo medido)

### 1.1 Inventário de duplicação

| Camada | Backend | Frontend | Risco |
|---|---|---|---|
| Schemas de validação | **15 arquivos Zod** em `src/schemas/` (auth, treino, prova, push, evolucao, rotina, plano, marcial, voice, aiDraft, aiProgression, alunoInsight, coachBriefing, execucao, exercicio) | **0 arquivos Zod** — `treino.ts` (412 linhas) é único espelho TS manual | Drift silencioso. Mudar campo no Zod = mudar manualmente no TS. Esquecimento = bug em runtime. |
| Enums (`Modalidade`, `Faixa`, `ProvaPrioridade`) | `prisma/schema.prisma` + `treino.schemas.js` | Re-declarados em `types/treino.ts` | Drift moderado. PR #37 introduziu `ProvaPrioridade` — precisou ser declarado em 3 lugares (Prisma + Zod + TS). |
| HTTP error contracts | `errorHandler.js` (`HttpError { meta }`) | `lib/api.ts` `apiErrorMessage()` | Documentado por convenção, não por tipo. PR #37 adicionou `code: 'PROVA_ALVO_DUPLICADO'` no payload — frontend não tem narrowing tipado. |
| Constantes (modalidades, urls) | `lib/env.js`, schemas | `MODALIDADE_LABEL`, defaults | Drift baixo. |

### 1.2 Incidentes da Sprint 13+14 atribuíveis ao split

| Sprint | Incidente | Tempo perdido |
|---|---|---|
| 13 | Workflow Playwright sem permissão pra clonar backend privado (necessário `BACKEND_REPO_TOKEN` PAT) | ~1h |
| 13 | Migration Prisma `_init` com banner Unicode quebrava em CI banco zerado — só pegou via E2E (nenhum dev novo conseguiria clonar e rodar) | Bug latente 14 dias |
| 13 | Workflow CI com `actions/checkout` cross-repo encadeado quebrava em branches que existem só no frontend | ~2h debug + fix `Resolve backend ref` via `git ls-remote` |
| 14 | PR #37 backend → PR #38 frontend → PR #39 frontend: ordem rígida de merge | 3 PRs encadeados, 2 rebases forçados, 1 commit vazio pra forçar redeploy |
| 14 | `Prova.alvoTempo`/`local` adicionados como `null` literal num test do PR #38 — quebrou build prod do PR #39 (TS strict) | 1 deploy Vercel falhou, fix tardio |
| 14 | `getProvaAlvo` adicionado no PR #38 — PR #39 dependia dele mas precisou aguardar merge | 1 rebase + ~30min de espera |

**Total estimado: 6-8h em 2 Sprints.** Recorrente — cada Sprint cross-stack vai pagar custo similar.

### 1.3 Custo PROJETADO (próximas 4 Sprints sem ação)

Se Sprint 15+16+17+18 mantiverem o ritmo de ~1 incidente cross-repo por Sprint:
- **24-32h adicionais** de fricção até final de 2026 Q3.
- Equivalente a ~4 dias úteis perdidos.

---

## 2. Ferramental — Matriz de decisão

### 2.1 Opções avaliadas

| Tooling | Pros | Cons | Custo migração | Manutenção |
|---|---|---|---|---|
| **pnpm workspaces puro** | Simples, zero build orchestration extra | Sem cache de build, sem grafo de dependência paralelizado | 1-2 dias | Baixo |
| **pnpm workspaces + Turborepo** ⭐ | Remote Caching nativo na Vercel, paraleliza tasks, grafo de deps explícito | 1 ferramenta extra pra entender | 2-3 dias | Médio-baixo |
| **Nx** | Mais features (generators, schematics), opinionated | Curva alta, footprint maior, optimizado pra times grandes | 3-4 dias | Médio-alto |
| **Bun workspaces** | Mais rápido em install/run | Tooling Vercel/Render ainda maturando suporte; risco de incompatibilidade com `prisma`, `web-push`, `@sentry/node` | 2-3 dias + risco | Médio + risco |
| **Status quo + `@apex/contracts` npm package interno** | Mantém repos separados | Burocracia de publish (`npm version` + tag + push em cada mudança de contrato); não resolve checkout E2E | 1-2 dias | Médio (burocracia) |

### 2.2 Veredito: **pnpm workspaces + Turborepo**

Razões:
1. **Remote Caching nativo na Vercel** — builds incrementais. Mudança só no backend = frontend pula build inteiro. Mudança só no frontend = backend pula. Direto, sem configuração custom.
2. **Grafo de tasks explícito** (`turbo.json`) — `build` do frontend automaticamente builda `@apex/shared` primeiro. Dependencies resolvidas declarativamente.
3. **pnpm** como package manager — symlinks duros, sem hoisting bagunçado do npm, sem disco de `node_modules` duplicado.
4. **Curva razoável** — Turborepo é simples em comparação com Nx. Documentação madura.
5. **Vercel é primeira classe** — Turborepo é Vercel (mesma empresa). Integração de cache é zero-config.

**Por que NÃO Nx:** time de 1 dev não precisa de generators e schematics. Footprint do Nx (`nx.json` + `project.json` por package) é overkill.

**Por que NÃO `@apex/contracts` separado:** não resolve o problema do E2E (Playwright ainda precisa do código backend rodando). E o ritual de `npm version` + publish pra cada mudança de schema desencoraja iterar contratos pequenos.

---

## 3. Estrutura proposta

```
apex-training/                       # repo monorepo novo
├── apps/
│   ├── backend/                     # ex-apex-training-backend
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── package.json
│   │   └── ...
│   └── frontend/                    # ex-apex-training-frontend
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── ...
├── packages/
│   ├── shared-schemas/              # Zod schemas extraídos
│   │   ├── src/
│   │   │   ├── auth.ts
│   │   │   ├── treino.ts
│   │   │   ├── prova.ts
│   │   │   └── ... (15 arquivos)
│   │   ├── package.json             # name: @apex/shared-schemas
│   │   └── tsconfig.json
│   ├── shared-types/                # tipos derivados de z.infer
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json             # name: @apex/shared-types
│   └── shared-constants/            # enums + labels (Modalidade, Faixa, ProvaPrioridade)
│       ├── src/
│       └── package.json             # name: @apex/shared-constants
├── tooling/                         # config compartilhada
│   ├── eslint-config/
│   └── tsconfig/
│       ├── base.json
│       ├── backend.json             # extends base, target Node 20
│       └── frontend.json            # extends base, target ESNext/JSX
├── .github/
│   └── workflows/
│       ├── ci.yml                   # build + test ambos apps
│       ├── e2e.yml                  # Playwright (substitui workflow desabilitado)
│       └── deploy.yml               # opcional
├── turbo.json                       # task graph
├── pnpm-workspace.yaml              # workspaces
├── package.json                     # root, com scripts cross-app
├── tsconfig.base.json
├── .gitignore
├── README.md                        # raiz do monorepo
├── SPRINT_POSTMORTEMS/              # governance técnica
│   ├── SPRINT13_POSTMORTEM.md
│   └── MONOREPO_MIGRATION_PLAN.md   # este arquivo
└── ...
```

### 3.1 Estratégia de extração

**Fase incremental — não Big Bang.**

1. Migrar com código inalterado (apps/backend, apps/frontend funcionando como antes).
2. **Depois** extrair `shared-schemas` schema por schema (começando por `auth`, `treino`, `prova`).
3. **Depois** extrair `shared-types` derivando dos schemas com `z.infer`.
4. Frontend troca imports de `@/types/treino` por `@apex/shared-types`.

Cada passo é reversível. Sem flag day.

---

## 4. Roteiro de migração (passo a passo)

### Step 0 — Pre-flight (1h)

- [ ] Criar repo `apex-training` vazio no GitHub.
- [ ] Verificar acesso ao Vercel project + Render service (precisamos alterar root directory).
- [ ] Mergear/fechar todos os PRs abertos em ambos os repos (snapshot limpo).
- [ ] Tag de safety nos dois repos atuais: `git tag pre-monorepo-snapshot && git push --tags`.

### Step 1 — Inicializar monorepo (1h)

```bash
mkdir apex-training && cd apex-training
git init -b main
pnpm init
mkdir -p apps packages tooling

# pnpm-workspace.yaml
cat > pnpm-workspace.yaml <<EOF
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
EOF

# Turborepo
pnpm add -D -w turbo
cat > turbo.json <<EOF
{
  "\$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {},
    "dev":   { "cache": false, "persistent": true }
  }
}
EOF
```

### Step 2 — Importar `apex-training-backend` preservando histórico (2h)

```bash
# Da raiz do monorepo
git remote add -f backend-origin https://github.com/GiovaneXavier/apex-training-backend.git
git subtree add --prefix=apps/backend backend-origin main
git remote remove backend-origin
```

`git subtree add` preserva o histórico inteiro do backend (66 commits, 2.4MB de `.git`) dentro do path `apps/backend/`. Verificável via `git log apps/backend/`.

### Step 3 — Importar `apex-training-frontend` preservando histórico (2h)

```bash
git remote add -f frontend-origin https://github.com/GiovaneXavier/apex-training-frontend.git
git subtree add --prefix=apps/frontend frontend-origin main
git remote remove frontend-origin
```

Mesma operação. 99 commits, 4MB.

**Após:** repo monorepo tem `apps/backend` e `apps/frontend` funcionais isoladamente. Cada um ainda roda com seu próprio `package.json`, `node_modules` isolado, `tsconfig.json` próprio.

### Step 4 — Ajustar package.json e instalar pnpm (2h)

- [ ] Renomear `apps/backend/package.json:name` de `apex-training-backend` para `@apex/backend`.
- [ ] Renomear `apps/frontend/package.json:name` para `@apex/frontend`.
- [ ] Apagar `apps/*/package-lock.json` (migra pra pnpm-lock.yaml na raiz).
- [ ] Apagar `apps/*/node_modules`.
- [ ] Da raiz: `pnpm install` — instala tudo.
- [ ] Da raiz: `pnpm --filter @apex/backend dev` — verificar que backend sobe.
- [ ] Da raiz: `pnpm --filter @apex/frontend dev` — verificar que frontend sobe.

**Checkpoint:** sem mudança funcional, monorepo já funciona. Commit + push pra `apex-training/main`.

### Step 5 — Extrair `packages/shared-schemas` (4-6h)

Refatoração incremental. Por schema:

```bash
# Criar pacote
mkdir -p packages/shared-schemas/src
cd packages/shared-schemas
pnpm init  # name: @apex/shared-schemas
pnpm add zod
```

Para cada schema do backend:
1. Mover `apps/backend/src/schemas/<X>.schemas.js` → `packages/shared-schemas/src/<X>.ts` (porta JS → TS).
2. Backend importa `from '@apex/shared-schemas/treino'` em vez de `from '../schemas/treino.schemas.js'`.
3. Adicionar `"@apex/shared-schemas": "workspace:*"` em `apps/backend/package.json` e `apps/frontend/package.json`.

**Ordem sugerida** (do menos para o mais usado):
1. `push.schemas` (PR #36 — bem isolado)
2. `prova.schemas` (PR #37 — caso de uso fresco)
3. `auth.schemas` (alta criticidade — testar bem)
4. `treino.schemas` (mais complexo — última pra ter máxima familiaridade)
5. Outros 11 schemas (rotina em rotina)

**Por que JS → TS:** Zod já é TS-native; manter `.js` no novo pacote desperdiça inferência. `tsc --emit declaration` gera `.d.ts` que o frontend consome.

### Step 6 — Extrair `packages/shared-types` (1-2h)

```ts
// packages/shared-types/src/index.ts
import { z } from 'zod';
import { provaSchema, criarProvaSchema } from '@apex/shared-schemas/prova';
import { treinoSchema } from '@apex/shared-schemas/treino';

export type Prova = z.infer<typeof provaSchema>;
export type CriarProvaInput = z.infer<typeof criarProvaSchema>;
export type Treino = z.infer<typeof treinoSchema>;
// ... etc
```

Frontend troca:
```ts
// antes
import type { Prova } from '@/types/treino';
// depois
import type { Prova } from '@apex/shared-types';
```

`apps/frontend/src/types/treino.ts` pode ser deletado depois que todo import migra.

### Step 7 — Reconfigurar Vercel (1h)

- Vercel project atual aponta pra repo `apex-training-frontend`.
- **Opções:**
  - **(a) Criar projeto novo** apontando pra `apex-training` com `Root Directory = apps/frontend`. Migrar domínio.
  - **(b) Editar projeto existente** mudando o GitHub repo + Root Directory. Mantém histórico de deploys.

Recomendo (b). Configuração:
```
Root Directory:       apps/frontend
Build Command:        cd ../.. && pnpm install && pnpm turbo run build --filter=@apex/frontend
Output Directory:     apps/frontend/dist
Install Command:      (vazio — incluído no Build Command)
```

**Build filters** (a parte que economiza minutos de build):
- Vercel detecta automaticamente que mudanças fora de `apps/frontend/` + `packages/` não devem disparar deploy.
- Configurar `Ignored Build Step`:
  ```bash
  git diff HEAD^ HEAD --quiet -- apps/frontend packages
  ```
  Se retornar 0 (sem mudanças relevantes), Vercel pula build.

### Step 8 — Reconfigurar Render (1h)

Backend está no Render. Mesma lógica:
- Editar service → `Root Directory: apps/backend`.
- Build Command: `cd ../.. && pnpm install && pnpm turbo run build --filter=@apex/backend`.
- Start Command: `cd apps/backend && pnpm start`.
- **Build filter** via Render API ou `render.yaml`:
  ```yaml
  services:
    - type: web
      name: apex-backend
      buildFilter:
        paths:
          - apps/backend/**
          - packages/**
          - pnpm-lock.yaml
  ```

### Step 9 — Migrar CI workflows (2h)

- [ ] Apagar `apex-training-frontend/.github/workflows/*` (sumiu com o subtree, validar).
- [ ] Apagar `apex-training-backend/.github/workflows/*` (idem).
- [ ] Criar `.github/workflows/ci.yml` na raiz:

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint test build
```

- [ ] Criar `.github/workflows/e2e.yml` reusando aprendizado do PR #16 (mas SEM o `Resolve backend ref` — agora backend está no mesmo checkout):

```yaml
name: E2E
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, ... }
    steps:
      - uses: actions/checkout@v4   # único checkout
      - run: pnpm install
      - run: pnpm --filter @apex/backend prisma migrate deploy
      - run: pnpm --filter @apex/backend db:seed
      - run: pnpm --filter @apex/backend start &
      - run: pnpm --filter @apex/frontend build
      - run: pnpm --filter @apex/frontend preview &
      - run: pnpm --filter @apex/frontend playwright install --with-deps chromium
      - run: pnpm --filter @apex/frontend test:e2e
```

**Comparar com PR #16:** desaparece `BACKEND_REPO_TOKEN`, `Resolve backend ref`, segundo `checkout`, dependência cross-repo. **Workflow encolhe em ~30%.**

### Step 10 — Arquivar repos antigos (30min)

- [ ] Adicionar `README.md` em `apex-training-backend` e `apex-training-frontend`:
  > **Arquivado em 2026-MM-DD.** O código vive agora em [apex-training](https://github.com/GiovaneXavier/apex-training) como monorepo.
- [ ] Marcar repos como `archived` no GitHub Settings (read-only).

---

## 5. CI/CD na prática — antes vs depois

### Antes (estado atual)

```
PR no frontend → Vercel build frontend
PR no backend  → Render build backend
PR cross-stack → 2 PRs encadeados, ordem de merge rígida, Playwright cross-repo bloqueado
```

### Depois (monorepo)

```
PR mexe só em apps/frontend     → Vercel build, Render pula
PR mexe só em apps/backend      → Render build, Vercel pula
PR mexe em packages/shared-*    → ambos buildam (correto — contrato mudou)
PR cross-stack                  → 1 PR atômico, review único, deploy coordenado
```

### Métrica de sucesso

- Tempo médio de PR cross-stack: **antes >24h** (ordem A→B→C) → **depois <2h** (PR único).
- Builds Vercel/Render economizados: **estimativa 30-50% de redução** (build filters).
- Erros tipo TS strict drift backend ↔ frontend: **antes recorrente** → **depois impossível** (mesmo `tsc` valida tudo).

---

## 6. Estimativa de tempo + custo

| Etapa | Horas |
|---|---|
| Step 0 — Pre-flight | 1 |
| Step 1 — Init monorepo | 1 |
| Step 2 — Subtree backend | 2 |
| Step 3 — Subtree frontend | 2 |
| Step 4 — pnpm install + smoke | 2 |
| Step 5 — Extrair shared-schemas | 4-6 |
| Step 6 — Extrair shared-types + refator imports | 1-2 |
| Step 7 — Reconfigurar Vercel | 1 |
| Step 8 — Reconfigurar Render | 1 |
| Step 9 — Migrar CI workflows | 2 |
| Step 10 — Arquivar repos antigos | 0.5 |
| **Buffer** (incertezas, debug, rebote) | 4-8 |
| **TOTAL** | **21-28h** |

**Janela recomendada:** **3 dias úteis** (Sprint dedicada, sem outras entregas em paralelo).

### Payback

Custo da fricção atual estimado: **6-8h por Sprint cross-stack**.
Custo amortizado em: **3-4 Sprints**.

Daí em diante, é lucro recorrente.

---

## 7. Riscos identificados

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Deploy Vercel ou Render quebrar durante reconfigura | Média | Step 7-8 em horário de baixo tráfego; manter projetos antigos vivos até validar novos |
| Histórico git fica desalinhado pós-subtree | Baixa | `git subtree` é estável; validar com `git log apps/backend/` antes de seguir |
| Curva de Turborepo atrasa Sprints subsequentes | Baixa | Docs maduras; pnpm workspaces puro já cobre 80% mesmo sem Turbo — Turbo é incremental |
| Extração de schemas quebra contratos da API | Média | Step 5 é incremental schema-por-schema; cada extração tem PR isolado com tests verde antes de prosseguir |
| Vercel Remote Caching de Turborepo precisa de auth token | Baixa | Free tier suporta; configuração é 1 env var |
| `tsc` strict pega bugs latentes em arquivos antes não conferidos | **Alta** ⚠️ | **Esperado e bom**. Reserva buffer pra fixes durante Step 4. |
| Sentry config dual atrapalha (backend usa `@sentry/node`, frontend `@sentry/react`) | Baixa | Continuam isolados; só consolidar versionamento via `pnpm-lock` |
| Render não suporta build filter via UI (precisa `render.yaml`) | Média | Validar antes; alternativa é deploy sem filter (não ganha tempo mas funciona) |

---

## 8. Veredito

### GO se:
- ✅ Houver janela de **3 dias dedicados** sem entregas de produto críticas.
- ✅ Sprint 15+ tem temas cross-stack previsíveis (cada Sprint cobra fricção).
- ✅ Time aceita 1 dia de "atraso aparente" em troca de redução de fricção a longo prazo.

### NO-GO se:
- ❌ Roadmap dos próximos 2 meses é 100% frontend OU 100% backend (raro).
- ❌ Vercel/Render não suportam Root Directory configurável (não é o caso — ambos suportam).
- ❌ Time prefere risco de fricção contínua a risco de migração pontual.

### Recomendação final

**GO.** Sprint 14 já mostrou que cada feature cross-stack cobra preço. O custo de migração (~3 dias) é amortizado em 3-4 Sprints. Daí em diante, é lucro recorrente — tempo do dev fica em código de produto, não em ritual de PR cross-repo.

**Janela sugerida:** Sprint 16. Razões:
- Sprint 15 entra com tema de produto (deixa Sprint 14 fechada limpa).
- Sprint 16 é a primeira parada técnica natural pós-Race A entregue.
- 3 dias da Sprint 16 dedicados à migração + 2 dias pra entrega menor de produto que valide o monorepo no fluxo real.

---

## 9. Próximos passos

Se o veredito for **GO**:
1. Schedular a Sprint 16 com escopo claramente bloqueado pra migração.
2. Criar issue no repo atual: "Migração monorepo — Sprint 16" com link pra este documento.
3. **Antes da Sprint 16:** revisar se Vercel/Render alteraram suporte a Root Directory + Build Filters.
4. **Durante a Sprint 16:** seguir os 10 steps como checklist; commit por step pra rollback fácil.
5. **Pós-Sprint 16:** retomar PR Playwright (que ficou WIP) com workflow simplificado.

Se o veredito for **NO-GO**:
1. Aceitar a fricção como conhecida; documentar workarounds em README de cada repo.
2. Investir em automação pra reduzir fricção: scripts que validam contratos cross-repo, lint rule que rejeita import direto de tipos sem `as const`.
3. Revisitar este documento daqui 2-3 Sprints — se a fricção projetada se materializar.

---

## Apêndice A — Estrutura final esperada do `package.json` raiz

```json
{
  "name": "apex-training",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev:back": "pnpm --filter @apex/backend dev",
    "dev:front": "pnpm --filter @apex/frontend dev",
    "dev": "turbo run dev --parallel",
    "test:e2e": "pnpm --filter @apex/frontend test:e2e",
    "prisma:migrate": "pnpm --filter @apex/backend prisma migrate dev",
    "prisma:seed": "pnpm --filter @apex/backend db:seed"
  },
  "devDependencies": {
    "turbo": "^2.x",
    "typescript": "^5.6.x",
    "prettier": "^3.x"
  },
  "packageManager": "pnpm@9.x",
  "engines": { "node": ">=20" }
}
```

## Apêndice B — Comandos diários no monorepo

```bash
# Subir backend + frontend em paralelo (dev)
pnpm dev

# Rodar só backend
pnpm dev:back

# Testar tudo (Turbo cacheia tasks unchanged)
pnpm test

# Build incremental
pnpm build

# Adicionar dep em um pacote específico
pnpm --filter @apex/frontend add date-fns
pnpm --filter @apex/backend add @aws-sdk/client-ses

# Adicionar dep no shared (zod)
pnpm --filter @apex/shared-schemas add zod
```

## Apêndice C — Comparação rápida de imports

| Antes (split) | Depois (monorepo) |
|---|---|
| Backend: `import { provaSchema } from '../schemas/prova.schemas.js'` | `import { provaSchema } from '@apex/shared-schemas/prova'` |
| Frontend: `import type { Prova } from '@/types/treino'` (duplicado manual) | `import type { Prova } from '@apex/shared-types'` (derivado de `z.infer`) |
| Mudar Prova: 2 PRs em 2 repos | 1 PR em 1 repo |

---

**Fim do draft.**

Próxima ação: revisão do documento → decisão go/no-go → se GO, agendar Sprint dedicada.
