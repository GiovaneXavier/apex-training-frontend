# Apex Training — Frontend

PWA mobile-first para sistema multi-sports de prescrição e execução de treinos. Stack: **React + Vite + Tailwind + Shadcn UI**.

## Design

Duas direções visuais:

- **Light Minimal** — Shadcn-style, branco, ink quase preto, acento configurável (verde/azul/laranja/ink).
- **Dark Atlético** — preto profundo `#0a0a0b`, laranja energético `#ff6b1a`, números em monoespaçada.

Mobile-first (380×760 base), cantos arredondados, tipografia tabular para números.

## Recursos-chave

- **Offline-first** — tela de execução guarda estado em `localStorage`, sincroniza ao voltar.
- **Multi-sports** — UI gerada dinamicamente do JSON `detalhes` do treino (musculação, corrida, natação).
- **PWA** — Service Worker + manifest.
- **Strava** — botão de sync manual no dashboard do aluno.
- **Celebração de RP** — overlay disparado por flag `novoRecorde` do backend.

## Rotas

```
/login, /cadastro
/aluno/dashboard      /aluno/treino/:id   /aluno/calendario   /aluno/rps   /aluno/perfil
/professor/dashboard  /professor/alunos   /professor/aluno/:id  /professor/prescrever
/nutri/dashboard
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Branches

- `main` — produção
- `dev` — integração
- `feature/sX-nome` — sprints
