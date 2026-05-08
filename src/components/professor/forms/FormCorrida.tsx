import { Field } from '@/components/auth/Field';
import {
  CORRIDA_SUBTIPO_LABEL,
  type CorridaBloco,
  type CorridaBlocoTipo,
  type CorridaSubtipo,
} from '@/types/treino';
import { BlocoCard, Label, ModeToggle, NativeSelect, novoCorridaBloco } from './shared';

type Props = {
  subtipo: CorridaSubtipo;
  onSubtipo: (s: CorridaSubtipo) => void;
  modo: 'simples' | 'avancado';
  onModo: (m: 'simples' | 'avancado') => void;
  simples: { distanciaKm: number; ritmoAlvoMinKm: string };
  onSimples: (v: { distanciaKm: number; ritmoAlvoMinKm: string }) => void;
  blocos: CorridaBloco[];
  onBlocos: (v: CorridaBloco[]) => void;
};

export function FormCorrida({
  subtipo, onSubtipo, modo, onModo,
  simples, onSimples, blocos, onBlocos,
}: Props) {
  return (
    <>
      <Label>Tipo de treino</Label>
      <NativeSelect<CorridaSubtipo>
        value={subtipo}
        onChange={onSubtipo}
        options={(Object.keys(CORRIDA_SUBTIPO_LABEL) as CorridaSubtipo[]).map((s) => ({
          value: s, label: CORRIDA_SUBTIPO_LABEL[s],
        }))}
      />

      <ModeToggle
        value={modo}
        onChange={onModo}
        options={[
          { value: 'simples', label: 'Simples' },
          { value: 'avancado', label: 'Por blocos' },
        ]}
      />

      {modo === 'simples' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Distância (km)"
            type="number" step="0.1" min={0.1}
            value={simples.distanciaKm}
            onChange={(e) => onSimples({ ...simples, distanciaKm: Number(e.target.value) })}
          />
          <Field
            label="Ritmo alvo (MM:SS/km)"
            placeholder="5:30"
            value={simples.ritmoAlvoMinKm}
            onChange={(e) => onSimples({ ...simples, ritmoAlvoMinKm: e.target.value })}
          />
        </div>
      ) : (
        <CorridaBlocosEditor blocos={blocos} onChange={onBlocos} />
      )}
    </>
  );
}

function CorridaBlocosEditor({
  blocos, onChange,
}: {
  blocos: CorridaBloco[];
  onChange: (v: CorridaBloco[]) => void;
}) {
  const update = (i: number, patch: Partial<CorridaBloco>) =>
    onChange(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(blocos.filter((_, idx) => idx !== i));
  const add = (tipo: CorridaBlocoTipo = 'tiro') => onChange([...blocos, novoCorridaBloco(tipo)]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Blocos ({blocos.length})</Label>
        <div className="flex gap-1">
          <button type="button" onClick={() => add('aquecimento')} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Aq</button>
          <button type="button" onClick={() => add('tiro')} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Tiro</button>
          <button type="button" onClick={() => add('continuo')} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Cont</button>
        </div>
      </div>
      {blocos.map((b, i) => (
        <BlocoCard key={i} index={i} total={blocos.length} label="Bloco" onRemove={() => remove(i)}>
          <Label>Tipo</Label>
          <NativeSelect<CorridaBlocoTipo>
            value={b.tipo}
            onChange={(v) => update(i, { tipo: v })}
            options={[
              { value: 'aquecimento', label: 'Aquecimento' },
              { value: 'tiro', label: 'Tiro / Intervalo' },
              { value: 'continuo', label: 'Contínuo' },
              { value: 'progressao', label: 'Progressão' },
              { value: 'subida', label: 'Subida' },
              { value: 'recuperacao', label: 'Recuperação' },
              { value: 'volta_calma', label: 'Volta calma' },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Distância (m)" type="number" min={0}
              value={b.distanciaM ?? ''}
              onChange={(e) => update(i, {
                distanciaM: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
            <Field
              label="Duração (s)" type="number" min={0}
              value={b.duracaoSeg ?? ''}
              onChange={(e) => update(i, {
                duracaoSeg: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
            <Field
              label="Repetições" type="number" min={1}
              value={b.repeticoes ?? 1}
              onChange={(e) => update(i, { repeticoes: Number(e.target.value) })}
            />
            <Field
              label="Ritmo (MM:SS/km)" placeholder="4:30"
              value={b.ritmoAlvoMinKm ?? ''}
              onChange={(e) => update(i, { ritmoAlvoMinKm: e.target.value || undefined })}
            />
            <Field
              label="RI entre reps (s)" type="number" min={0}
              value={b.recuperacaoSeg ?? 0}
              onChange={(e) => update(i, { recuperacaoSeg: Number(e.target.value) })}
            />
            <Field
              label="RPE (1-10)" type="number" min={1} max={10}
              value={b.rpeAlvo ?? ''}
              onChange={(e) => update(i, {
                rpeAlvo: e.target.value === '' ? undefined : Number(e.target.value),
              })}
            />
          </div>
        </BlocoCard>
      ))}
    </div>
  );
}
