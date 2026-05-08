import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  MODALIDADE_LABEL,
  type CiclismoBloco,
  type CorridaBloco,
  type CorridaBlocoTipo,
  type HyroxBloco,
  type HyroxExercicio,
  type HyroxExercicioMov,
  type HyroxFormato,
  type Modalidade,
  type NatacaoBloco,
  type ZonaFTP,
} from '@/types/treino';

// HYROX no front é mapeado pra modalidade OUTRO no backend (Prisma enum sem HYROX).
export type ModalidadeUI = Modalidade | 'HYROX';

export const MODALIDADES_UI: ModalidadeUI[] = [
  'MUSCULACAO', 'CORRIDA', 'CICLISMO', 'NATACAO', 'HYROX', 'OUTRO',
];

export const MODALIDADE_UI_LABEL: Record<ModalidadeUI, string> = {
  ...MODALIDADE_LABEL,
  HYROX: 'Hyrox',
  TRIATHLON: 'Triathlon',
};

// ─────────────────────────────────────────────────────────────
// Tipo de form de musculação (com referência opcional ao catálogo)
// ─────────────────────────────────────────────────────────────
export type ExerForm = {
  exercicioId?: string; // ref ao catálogo Exercicio
  nome: string;
  videoUrl: string;
  series: number;
  reps: number;
  cargaPctRP?: number;
  descansoSeg: number;
};

// ─────────────────────────────────────────────────────────────
// Defaults para novos blocos (factory)
// ─────────────────────────────────────────────────────────────
export const novoExercicio = (): ExerForm => ({
  nome: '', videoUrl: '', series: 3, reps: 12, cargaPctRP: 70, descansoSeg: 90,
});

export const novoCorridaBloco = (tipo: CorridaBlocoTipo = 'tiro'): CorridaBloco => ({
  tipo,
  distanciaM: tipo === 'aquecimento' || tipo === 'volta_calma' ? 1000 : 400,
  ritmoAlvoMinKm: '5:00',
  repeticoes: tipo === 'tiro' ? 6 : 1,
  recuperacaoSeg: tipo === 'tiro' ? 90 : 0,
  recuperacaoTipo: 'trote',
});

export const novoCiclismoBloco = (zona: ZonaFTP = 4): CiclismoBloco => ({
  tipo: 'intervalo',
  zonaFTP: zona,
  potenciaAlvoPctFTP: zona === 4 ? 100 : zona === 5 ? 110 : 70,
  duracaoSeg: 300,
  repeticoes: 4,
  recuperacaoSeg: 180,
});

export const novoNatacaoBloco = (): NatacaoBloco => ({
  tipo: 'principal',
  repeticoes: 10,
  distanciaM: 100,
  estilo: 'LIVRE',
  paceCssOffsetSeg: 2,
  descansoSeg: 15,
});

export const novoHyroxExercicio = (
  mov: HyroxExercicioMov = 'WALL_BALLS',
): HyroxExercicio => ({
  movimento: mov,
  repeticoes: 50,
  carga: { open: 6, pro: 9, unidade: 'kg' },
});

export const novoHyroxBloco = (formato: HyroxFormato = 'AMRAP'): HyroxBloco => {
  const base: HyroxBloco = { formato };
  if (formato === 'AMRAP') return { ...base, duracaoSeg: 600, exercicios: [novoHyroxExercicio()] };
  if (formato === 'EMOM') return { ...base, rounds: 10, intervaloOffSeg: 60, exercicios: [novoHyroxExercicio()] };
  if (formato === 'FOR_TIME') return { ...base, duracaoSeg: 1200, exercicios: [novoHyroxExercicio()] };
  if (formato === 'TABATA') return { ...base, rounds: 8, intervaloOnSeg: 20, intervaloOffSeg: 10, exercicios: [novoHyroxExercicio()] };
  if (formato === 'INTERVAL') return { ...base, rounds: 5, intervaloOnSeg: 60, intervaloOffSeg: 30, exercicios: [novoHyroxExercicio()] };
  if (formato === 'RUN') return { ...base, distanciaM: 1000, ritmoAlvoMinKm: '5:00' };
  return { ...base, exercicios: [novoHyroxExercicio()] }; // STATION
};

// ─────────────────────────────────────────────────────────────
// Primitivos UI compartilhados
// ─────────────────────────────────────────────────────────────
export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
      {children}
    </div>
  );
}

export function ModeToggle<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1.5 mb-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 py-2 rounded-[10px] text-[11px] font-bold uppercase tracking-wider',
            value === o.value
              ? 'bg-ink text-bg'
              : 'bg-surface border border-app-strong text-ink-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BlocoCard({
  index, total, label, onRemove, children,
}: {
  index: number;
  total: number;
  label: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="p-3 mb-2 rounded-[14px] bg-surface border border-app">
      <div className="flex items-center justify-between mb-2">
        <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
          {label} {String(index + 1).padStart(2, '0')}
        </span>
        {onRemove && total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] uppercase tracking-wider text-danger"
          >
            remover
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function NativeSelect<T extends string>({
  value, onChange, options, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        'w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
