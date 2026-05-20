# Sprint 13 — Postmortem da entrega E2E

**Data:** 2026-05-19
**Audiência:** Arquiteto do sistema
**Escopo:** Lições da tentativa de subir Playwright E2E (PR #35) e descobertas correlatas

---

## TL;DR

Tentando montar o pipeline E2E descobrimos **4 bugs latentes** (3 ativos, 1 introduzido na própria Sprint). Nenhuma spec E2E foi executada com sucesso ainda, mas o caminho até elas funcionou como um *scanner de vulnerabilidades de infra*. Sugestão: mergear os PRs de valor concreto (#36 backend + frontend + fix migration), pausar o PR #35 como WIP, e revisitar a estratégia de E2E com escopo mais enxuto.

---

## Incidentes encontrados

### 1. TypeScript TS2769 em `sw.ts` (Service Worker)

| Campo | Detalhe |
|---|---|
| **Sintoma** | `npm run build` falhou no Vercel: `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BufferSource'`. |
| **Causa raiz** | `lib.dom.d.ts` tipa `applicationServerKey` como `BufferSource` (= `ArrayBufferView<ArrayBuffer>`). Em TS 5.6 `Uint8Array` virou genérico `Uint8Array<ArrayBufferLike>`, e o unifier considera `SharedArrayBuffer` parte do union — falha mesmo sendo seguro em runtime. |
| **Onde nasceu** | Introduzido no próprio PR #36 (parte 2, VAPID hash). O `registerPush.ts` já tinha o workaround correto; faltou replicar no `sw.ts`. |
| **Fix** | Cast `as unknown as BufferSource`. |
| **Status** | Resolvido (frontend [#15](https://github.com/GiovaneXavier/apex-training-frontend/pull/15)). |
| **Lição** | TypeScript estrito + APIs DOM antigas geram fricção previsível. **Recomendação arquitetural:** criar um helper único `toApplicationServerKey(string): BufferSource` em `lib/push/` e usar em todos os call sites (DRY do cast inseguro num único ponto auditável). |

---

### 2. Workflow CI com checkout encadeado frágil

| Campo | Detalhe |
|---|---|
| **Sintoma** | `actions/checkout` do repo backend falhava com `fatal: ambiguous argument 'HEAD'` na segunda tentativa. |
| **Causa raiz** | Padrão de "tentar a branch do PR, se falhar usar main" foi implementado com 2 steps de `checkout` encadeados via `if: failure()`. O primeiro inicializava `./backend/.git/` em estado parcial; o segundo tentava `git reset --hard HEAD` num diretório sem `HEAD` válido. |
| **Onde nasceu** | Workflow inicial do PR #35 — erro de design do próprio workflow. |
| **Fix** | Único step `Resolve backend ref` via `git ls-remote --heads --exit-code` pré-resolvendo o ref antes do checkout. Output consumido pelo único `actions/checkout`. |
| **Status** | Resolvido (frontend [#16](https://github.com/GiovaneXavier/apex-training-frontend/pull/16)). |
| **Lição** | `if: failure()` em GH Actions cascateia estado. Padrão correto = step de descoberta + step de ação. **Recomendação arquitetural:** documentar este padrão no playbook de CI interno. |

---

### 3. Permissões cross-repo no monorepo split

| Campo | Detalhe |
|---|---|
| **Sintoma** | `fatal: repository 'https://github.com/GiovaneXavier/apex-training-backend/' not found` no workflow. Erro disfarçado de "permission denied". |
| **Causa raiz** | `apex-training-backend` é repo **privado**. O `GITHUB_TOKEN` default do Actions é escopado ao repo do workflow (frontend). Não atravessa para outros repos privados, mesmo do mesmo owner. |
| **Onde nasceu** | Decisão estratégica antiga (separar frontend/backend em repos). Custo emergiu ao tentar E2E que precisa dos dois. |
| **Fix** | Criar PAT (ou reusar OAuth token do `gh` CLI temporariamente) e salvar como secret `BACKEND_REPO_TOKEN`. |
| **Status** | Resolvido temporariamente com token OAuth do `gh`. **Dívida:** PAT dedicado fine-grained scope. |
| **Lição** | **A divisão monorepo-split tem custo recorrente** em qualquer integração que cruze a fronteira: CI, E2E, deploy coordenado, geração de tipos compartilhados. **Recomendação arquitetural:** auditar se o split ainda paga o preço. Alternativas: (a) monorepo único (pnpm/turborepo) com workspaces; (b) manter split mas formalizar o backend como package privado publicado em npm/GitHub Packages com tipos versionados, eliminando a necessidade de checkout cross-repo. |

---

### 4. Banner do Prisma CLI dentro de migration SQL

| Campo | Detalhe |
|---|---|
| **Sintoma** | `Error P3018 — ERROR: syntax error at or near "┌─────...─────┐" Position: 10469` ao aplicar `20260505000000_init/migration.sql` em CI com banco limpo. |
| **Causa raiz** | Linhas 311-320 do arquivo continham o banner stdout do Prisma CLI ("Update available 5.22.0 -> 7.8.0") desenhado com box-drawing Unicode. Provavelmente um redirect de output (`> migration.sql`) durante geração local capturou stdout do CLI junto com o SQL. |
| **Onde nasceu** | 2026-05-05 (commit da migration inicial). **Bug latente há 14 dias.** |
| **Por que não pegou antes** | Em prod/dev a migration já está marcada como aplicada em `_prisma_migrations`. Prisma só lê o arquivo no `migrate deploy` quando precisa aplicar do zero. Cobertura silenciosa. |
| **Quem teria pegado** | Qualquer dev novo clonando o repo e rodando `prisma migrate dev`. Onboarding ia quebrar. |
| **Fix** | Truncar arquivo na linha 310 (último `ALTER TABLE` legítimo). Após merge, ambientes existentes precisam de `prisma migrate resolve --applied 20260505000000_init` uma vez (atualiza checksum, não recria nada). |
| **Status** | Resolvido (backend [#14](https://github.com/GiovaneXavier/apex-training-backend/pull/14)). |
| **Lição** | Migrations só são auditadas no apply inicial. **Recomendações arquiteturais:** (a) regra de lint pré-commit: `head -c 4 migration.sql` aceita só `--` ou `CREATE`/`ALTER`/etc; rejeita Unicode não-ASCII; (b) job de CI que roda `prisma migrate deploy` num Postgres efêmero a cada PR que toca `prisma/migrations/` — garante que migrations são aplicáveis do zero, não só incrementalmente. |

---

## Padrões transversais

### Bugs latentes vs. bugs introduzidos

| | Quantidade |
|---|---|
| Latentes (existiam, não detectados) | **3** (#1 parcial — TS strict pegou só em build prod; #3 cross-repo auth; #4 migration) |
| Introduzidos na Sprint | **1** (#2 workflow) |

**Insight:** o tooling de E2E não está "criando trabalho" — está **expondo dívida técnica acumulada**. Cada um dos 3 latentes era uma bomba-relógio com gatilho diferente (build prod, onboarding novo dev, integração cross-repo).

### Cascata de descoberta

Cada fix expôs o próximo bug. Padrão clássico de pipeline novo cruzando fronteiras nunca antes integradas. **Expectativa razoável:** mais 1-3 ondas até o primeiro run verde, especialmente nos specs (seletores text-based vão falhar em UI sem `data-testid`).

---

## Recomendações estratégicas

### Curto prazo (esta Sprint)

1. **Mergear o que tem valor concreto:**
   - backend [#13](https://github.com/GiovaneXavier/apex-training-backend/pull/13) (hash VAPID)
   - backend [#14](https://github.com/GiovaneXavier/apex-training-backend/pull/14) (fix migration — útil independente do E2E)
   - frontend [#15](https://github.com/GiovaneXavier/apex-training-frontend/pull/15) (AbortController + VAPID hash check)

2. **Pausar o PR #35 (E2E) como WIP.** Sprint 13 fecha com 3 PRs entregues + dívida E2E explicitamente documentada.

### Médio prazo (próximas 2-3 Sprints)

3. **Auditar estratégia de repos.** O custo do split (#3) só vai crescer. Decisão entre:
   - **Monorepo único** com pnpm workspaces + Turborepo. Migração ~2 dias. Elimina classes inteiras de problema (E2E, tipos compartilhados, deploy atômico).
   - **Manter split** mas extrair contratos (DTOs Zod, tipos Prisma) num pacote npm interno versionado.

4. **Hardening de migrations Prisma.** O bug #4 era invisível porque migrations só rodam do zero em ambientes novos. Mitigação:
   - Pre-commit hook validando ASCII-only no início de linhas SQL.
   - Job CI dedicado: a cada PR que toca `prisma/migrations/`, sobe Postgres efêmero e roda `migrate deploy`. Custo: ~30s/PR.

5. **Reduzir escopo do E2E.** A ambição de "Spec A + B + C + CI workflow + mobile + desktop" no PR de scaffolding foi grande demais. Próxima tentativa:
   - **Apenas Spec A** (ciclo de vida do treino).
   - **Sem CI** inicialmente — só local. Provar valor primeiro.
   - **Adicionar `data-testid`** antes de escrever os specs, não depois.
   - Quando estável, expandir.

### Longo prazo (auditoria)

6. **Mapear outros pontos de drift checksum-based.** Prisma migrations não é o único — qualquer artefato que tem checksum mas não é re-aplicado em prod (cache de IA, embeddings, schemas Zod inferidos) pode esconder o mesmo padrão.

7. **Padronizar token cross-repo.** Documentar no playbook de infra que qualquer integração cross-repo no GitHub precisa de PAT dedicado (ou GitHub App, mais robusto que PAT). Não confiar em `GITHUB_TOKEN` default.

---

## Anexo: estado final dos PRs

| Repo | PR | Branch | Conteúdo | Status |
|---|---|---|---|---|
| backend | [#13](https://github.com/GiovaneXavier/apex-training-backend/pull/13) | `feat/pr-36-vapid-hash-v2` | SHA-256 hash VAPID | Mergeado |
| backend | [#14](https://github.com/GiovaneXavier/apex-training-backend/pull/14) | `feat/pr-35-playwright-e2e-v2` | Fix migration `_init` | Mergeado |
| frontend | [#15](https://github.com/GiovaneXavier/apex-training-frontend/pull/15) | `feat/pr-36-abort-vapid-v2` | AbortController + VAPID client | Mergeado |
| frontend | [#16](https://github.com/GiovaneXavier/apex-training-frontend/pull/16) | `feat/pr-35-playwright-e2e-v2` | Playwright E2E + CI | **WIP — pausado** |

PRs antigos (#12 backend, #13 e #14 frontend) fechados como redundantes — superseded pelos v2.
