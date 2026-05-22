// PR #33 — utilitários compartilhados entre as Seções de Progresso.
// Mantém helpers que ambas tabs usam SEM duplicar código nem forçar
// import cruzado entre os chunks lazy.

export const CORAL = '#fc4c02';
export const CORAL_DARK = '#0a0a0b';

export function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function fmtDataLonga(iso: string): string {
  const d = new Date(iso);
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${d.getDate().toString().padStart(2, '0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

export function interpretarIMC(imc: number): string {
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Saudável';
  if (imc < 30) return 'Sobrepeso';
  return 'Acima da faixa';
}

export function FlameIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="0.5">
      <path d="M13 .5C13 4 10 6 10 9c0 1.5.5 2.5 1 3.5-1-.5-2-1-2.5-2.5-1 1.5-1.5 3-1.5 4.5C7 18.5 9.7 22 13 22s6-3.5 6-7.5C19 8 13 6 13 .5Z" />
    </svg>
  );
}

export function ResumoCardSimples({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1.5">
        {titulo}
      </div>
      <div className="text-mono tabular text-[22px] font-bold text-ink leading-none">{valor}</div>
    </div>
  );
}
