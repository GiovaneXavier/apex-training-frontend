import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import { GRUPO_MUSCULAR_LABEL, listExercicios, type Exercicio, type GrupoMuscular } from '@/lib/api/exercicios';
import { listAlunos, type AlunoVinculado } from '@/lib/api/professor';
import {
  DIAS,
  DIA_SEMANA_LABEL,
  createRotina,
  getRotina,
  updateRotina,
  type DiaSemana,
  type RotinaInputExercicio,
} from '@/lib/api/rotinas';
import { cn } from '@/lib/utils';

type ExercicioPrescrito = RotinaInputExercicio & { exercicio: Exercicio };

export default function ProfRotinaForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const editing = !!id;

  const [alunos, setAlunos] = useState<AlunoVinculado[]>([]);
  const [catalogo, setCatalogo] = useState<Exercicio[]>([]);

  const [alunoId, setAlunoId] = useState<string>(params.get('alunoId') ?? '');
  const [nome, setNome] = useState('');
  const [diaSemana, setDiaSemana] = useState<DiaSemana>('SEG');
  const [vigenciaInicio, setVigenciaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [vigenciaFim, setVigenciaFim] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [exerciciosSel, setExerciciosSel] = useState<ExercicioPrescrito[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);

  // Carrega alunos + catálogo + (se editando) rotina
  useEffect(() => {
    Promise.all([listAlunos(), listExercicios({ limit: 500 })])
      .then(([als, exs]) => { setAlunos(als); setCatalogo(exs); })
      .catch((err) => setError(apiErrorMessage(err)));

    if (editing && id) {
      getRotina(id)
        .then((r) => {
          setAlunoId(r.alunoId);
          setNome(r.nome);
          setDiaSemana(r.diaSemana);
          setVigenciaInicio(r.vigenciaInicio.slice(0, 10));
          setVigenciaFim(r.vigenciaFim ? r.vigenciaFim.slice(0, 10) : '');
          setExerciciosSel(r.exercicios.map((re) => ({
            exercicioId: re.exercicioId,
            ordem: re.ordem,
            series: re.series,
            reps: re.reps ?? undefined,
            cargaPctRP: re.cargaPctRP ?? undefined,
            cargaKg: re.cargaKg ?? undefined,
            descansoSeg: re.descansoSeg ?? undefined,
            observacao: re.observacao ?? undefined,
            exercicio: re.exercicio,
          })));
        })
        .catch((err) => setError(apiErrorMessage(err)));
    }
  }, [id, editing]);

  // Sugestão de máx 3 meses → aviso
  const aviso3meses = useMemo(() => {
    if (!vigenciaFim) return false;
    const ini = new Date(vigenciaInicio);
    const fim = new Date(vigenciaFim);
    const diff = (fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 95;
  }, [vigenciaInicio, vigenciaFim]);

  function addExercicio(ex: Exercicio) {
    if (exerciciosSel.some((s) => s.exercicioId === ex.id)) return;
    setExerciciosSel([...exerciciosSel, {
      exercicioId: ex.id,
      ordem: exerciciosSel.length,
      series: 3,
      reps: 12,
      cargaPctRP: 70,
      descansoSeg: 90,
      exercicio: ex,
    }]);
    setOpenPicker(false);
  }

  function updateExSel(idx: number, patch: Partial<ExercicioPrescrito>) {
    setExerciciosSel(exerciciosSel.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }

  function removeExSel(idx: number) {
    setExerciciosSel(exerciciosSel.filter((_, i) => i !== idx).map((e, i) => ({ ...e, ordem: i })));
  }

  function moveExSel(idx: number, delta: number) {
    const novo = idx + delta;
    if (novo < 0 || novo >= exerciciosSel.length) return;
    const arr = [...exerciciosSel];
    [arr[idx], arr[novo]] = [arr[novo], arr[idx]];
    setExerciciosSel(arr.map((e, i) => ({ ...e, ordem: i })));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alunoId) { setError('Selecione um aluno'); return; }
    if (!nome.trim()) { setError('Informe um nome'); return; }
    if (exerciciosSel.length === 0) { setError('Adicione ao menos um exercício'); return; }

    setSaving(true);
    try {
      const payload = {
        alunoId,
        nome: nome.trim(),
        diaSemana,
        vigenciaInicio: new Date(vigenciaInicio + 'T00:00:00').toISOString(),
        vigenciaFim: vigenciaFim ? new Date(vigenciaFim + 'T23:59:59').toISOString() : null,
        exercicios: exerciciosSel.map(({ exercicio: _ex, ...rest }) => rest),
      };
      if (editing && id) await updateRotina(id, payload);
      else await createRotina(payload);
      navigate(`/professor/aluno/${alunoId}`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
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

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        <form onSubmit={onSubmit}>
          <Label>Aluno</Label>
          <select
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            disabled={editing}
            className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4 disabled:opacity-60"
          >
            <option value="">Selecione…</option>
            {alunos.map((a) => <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>)}
          </select>

          <Field label="Nome" placeholder="Treino A — Peito + Tríceps" value={nome} onChange={(e) => setNome(e.target.value)} required />

          <Label>Dia da semana</Label>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {DIAS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDiaSemana(d)}
                className={cn(
                  'py-2.5 rounded-[10px] text-[11px] font-bold uppercase tracking-wider',
                  diaSemana === d ? 'bg-ink text-bg' : 'bg-surface border border-app-strong text-ink-muted',
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Vigência início" type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} required />
            <Field label="Vigência fim (opcional)" type="date" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
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
            <Label>Exercícios ({exerciciosSel.length})</Label>
            <button type="button" onClick={() => setOpenPicker(true)} className="text-[11px] font-bold uppercase tracking-wider text-accent">
              + Do catálogo
            </button>
          </div>

          {exerciciosSel.length === 0 ? (
            <div className="px-4 py-6 rounded-[14px] bg-surface border border-dashed border-app text-center text-ink-subtle text-[13px]">
              Nenhum exercício. Toque em "+ Do catálogo".
            </div>
          ) : (
            exerciciosSel.map((ex, i) => (
              <div key={ex.exercicioId} className="p-3 mb-2 rounded-[14px] bg-surface border border-app">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle flex-shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[14px] font-semibold truncate">{ex.exercicio.nome}</span>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => moveExSel(i, -1)} disabled={i === 0} className="text-ink-muted disabled:opacity-30 px-1">↑</button>
                    <button type="button" onClick={() => moveExSel(i, 1)} disabled={i === exerciciosSel.length - 1} className="text-ink-muted disabled:opacity-30 px-1">↓</button>
                    <button type="button" onClick={() => removeExSel(i)} className="text-[10px] uppercase tracking-wider text-danger ml-1">remover</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Séries" type="number" min={1} value={ex.series}
                    onChange={(e) => updateExSel(i, { series: Number(e.target.value) })} />
                  <Field label="Reps" type="number" min={1} value={ex.reps ?? ''}
                    onChange={(e) => updateExSel(i, { reps: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <Field label="% RP" type="number" min={0} max={150} value={ex.cargaPctRP ?? ''}
                    onChange={(e) => updateExSel(i, { cargaPctRP: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <Field label="Carga (kg)" type="number" min={0} step={0.5} value={ex.cargaKg ?? ''}
                    onChange={(e) => updateExSel(i, { cargaKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  <Field label="RI (s)" type="number" min={0} value={ex.descansoSeg ?? ''}
                    onChange={(e) => updateExSel(i, { descansoSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              </div>
            ))
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50 mt-4"
          >
            {saving ? 'Salvando…' : editing ? 'Salvar rotina' : 'Criar rotina'}
          </button>
        </form>
      </div>

      {openPicker && (
        <ExercicioPicker
          catalogo={catalogo}
          excluidos={exerciciosSel.map((e) => e.exercicioId)}
          onPick={addExercicio}
          onClose={() => setOpenPicker(false)}
        />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
      {children}
    </div>
  );
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
