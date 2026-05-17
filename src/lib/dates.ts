// Utilitários de data compartilhados (PR #14, audit 4.18).
//
// Espelha o contrato do backend (lib/dates.js). Centralizar aqui elimina
// a divergência histórica entre WeeklyTimeline.tsx, Dashboard.tsx,
// Calendario.tsx e o backend — todos calculavam "início da semana"
// independente, com uma das implementações pulando para domingo e
// quebrando o filtro do dashboard nas madrugadas de segunda.

/** Início da semana corrente (segunda 00:00:00 — hora local, padrão BR). */
export function inicioSemana(d: Date = new Date()): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const dow = date.getDay(); // 0=dom..6=sab
  const diffParaSegunda = (dow + 6) % 7;
  date.setDate(date.getDate() - diffParaSegunda);
  return date;
}

/** Próxima segunda 00:00:00 (exclusiva — use com `<` em filtros). */
export function fimSemana(d: Date = new Date()): Date {
  const ini = inicioSemana(d);
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 7);
  return fim;
}

/** Chave estável "YYYY-MM-DD" (hora local) para indexar Map por dia. */
export function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mesma data civil (ignorando hora) entre dois Date. */
export function mesmaData(a: Date, b: Date): boolean {
  return key(a) === key(b);
}

// ─────────────────────────────────────────────────────────────────────
// PR #14 (audit 4.19) — hora local do dispositivo, não 7AM hardcoded.
//
// O fluxo "iniciar treino" deve registrar o INÍCIO REAL no relógio do
// atleta. Antes: `setHours(7,0,0,0)` em Dashboard.tsx e Calendario.tsx
// produzia timestamp errado para qualquer atleta que treinasse fora do
// horário comercial. Backend valida janela [-7d, +5min] no schema.
//
// Para o caso de "iniciar treino de outro dia" (revisar semana passada,
// pré-agendar pra amanhã), mantemos a DATA selecionada mas substituímos
// só a parte horária pela hora atual. Backend rejeita se cair fora da
// janela.
// ─────────────────────────────────────────────────────────────────────

/** Combina a data civil de `dia` com a hora atual do dispositivo. */
export function comHoraAtual(dia: Date): Date {
  const agora = new Date();
  const out = new Date(dia);
  out.setHours(agora.getHours(), agora.getMinutes(), agora.getSeconds(), 0);
  return out;
}
