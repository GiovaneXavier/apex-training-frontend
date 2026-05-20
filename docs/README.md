# Apex Training — Governance Docs

Documentos de governança técnica do projeto. Hoje vivem aqui em `apex-training-frontend/docs/` por pragmatismo (frontend é o repo de maior tráfego); migram naturalmente pra raiz do monorepo quando a Sprint 16 executar o plano.

## Índice

| Doc | Sprint | Resumo |
|---|---|---|
| [SPRINT13_POSTMORTEM.md](./SPRINT13_POSTMORTEM.md) | 13 | 4 bugs latentes expostos pelo setup do Playwright E2E (TS2769 sw.ts, workflow checkout cascading, PAT cross-repo, banner Prisma na migration). Insight: o tooling de E2E não criou trabalho — expôs dívida acumulada. |
| [MONOREPO_MIGRATION_PLAN.md](./MONOREPO_MIGRATION_PLAN.md) | 14 (spike PR #40) | Diagnóstico de 15 schemas Zod sem espelho TS no front + plano 10-steps pra migrar pra `pnpm workspaces + Turborepo`. Veredito: GO Sprint 16. |

## Convenção

- Um arquivo por entrega de governança (postmortem, spike, ADR).
- Nomes em SCREAMING_SNAKE.md.
- Linkar de PRs relevantes pra rastreabilidade.
