import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import { GRUPO_MUSCULAR_LABEL, listExercicios, type Exercicio, type GrupoMuscular } from '@/lib/api/exercicios';
import { listAlunos, type AlunoVinculado } from '@/lib/api/professor';
import {
  DIAS,
  createRotina,
  getRotina,
  updateRotina,
  type DiaSemana,
} from '@/lib/api/rotinas';
import { cn } from '@/lib/utils';

// PR #16 — refatorado com react-hook-form + useFieldArray.
//
// Por que RHF aqui:
//   - useFieldArray é o padrão pra listas com prepend/append/move/remove
//     onde cada item tem subform — substitui o `setExerciciosSel.map`
//     manual que tínhamos antes (e estava prestes a virar n^2 com
//     validação por campo).
//   - register vs Controller: register para inputs HTML nativos (texto,
//     date, número), Controller pros casos custom (a fita de DIAS, que
//     é grupo de botões).
//   - watch() segue reativo para os indicadores derivados (aviso 3m,
//     contagem de exercícios) sem dispatch manual.
//
// Cada exercício carrega um snapshot do catálogo (`exercicio.nome`,
// equipamento) que NÃO viaja no payload — strip no submit.

type ExercicioFormItem = {
  exercicioId: string;
  ordem: number;
  series: number;
  reps?: number;
  cargaPctRP?: number;
  cargaKg?: number;
  descansoSeg?: number;
  observacao?: string;
  // Snapshot pra exibição. NÃO vai pro backend.
  _nome: string;
};

type FormValues = {
  alunoId: string;
  nome: string;
  diaSemana: DiaSemana;
  vigenciaInicio: string; // YYYY-MM-DD (input type=date)
  vigenciaFim: string;    // YYYY-MM-DD ou ''
  exercicios: ExercicioFormItem[];
};

function defaultValues(): FormValues {
  const fim = new Date();
  fim.setMonth(fim.getMonth() + 3);
  return {
    alunoId: '',
    nome: '',
    diaSemana: 'SEG',
    vigenciaInicio: new Date().toISOString().slice(0, 10),
    vigenciaFim: fim.toISOString().slice(0, 10),
    exercicios: [],
  };
}

