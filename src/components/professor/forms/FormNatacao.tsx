import { Field } from '@/components/auth/Field';
import type { NatacaoBloco } from '@/types/treino';
import { BlocoCard, Label, NativeSelect, novoNatacaoBloco } from './shared';

type Props = {
  css: number;
  onCss: (v: number) => void;
  blocos: NatacaoBloco[];
  onBlocos: (v: NatacaoBloco[]) => void;
};

export function FormNatacao({ css, onCss, blocos, onBlocos }: Props) {
  return (
    <>
      <Field
        label="CSS base (s/100m)"
        type="number"
        min={30}
        max={300}
        value={css}
        onChange={(e) => onCss(Number(e.target.value))}
        hint="Critical Swim Speed — calculado dos testes 400m e 200m"
      />
      <NatacaoBlocosEditor css={css} blocos={blocos} onChange={onBlocos} />
    </>
  );
}

function NatacaoBlocosEditor({
  css, blocos, onChange,
}: {
  css: number;
  blocos: NatacaoBloco[];
  onChange: (v: NatacaoBloco[]) => void;
}) {
  const update = (i: number, patch: Partial<NatacaoBloco>) =>
    onChange(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(blocos.filter((_, idx) => idx !== i));
  const add = () => onChange([...blocos, novoNatacaoBloco()]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Blocos ({blocos.length})</Label>
        <button
          type="button"
          onClick={add}
          className="text-[11px] font-bold uppercase tracking-wider text-accent"
        >
          + Bloco
        </button>
      </div>
      {blocos.map((b, i) => {
        const paceAbs =
          b.paceCssOffsetSeg !== undefined ? css + b.paceCssOffsetSeg : b.paceAlvoSegPor100m;
        const paceTxt = paceAbs
          ? `${Math.floor(paceAbs / 60)}:${String(Math.round(paceAbs % 60)).padStart(2, '0')}/100m`
          : '—';
        const totalM = b.repeticoes * b.distanciaM;

        return (
          <BlocoCard key={i} index={i} total={blocos.length} label="Bloco" onRemove={() => remove(i)}>
            <Label>Tipo</Label>
            <NativeSelect<NatacaoBloco['tipo']>
              value={b.tipo}
              onChange={(v) => update(i, { tipo: v })}
              options={[
                { value: 'aquecimento', label: 'Aquecimento' },
                { value: 'principal', label: 'Principal' },
                { value: 'tecnica', label: 'Técnica' },
                { value: 'volta_calma', label: 'Volta calma' },
              ]}
            />

            <Label>Séries × Distância</Label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 mb-3">
              <Field
                label="Séries"
                type="number"
                min={1}
                value={b.repeticoes}
                onChange={(e) => update(i, { repeticoes: Number(e.target.value) })}
              />
              <span className="pb-4 text-[20px] font-bold text-ink-subtle text-mono">×</span>
              <Field
                label="Distância (m)"
                type="number"
                min={25}
                step={25}
                value={b.distanciaM}
                onChange={(e) => update(i, { distanciaM: Number(e.target.value) })}
              />
            </div>
            <div className="text-[11px] text-mono font-bold text-ink-subtle uppercase tracking-wider -mt-2 mb-3">
              Volume: {totalM}m
            </div>

            <Label>Estilo</Label>
            <NativeSelect<NonNullable<NatacaoBloco['estilo']>>
              value={b.estilo ?? 'LIVRE'}
              onChange={(v) => update(i, { estilo: v })}
              options={[
                { value: 'LIVRE', label: 'Crawl (Livre)' },
                { value: 'COSTAS', label: 'Costas' },
                { value: 'PEITO', label: 'Peito' },
                { value: 'BORBOLETA', label: 'Borboleta' },
                { value: 'MEDLEY', label: 'Medley' },
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Pace alvo (CSS offset, s)"
                type="number"
                step="1"
                value={b.paceCssOffsetSeg ?? ''}
                onChange={(e) =>
                  update(i, {
                    paceCssOffsetSeg: e.target.value === '' ? undefined : Number(e.target.value),
                    paceAlvoSegPor100m: undefined,
                  })
                }
                hint={
                  b.paceCssOffsetSeg !== undefined
                    ? `Pace: ${paceTxt}`
                    : 'Ex: 2 = CSS+2s (mais lento) / -1 = CSS-1s (mais rápido)'
                }
              />
              <Field
                label="Pace abs (s/100m)"
                type="number"
                min={30}
                value={b.paceAlvoSegPor100m ?? ''}
                onChange={(e) =>
                  update(i, {
                    paceAlvoSegPor100m: e.target.value === '' ? undefined : Number(e.target.value),
                    paceCssOffsetSeg: undefined,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field
                label="RI / Descanso (s) ⭐"
                type="number"
                min={0}
                value={b.descansoSeg ?? ''}
                onChange={(e) =>
                  update(i, {
                    descansoSeg: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                hint="Rest Interval entre repetições"
              />
              <Field
                label="Send-off (s)"
                type="number"
                min={0}
                value={b.sendOffSeg ?? ''}
                onChange={(e) =>
                  update(i, {
                    sendOffSeg: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                hint="Tempo total por rep (pace + RI)"
              />
            </div>
          </BlocoCard>
        );
      })}
    </div>
  );
}
