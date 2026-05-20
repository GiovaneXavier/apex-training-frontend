// PR #39 (Sprint 14) — Helpers do macro-ciclo do atleta.
//
// Lógica de tempo + classificação de fase (Race A/B/C). Pura, sem React,
// sem fetch — testável em isolamento.
//
// Compartilhado entre:
//   - <ProximaProvaWidget />   (Dashboard do aluno, PR #38 — hero card)
//   - <ProvaAlvoBanner />      (Prescrever do professor, PR #39 — banner)
//
// Quando PR futuro (IA do Coach) precisar derivar a fase no backend para
// validar prescrição, espelhar essa mesma lógica em JS no backend OU
// extrair para um pacote `@apex/macrociclo` no monorepo (PR #40 spike).

export type FaseMacrociclo =
  | 'base'       // > 30d: rodagem de base, sem foco de prova ainda
  | 'peak'       // 15-30d: build / pico de carga
  | 'taper'      // 8-14d: polimento, redução de volume
  | 'race-week'  // 1-7d: semana da prova, intensidade muito reduzida
  | 'race-day'   // 0d: hoje é o dia
  | 'post';      // < 0d: prova já passou, ainda não arquivada

// Classifica dias restantes em fase. Função pura — sem efeitos colaterais.
// Por que escalada vs binário taper/normal:
//   - Atleta processa proximidade em curvas, não em saltos.
//   - Fronteira 14→13d é computacional, não evento real do macrociclo.
//   - race-week (≤7d) tem protagonismo visual sem "queimar" o impacto
//     da semana anterior (taper já avisa que está chegando).
export function faseMacrociclo(dias: number): FaseMacrociclo {
  if (dias < 0) return 'post';
  if (dias === 0) return 'race-day';
  if (dias <= 7) return 'race-week';
  if (dias <= 14) return 'taper';
  if (dias <= 30) return 'peak';
  return 'base';
}

// Extrai YYYY-MM-DD da ISO string e cria Date local. Evita o shift de
// fuso horário que aconteceria em `new Date(iso)` quando o servidor
// grava em UTC e o cliente vive em outro TZ (ex: atleta em SP grava
// prova pro dia 29; coach em Tóquio veria 28 com `setHours(0)` clássico).
// Defensivo: se a string não tem 'T' (ex: "2026-08-29" puro), o split
// ainda funciona — pega tudo antes do primeiro T (ou a string toda).
function isoParaDataLocal(iso: string): Date {
  const datePart = iso.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Mede DIAS-CIVIS de hoje até o dia da prova (não horas). Garante
// que "hoje" mostre 0 mesmo se a prova for às 23h, e que "amanhã"
// mostre 1 mesmo se for às 01h.
export function diasAteIso(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = isoParaDataLocal(iso);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

// Decide o número + unidade exibida no countdown. Garante coerência:
// nunca exibe "30" com label "semanas" (bug original do PR #21).
export function displayCountdown(dias: number): { numero: string; unidade: string } {
  if (dias < 0) return { numero: '—', unidade: 'passou' };
  if (dias === 0) return { numero: '0', unidade: 'é hoje' };
  if (dias <= 14) {
    return {
      numero: String(dias),
      unidade: dias === 1 ? 'dia restante' : 'dias restantes',
    };
  }
  const semanas = Math.round(dias / 7);
  return {
    numero: String(semanas),
    unidade: semanas === 1 ? 'semana restante' : 'semanas restantes',
  };
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDataCurta(iso: string): string {
  // Mesmo cuidado de TZ que diasAteIso — usa o YYYY-MM-DD da string,
  // não a interpretação local do timestamp UTC.
  const d = isoParaDataLocal(iso);
  return `${d.getDate()}/${MESES_CURTO[d.getMonth()]}`;
}