export default function ProfRotinaForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const editing = !!id;

  const [alunos, setAlunos] = useState<AlunoVinculado[]>([]);
  const [catalogo, setCatalogo] = useState<Exercicio[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: { ...defaultValues(), alunoId: params.get('alunoId') ?? '' },
    mode: 'onSubmit',
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'exercicios',
  });

  const vigenciaInicio = watch('vigenciaInicio');
  const vigenciaFim = watch('vigenciaFim');
  const diaSemana = watch('diaSemana');

  // Aviso de rotina muito longa (>3 meses).
  const aviso3meses = useMemo(() => {
    if (!vigenciaFim) return false;
    const ini = new Date(vigenciaInicio);
    const fim = new Date(vigenciaFim);
    const diff = (fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 95;
  }, [vigenciaInicio, vigenciaFim]);

  // Bootstrap: alunos + catálogo + (se editing) rotina existente.
  useEffect(() => {
    Promise.all([listAlunos(), listExercicios({ limit: 500 })])
      .then(([als, exs]) => { setAlunos(als); setCatalogo(exs); })
      .catch((err) => setSubmitError(apiErrorMessage(err)));

    if (editing && id) {
      getRotina(id)
        .then((r) => {
          reset({
            alunoId: r.alunoId,
            nome: r.nome,
            diaSemana: r.diaSemana,
            vigenciaInicio: r.vigenciaInicio.slice(0, 10),
            vigenciaFim: r.vigenciaFim ? r.vigenciaFim.slice(0, 10) : '',
            exercicios: r.exercicios.map((re) => ({
              exercicioId: re.exercicioId,
              ordem: re.ordem,
              series: re.series,
              reps: re.reps ?? undefined,
              cargaPctRP: re.cargaPctRP ?? undefined,
              cargaKg: re.cargaKg ?? undefined,
              descansoSeg: re.descansoSeg ?? undefined,
              observacao: re.observacao ?? undefined,
              _nome: re.exercicio.nome,
            })),
          });
        })
        .catch((err) => setSubmitError(apiErrorMessage(err)));
    }
  }, [id, editing, reset]);

  function addExercicio(ex: Exercicio) {
    if (fields.some((f) => f.exercicioId === ex.id)) return;
    append({
      exercicioId: ex.id,
      ordem: fields.length,
      series: 3,
      reps: 12,
      cargaPctRP: 70,
      descansoSeg: 90,
      _nome: ex.nome,
    });
    setOpenPicker(false);
  }

  function moveEx(idx: number, delta: number) {
    const novo = idx + delta;
    if (novo < 0 || novo >= fields.length) return;
    move(idx, novo);
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    if (values.exercicios.length === 0) {
      setSubmitError('Adicione ao menos um exercício');
      return;
    }
    try {
      const payload = {
        alunoId: values.alunoId,
        nome: values.nome.trim(),
        diaSemana: values.diaSemana,
        vigenciaInicio: new Date(values.vigenciaInicio + 'T00:00:00').toISOString(),
        vigenciaFim: values.vigenciaFim
          ? new Date(values.vigenciaFim + 'T23:59:59').toISOString()
          : null,
        // Strip do snapshot _nome e re-numera ordem (em caso de move).
        exercicios: values.exercicios.map((ex, i) => ({
          exercicioId: ex.exercicioId,
          ordem: i,
          series: ex.series,
          reps: ex.reps,
          cargaPctRP: ex.cargaPctRP,
          cargaKg: ex.cargaKg,
          descansoSeg: ex.descansoSeg,
          observacao: ex.observacao,
        })),
      };
      if (editing && id) await updateRotina(id, payload);
      else await createRotina(payload);
      navigate(`/professor/aluno/${values.alunoId}`, { replace: true });
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/professor/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Voltar
        </Link>
        <Link to="/professor/exercicios" className="text-[11px] uppercase tracking-wider font-bold text-accent">
          Catálogo
        </Link>
      </header>

      <div className="px-5 max-w-2xl mx-auto">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">
          {editing ? 'Editar rotina' : 'Nova rotina'}
        </h1>
        <p className="text-ink-muted text-sm mb-5">Treino de musculação semanal · template do aluno</p>

        {submitError && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{submitError}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Label>Aluno</Label>
          <select
            {...register('alunoId', { required: 'Selecione um aluno' })}
            disabled={editing}
            className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4 disabled:opacity-60"
          >
            <option value="">Selecione…</option>
            {alunos.map((a) => <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>)}
          </select>
          {errors.alunoId && <FieldError>{errors.alunoId.message}</FieldError>}

          <Field
            label="Nome"
            placeholder="Treino A — Peito + Tríceps"
            {...register('nome', { required: 'Informe um nome', maxLength: 120 })}
          />
          {errors.nome && <FieldError>{errors.nome.message}</FieldError>}

          <Label>Dia da semana</Label>
          <Controller
            control={control}
            name="diaSemana"
            render={({ field }) => (
              <div className="grid grid-cols-7 gap-1 mb-4">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => field.onChange(d)}
                    className={cn(
                      'py-2.5 rounded-[10px] text-[11px] font-bold uppercase tracking-wider',
                      diaSemana === d ? 'bg-ink text-bg' : 'bg-surface border border-app-strong text-ink-muted',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          />

          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Vigência início" type="date" {...register('vigenciaInicio', { required: true })} />
            <Field label="Vigência fim (opcional)" type="date" {...register('vigenciaFim')} />
          </div>
          {aviso3meses && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-warn-bg text-warn text-[11px] font-medium">
              Sugestão: rotinas costumam ter no máximo 3 meses — considere encurtar.
            </div>
          )}
          {!vigenciaFim && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-surface-muted text-ink-muted text-[11px]">
              Sem vigência fim → rotina aberta (sem prazo).
            </div>
          )}

          <div className="flex items-center justify-between mt-4 mb-2">
            <Label>Exercícios ({fields.length})</Label>
            <button type="button" onClick={() => setOpenPicker(true)} className="text-[11px] font-bold uppercase tracking-wider text-accent">
              + Do catálogo
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="px-4 py-6 rounded-[14px] bg-surface border border-dashed border-app text-center text-ink-subtle text-[13px]">
              Nenhum exercício. Toque em "+ Do catálogo".
            </div>
          ) : (
            fields.map((field, i) => (
              <div key={field.id} className="p-3 mb-2 rounded-[14px] bg-surface border border-app">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle flex-shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[14px] font-semibold truncate">{field._nome}</span>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => moveEx(i, -1)} disabled={i === 0} className="text-ink-muted disabled:opacity-30 px-1">↑</button>
                    <button type="button" onClick={() => moveEx(i, 1)} disabled={i === fields.length - 1} className="text-ink-muted disabled:opacity-30 px-1">↓</button>
                    <button type="button" onClick={() => remove(i)} className="text-[10px] uppercase tracking-wider text-danger ml-1">remover</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Séries"
                    type="number"
                    min={1}
                    {...register(`exercicios.${i}.series`, { valueAsNumber: true, required: true, min: 1 })}
                  />
                  <Field
                    label="Reps"
                    type="number"
                    min={1}
                    {...register(`exercicios.${i}.reps`, { valueAsNumber: true, setValueAs: emptyAsUndefined })}
                  />
                  <Field
                    label="% RP"
                    type="number"
                    min={0}
                    max={150}
                    {...register(`exercicios.${i}.cargaPctRP`, { valueAsNumber: true, setValueAs: emptyAsUndefined })}
                  />
                  <Field
                    label="Carga (kg)"
                    type="number"
                    min={0}
                    step={0.5}
                    {...register(`exercicios.${i}.cargaKg`, { valueAsNumber: true, setValueAs: emptyAsUndefined })}
                  />
                  <Field
                    label="RI (s)"
                    type="number"
                    min={0}
                    {...register(`exercicios.${i}.descansoSeg`, { valueAsNumber: true, setValueAs: emptyAsUndefined })}
                  />
                </div>
              </div>
            ))
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'Salvando…' : editing ? 'Salvar rotina' : 'Criar rotina'}
          </button>
        </form>
      </div>

      {openPicker && (
        <ExercicioPicker
          catalogo={catalogo}
          excluidos={fields.map((f) => f.exercicioId)}
          onPick={addExercicio}
          onClose={() => setOpenPicker(false)}
        />
      )}
    </div>
  );
}

// `valueAsNumber` do RHF transforma '' em NaN. Esta helper converte NaN
// e '' em undefined, mantendo o tipo `number | undefined` que o backend
// espera (campos opcionais no schema Zod).
function emptyAsUndefined(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
      {children}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-danger mb-2 -mt-1">{children}</div>;
}

function ExercicioPicker({ catalogo, excluidos, onPick, onClose }: {
  catalogo: Exercicio[];
  excluidos: string[];
  onPick: (ex: Exercicio) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState<GrupoMuscular | ''>('');

  const filtered = useMemo(() => {
    return catalogo
      .filter((e) => !excluidos.includes(e.id))
      .filter((e) => grupo ? e.grupoMuscular === grupo : true)
      .filter((e) => q.trim() ? e.nome.toLowerCase().includes(q.toLowerCase()) : true);
  }, [catalogo, excluidos, q, grupo]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-md bg-bg rounded-t-[20px] md:rounded-[20px] p-5 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Adicionar do catálogo</h2>
          <button type="button" onClick={onClose} className="text-ink-muted text-[20px] leading-none">×</button>
        </div>

        <Field label="Buscar" placeholder="ex: supino..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Grupo</div>
        <select
          value={grupo}
          onChange={(e) => setGrupo(e.target.value as GrupoMuscular | '')}
          className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
        >
          <option value="">Todos</option>
          {(Object.keys(GRUPO_MUSCULAR_LABEL) as GrupoMuscular[]).map((g) => (
            <option key={g} value={g}>{GRUPO_MUSCULAR_LABEL[g]}</option>
          ))}
        </select>

        <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-ink-subtle text-[13px] py-4 text-center">Nenhum exercício encontrado.</div>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => onPick(ex)}
                className="w-full text-left px-3.5 py-2.5 rounded-[10px] bg-surface border border-app hover:border-accent transition-colors"
              >
                <div className="text-[14px] font-semibold">{ex.nome}</div>
                <div className="text-[11px] text-ink-subtle">
                  {ex.grupoMuscular ? GRUPO_MUSCULAR_LABEL[ex.grupoMuscular] : '—'} · {ex.equipamento ?? '—'}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export para nova rotina (cria) reusar mesma página
export { ProfRotinaForm as ProfRotinaNova };
