import { useEffect, useState } from 'react';
import { Field } from '@/components/auth/Field';
import { listExercicios, type Exercicio } from '@/lib/api/exercicios';
import { BlocoCard, Label, novoExercicio, type ExerForm } from './shared';

type Props = {
  exercicios: ExerForm[];
  onChange: (v: ExerForm[]) => void;
};

export function FormMusculacao({ exercicios, onChange }: Props) {
  // Catálogo de exercícios para autocomplete (datalist)
  const [catalog, setCatalog] = useState<Exercicio[]>([]);

  useEffect(() => {
    listExercicios({ limit: 200 })
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  const update = (i: number, patch: Partial<ExerForm>) =>
    onChange(exercicios.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i: number) => onChange(exercicios.filter((_, idx) => idx !== i));
  const add = () => onChange([...exercicios, novoExercicio()]);

  // Quando aluno seleciona nome que bate com catálogo, preencher exercicioId + videoUrl
  function onNomeChange(i: number, nome: string) {
    const match = catalog.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
    update(i, {
      nome,
      exercicioId: match?.id,
      videoUrl: match?.videoUrl ?? exercicios[i].videoUrl,
    });
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Exercícios ({exercicios.length})</Label>
        <button
          type="button"
          onClick={add}
          className="text-[11px] font-bold uppercase tracking-wider text-accent"
        >
          + Adicionar
        </button>
      </div>

      {/* datalist global para autocomplete dos nomes do catálogo */}
      <datalist id="exercicios-catalog">
        {catalog.map((c) => (
          <option key={c.id} value={c.nome} />
        ))}
      </datalist>

      {exercicios.map((ex, i) => (
        <BlocoCard
          key={i}
          index={i}
          total={exercicios.length}
          label="Exercício"
          onRemove={() => remove(i)}
        >
          <Field
            label="Nome (do catálogo ou novo)"
            placeholder="Supino Inclinado"
            value={ex.nome}
            onChange={(e) => onNomeChange(i, e.target.value)}
            list="exercicios-catalog"
            required
          />
          {ex.exercicioId && (
            <div className="text-[10px] text-mono uppercase tracking-wider text-accent font-bold -mt-2 mb-3">
              ✓ vinculado ao catálogo
            </div>
          )}
          <Field
            label="Vídeo URL (opcional)"
            placeholder="https://..."
            value={ex.videoUrl}
            onChange={(e) => update(i, { videoUrl: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Séries"
              type="number"
              min={1}
              value={ex.series}
              onChange={(e) => update(i, { series: Number(e.target.value) })}
            />
            <Field
              label="Reps"
              type="number"
              min={1}
              value={ex.reps}
              onChange={(e) => update(i, { reps: Number(e.target.value) })}
            />
            <Field
              label="% Carga (RP)"
              type="number"
              min={0}
              max={150}
              value={ex.cargaPctRP ?? ''}
              onChange={(e) => update(i, {
                cargaPctRP: e.target.value === '' ? undefined : Number(e.target.value),
              })}
              hint="% do recorde pessoal"
            />
            <Field
              label="Descanso (s)"
              type="number"
              min={0}
              value={ex.descansoSeg}
              onChange={(e) => update(i, { descansoSeg: Number(e.target.value) })}
            />
          </div>
        </BlocoCard>
      ))}
    </div>
  );
}
