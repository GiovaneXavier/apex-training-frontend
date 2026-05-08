import { Field } from '@/components/auth/Field';
import {
  HYROX_MOV_LABEL,
  type HyroxBloco,
  type HyroxExercicio,
  type HyroxExercicioMov,
  type HyroxFormato,
} from '@/types/treino';
import { BlocoCard, Label, novoHyroxBloco, novoHyroxExercicio } from './shared';

// Lista padronizada das estações Hyrox oficiais (ordem de prova)
const ESTACOES_HYROX: HyroxExercicioMov[] = [
  'SKI_ERG',
  'SLED_PUSH',
  'SLED_PULL',
  'BURPEE_BROAD_JUMP',
  'ROWING',
  'FARMERS_CARRY',
  'SANDBAG_LUNGES',
  'WALL_BALLS',
];

const FORMATO_LABEL: Record<HyroxFormato, string> = {
  AMRAP: 'AMRAP',
  EMOM: 'EMOM',
  FOR_TIME: 'For Time',
  TABATA: 'Tabata',
  INTERVAL: 'Intervalo',
  RUN: 'Run',
  STATION: 'Estação',
};

type Props = {
  blocos: HyroxBloco[];
  onBlocos: (v: HyroxBloco[]) => void;
};

export function FormHyrox({ blocos, onBlocos }: Props) {
  const update = (i: number, patch: Partial<HyroxBloco>) =>
    onBlocos(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onBlocos(blocos.filter((_, idx) => idx !== i));
  const add = (formato: HyroxFormato) => onBlocos([...blocos, novoHyroxBloco(formato)]);

  // Atalho: gera prova oficial Hyrox (8×1km + 8 estações)
  function gerarProvaOficial() {
    const novos: HyroxBloco[] = [];
    for (let i = 0; i < 8; i++) {
      novos.push({ formato: 'RUN', distanciaM: 1000, ritmoAlvoMinKm: '5:00' });
      novos.push({
        formato: 'STATION',
        exercicios: [novoHyroxExercicio(ESTACOES_HYROX[i])],
      });
    }
    onBlocos(novos);
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Blocos ({blocos.length})</Label>
        <button
          type="button"
          onClick={gerarProvaOficial}
          className="text-[11px] font-bold uppercase tracking-wider text-accent"
        >
          ⚡ Prova oficial 8+8
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-3">
        {(['RUN', 'STATION', 'AMRAP', 'EMOM', 'FOR_TIME', 'TABATA', 'INTERVAL'] as HyroxFormato[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => add(f)}
              className="py-1.5 rounded-[8px] text-[10px] font-bold uppercase tracking-wider bg-surface border border-app-strong text-accent"
            >
              +{FORMATO_LABEL[f]}
            </button>
          ),
        )}
      </div>

      {blocos.map((b, i) => (
        <BlocoCard
          key={i}
          index={i}
          total={blocos.length}
          label={FORMATO_LABEL[b.formato]}
          onRemove={() => remove(i)}
        >
          {(b.formato === 'AMRAP' || b.formato === 'FOR_TIME') && (
            <Field
              label="Cap (s)"
              type="number"
              min={0}
              value={b.duracaoSeg ?? ''}
              onChange={(e) => update(i, { duracaoSeg: Number(e.target.value) })}
              hint={
                b.formato === 'AMRAP'
                  ? 'Tempo total — máximo de reps'
                  : 'Tempo limite para completar'
              }
            />
          )}

          {(b.formato === 'EMOM' || b.formato === 'TABATA' || b.formato === 'INTERVAL') && (
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="Rounds" type="number" min={1}
                value={b.rounds ?? 1}
                onChange={(e) => update(i, { rounds: Number(e.target.value) })}
              />
              <Field
                label="On (s)" type="number" min={0}
                value={b.intervaloOnSeg ?? ''}
                onChange={(e) => update(i, {
                  intervaloOnSeg: e.target.value === '' ? undefined : Number(e.target.value),
                })}
              />
              <Field
                label="Off (s)" type="number" min={0}
                value={b.intervaloOffSeg ?? ''}
                onChange={(e) => update(i, {
                  intervaloOffSeg: e.target.value === '' ? undefined : Number(e.target.value),
                })}
              />
            </div>
          )}

          {b.formato === 'RUN' && (
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Distância (m)" type="number" min={0}
                value={b.distanciaM ?? ''}
                onChange={(e) => update(i, { distanciaM: Number(e.target.value) })}
              />
              <Field
                label="Ritmo (MM:SS/km)" placeholder="5:00"
                value={b.ritmoAlvoMinKm ?? ''}
                onChange={(e) => update(i, { ritmoAlvoMinKm: e.target.value || undefined })}
              />
            </div>
          )}

          {b.formato !== 'RUN' && (
            <HyroxExerciciosEditor
              exercicios={b.exercicios ?? []}
              onChange={(ex) => update(i, { exercicios: ex })}
            />
          )}
        </BlocoCard>
      ))}
    </div>
  );
}

