import { Field } from '@/components/auth/Field';
import { ZONA_FTP_DESCR, type CiclismoBloco, type ZonaFTP } from '@/types/treino';
import { BlocoCard, Label, ModeToggle, NativeSelect, novoCiclismoBloco } from './shared';

type Props = {
  ftpW: number;
  onFtpW: (v: number) => void;
  modo: 'simples' | 'avancado';
  onModo: (m: 'simples' | 'avancado') => void;
  simples: { distanciaKm: number; potenciaAlvoW: number };
  onSimples: (v: { distanciaKm: number; potenciaAlvoW: number }) => void;
  blocos: CiclismoBloco[];
  onBlocos: (v: CiclismoBloco[]) => void;
};

export function FormCiclismo({
  ftpW, onFtpW, modo, onModo,
  simples, onSimples, blocos, onBlocos,
}: Props) {
  return (
    <>
      <Field
        label="FTP do aluno (W)"
        type="number"
        min={50}
        value={ftpW}
        onChange={(e) => onFtpW(Number(e.target.value))}
        hint="Functional Threshold Power — base das zonas de potência"
      />

      <ModeToggle
        value={modo}
        onChange={onModo}
        options={[
          { value: 'simples', label: 'Simples' },
          { value: 'avancado', label: 'Por zonas FTP' },
        ]}
      />

      {modo === 'simples' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Distância (km)" type="number" step="0.5" min={1}
            value={simples.distanciaKm}
            onChange={(e) => onSimples({ ...simples, distanciaKm: Number(e.target.value) })}
          />
          <Field
            label="Potência alvo (W)" type="number" min={0}
            value={simples.potenciaAlvoW}
            onChange={(e) => onSimples({ ...simples, potenciaAlvoW: Number(e.target.value) })}
          />
        </div>
      ) : (
        <CiclismoBlocosEditor ftpW={ftpW} blocos={blocos} onChange={onBlocos} />
      )}
    </>
  );
}

function CiclismoBlocosEditor({
  ftpW, blocos, onChange,
}: {
  ftpW: number;
  blocos: CiclismoBloco[];
  onChange: (v: CiclismoBloco[]) => void;
}) {
  const update = (i: number, patch: Partial<CiclismoBloco>) =>
    onChange(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(blocos.filter((_, idx) => idx !== i));
  const add = () => onChange([...blocos, novoCiclismoBloco()]);

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
        const watts =
          b.potenciaAlvoPctFTP !== undefined
            ? Math.round((b.potenciaAlvoPctFTP / 100) * ftpW)
            : b.potenciaAlvoW;

        // Conversão duração: input em minutos, salvar em segundos
        const duracaoMin = b.duracaoSeg !== undefined ? b.duracaoSeg / 60 : '';

        return (
          <BlocoCard key={i} index={i} total={blocos.length} label="Bloco" onRemove={() => remove(i)}>
            <Label>Tipo</Label>
            <NativeSelect<CiclismoBloco['tipo']>
              value={b.tipo}
              onChange={(v) => update(i, { tipo: v })}
              options={[
                { value: 'aquecimento', label: 'Aquecimento' },
                { value: 'intervalo', label: 'Intervalo' },
                { value: 'continuo', label: 'Contínuo' },
                { value: 'sprint', label: 'Sprint' },
                { value: 'recuperacao', label: 'Recuperação' },
                { value: 'volta_calma', label: 'Volta calma' },
              ]}
            />

            <Label>Zona de Potência (FTP)</Label>
            <select
              value={b.zonaFTP ?? ''}
              onChange={(e) =>
                update(i, {
                  zonaFTP:
                    e.target.value === ''
                      ? undefined
                      : (Number(e.target.value) as ZonaFTP),
                })
              }
              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
            >
              <option value="">— manual (W) —</option>
              {([1, 2, 3, 4, 5, 6, 7] as ZonaFTP[]).map((z) => (
                <option key={z} value={z}>
                  Z{z} — {ZONA_FTP_DESCR[z].nome} ({ZONA_FTP_DESCR[z].pct})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Duração (min)" type="number" min={0} step="0.5"
                value={duracaoMin}
                onChange={(e) =>
                  update(i, {
                    duracaoSeg:
                      e.target.value === '' ? undefined : Number(e.target.value) * 60,
                  })
                }
              />
              <Field
                label="Repetições" type="number" min={1}
                value={b.repeticoes ?? 1}
                onChange={(e) => update(i, { repeticoes: Number(e.target.value) })}
              />
              <Field
                label="% FTP alvo" type="number" min={0} max={300}
                value={b.potenciaAlvoPctFTP ?? ''}
                onChange={(e) =>
                  update(i, {
                    potenciaAlvoPctFTP:
                      e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                hint={watts ? `≈ ${watts}W` : undefined}
              />
              <Field
                label="Potência (W)" type="number" min={0}
                value={watts ?? ''}
                onChange={(e) =>
                  update(i, {
                    potenciaAlvoW:
                      e.target.value === '' ? undefined : Number(e.target.value),
                    potenciaAlvoPctFTP: undefined,
                  })
                }
              />
              <Field
                label="RI entre reps (s)" type="number" min={0}
                value={b.recuperacaoSeg ?? 0}
                onChange={(e) => update(i, { recuperacaoSeg: Number(e.target.value) })}
              />
              <Field
                label="Cadência (rpm)" type="number" min={0}
                value={b.cadenciaRpm ?? ''}
                onChange={(e) =>
                  update(i, {
                    cadenciaRpm:
                      e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
          </BlocoCard>
        );
      })}
    </div>
  );
}