function HyroxExerciciosEditor({
  exercicios, onChange,
}: {
  exercicios: HyroxExercicio[];
  onChange: (v: HyroxExercicio[]) => void;
}) {
  const update = (i: number, patch: Partial<HyroxExercicio>) =>
    onChange(exercicios.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const updateCarga = (i: number, patch: Partial<NonNullable<HyroxExercicio['carga']>>) =>
    onChange(
      exercicios.map((e, idx) =>
        idx === i ? { ...e, carga: { ...e.carga, ...patch } } : e,
      ),
    );
  const remove = (i: number) => onChange(exercicios.filter((_, idx) => idx !== i));
  const add = () => onChange([...exercicios, novoHyroxExercicio()]);

  return (
    <div className="mt-3 pt-3 border-t border-app">
      <div className="flex items-center justify-between mb-2">
        <Label>Exercícios ({exercicios.length})</Label>
        <button
          type="button"
          onClick={add}
          className="text-[11px] font-bold uppercase tracking-wider text-accent"
        >
          + Mov
        </button>
      </div>
      {exercicios.map((ex, i) => (
        <div key={i} className="p-2 mb-2 rounded-[10px] bg-bg border border-app">
          <div className="flex items-center justify-between mb-2">
            <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
              Mov {String(i + 1).padStart(2, '0')}
            </span>
            {exercicios.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] uppercase text-danger"
              >
                remover
              </button>
            )}
          </div>

          <Label>Estação Hyrox</Label>
          <select
            value={ex.movimento}
            onChange={(e) => update(i, { movimento: e.target.value as HyroxExercicioMov })}
            className="w-full h-10 px-3 rounded-[10px] bg-surface border border-app-strong text-ink text-[13px] mb-2"
          >
            <optgroup label="Estações oficiais Hyrox">
              {ESTACOES_HYROX.map((m) => (
                <option key={m} value={m}>{HYROX_MOV_LABEL[m]}</option>
              ))}
            </optgroup>
            <optgroup label="Outros">
              {(Object.keys(HYROX_MOV_LABEL) as HyroxExercicioMov[])
                .filter((m) => !ESTACOES_HYROX.includes(m))
                .map((m) => (
                  <option key={m} value={m}>{HYROX_MOV_LABEL[m]}</option>
                ))}
            </optgroup>
          </select>

          <div className="grid grid-cols-3 gap-2">
            <Field
              label="Reps" type="number" min={0}
              value={ex.repeticoes ?? ''}
              onChange={(e) => update(i, {
                repeticoes: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
            <Field
              label="Distância (m)" type="number" min={0}
              value={ex.distanciaM ?? ''}
              onChange={(e) => update(i, {
                distanciaM: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
            <Field
              label="Duração (s)" type="number" min={0}
              value={ex.duracaoSeg ?? ''}
              onChange={(e) => update(i, {
                duracaoSeg: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
            <Field
              label="Carga Open (kg)" type="number" min={0}
              value={ex.carga?.open ?? ''}
              onChange={(e) => updateCarga(i, {
                open: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
            <Field
              label="Carga Pro (kg)" type="number" min={0}
              value={ex.carga?.pro ?? ''}
              onChange={(e) => updateCarga(i, {
                pro: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
