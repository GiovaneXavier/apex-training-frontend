import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import { listAlunos, type AlunoVinculado } from '@/lib/api/professor';
import { prescreverTreino } from '@/lib/api/treinos';
import { cn } from '@/lib/utils';
import {
  MODALIDADE_LABEL,
  type Modalidade,
  type TreinoDetalhes,
  type ExercicioMusc,
} from '@/types/treino';

const MODALIDADES: Modalidade[] = ['MUSCULACAO', 'CORRIDA', 'CICLISMO', 'NATACAO', 'OUTRO'];

type ExerForm = {
  nome: string;
  videoUrl: string;
  series: number;
  reps: number;
  cargaPctRP?: number;
  descansoSeg: number;
};

const novoExercicio = (): ExerForm => ({
  nome: '',
  videoUrl: '',
  series: 3,
  reps: 12,
  cargaPctRP: 70,
  descansoSeg: 90,
});

type CorridaForm = { distanciaKm: number; ritmoAlvoMinKm: string };
type CiclismoForm = { distanciaKm: number; potenciaAlvoW?: number };
type NatacaoForm = { repeticoes: number; distanciaM: number; estilo: 'LIVRE' | 'COSTAS' | 'PEITO' | 'BORBOLETA' | 'MEDLEY'; descansoSeg?: number };

export default function ProfPrescrever() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const alunoIdQuery = params.get('alunoId');

  const [alunos, setAlunos] = useState<AlunoVinculado[]>([]);
  const [alunoId, setAlunoId] = useState<string>(alunoIdQuery ?? '');
  const [modalidade, setModalidade] = useState<Modalidade>('MUSCULACAO');
  const [titulo, setTitulo] = useState('');
  const [dataAlvo, setDataAlvo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm para input
  });

  // Detalhes por modalidade
  const [exercicios, setExercicios] = useState<ExerForm[]>([novoExercicio()]);
  const [corrida, setCorrida] = useState<CorridaForm>({ distanciaKm: 5, ritmoAlvoMinKm: '5:30' });
  const [ciclismo, setCiclismo] = useState<CiclismoForm>({ distanciaKm: 30 });
  const [natacao, setNatacao] = useState<NatacaoForm[]>([{ repeticoes: 8, distanciaM: 100, estilo: 'LIVRE', descansoSeg: 30 }]);
  const [outroDescricao, setOutroDescricao] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAlunos().then((list) => {
      setAlunos(list);
      if (!alunoId && list.length > 0) setAlunoId(list[0].alunoId);
    }).catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const alunoSelecionado = useMemo(
    () => alunos.find((a) => a.alunoId === alunoId),
    [alunos, alunoId],
  );

  function buildDetalhes(): TreinoDetalhes {
    switch (modalidade) {
      case 'MUSCULACAO':
        return {
          tipo: 'musculacao',
          exercicios: exercicios.map<ExercicioMusc>((e) => ({
            nome: e.nome.trim(),
            videoUrl: e.videoUrl.trim() || undefined,
            prescrito: {
              series: Number(e.series),
              reps: Number(e.reps),
              cargaPctRP: e.cargaPctRP !== undefined ? Number(e.cargaPctRP) : undefined,
              descansoSeg: Number(e.descansoSeg),
            },
            realizado: [],
          })),
        };
      case 'CORRIDA':
        return {
          tipo: 'corrida',
          distanciaKm: Number(corrida.distanciaKm),
          ritmoAlvoMinKm: corrida.ritmoAlvoMinKm || undefined,
        };
      case 'CICLISMO':
        return {
          tipo: 'ciclismo',
          distanciaKm: Number(ciclismo.distanciaKm),
          potenciaAlvoW: ciclismo.potenciaAlvoW !== undefined ? Number(ciclismo.potenciaAlvoW) : undefined,
        };
      case 'NATACAO':
        return {
          tipo: 'natacao',
          series: natacao.map((s) => ({
            repeticoes: Number(s.repeticoes),
            distanciaM: Number(s.distanciaM),
            estilo: s.estilo,
            descansoSeg: s.descansoSeg !== undefined ? Number(s.descansoSeg) : undefined,
          })),
        };
      case 'OUTRO':
        return { tipo: 'outro', descricao: outroDescricao.trim() };
      // Triathlon construído manualmente — fora do escopo do form simples
      default:
        return { tipo: 'outro', descricao: '' };
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alunoId) { setError('Selecione um aluno'); return; }
    if (!titulo.trim()) { setError('Informe um título'); return; }
    if (modalidade === 'MUSCULACAO' && exercicios.some((e) => !e.nome.trim())) {
      setError('Todos os exercícios precisam de nome');
      return;
    }
    if (modalidade === 'OUTRO' && !outroDescricao.trim()) {
      setError('Descreva o treino');
      return;
    }

    setSubmitting(true);
    try {
      const treino = await prescreverTreino({
        alunoId,
        modalidade,
        titulo: titulo.trim(),
        dataAlvo: new Date(dataAlvo).toISOString(),
        detalhes: buildDetalhes(),
      });
      navigate(`/professor/aluno/${treino.alunoId}`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link
          to={alunoIdQuery ? `/professor/aluno/${alunoIdQuery}` : '/professor/dashboard'}
          className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
        >
          ← Voltar
        </Link>
      </header>

      <div className="px-5">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Prescrever treino</h1>
        <p className="text-ink-muted text-sm mb-5">Multi-sports · gera o JSON automaticamente.</p>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <Label>Aluno</Label>
          <select
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4"
          >
            <option value="">Selecione...</option>
            {alunos.map((a) => (
              <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>
            ))}
          </select>
          {alunoSelecionado && (
            <div className="text-[11px] text-ink-subtle -mt-2 mb-4">{alunoSelecionado.email}</div>
          )}

          <Label>Modalidade</Label>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {MODALIDADES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModalidade(m)}
                className={cn(
                  'py-2 rounded-[10px] text-[12px] font-bold uppercase tracking-wider',
                  modalidade === m
                    ? 'bg-ink text-bg'
                    : 'bg-surface border border-app-strong text-ink-muted',
                )}
              >
                {MODALIDADE_LABEL[m]}
              </button>
            ))}
          </div>

          <Field
            label="Título"
            placeholder="Treino A · Superiores"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />

          <Field
            label="Data"
            type="datetime-local"
            value={dataAlvo}
            onChange={(e) => setDataAlvo(e.target.value)}
            required
          />

          {modalidade === 'MUSCULACAO' && (
            <MuscEditor exercicios={exercicios} onChange={setExercicios} />
          )}
          {modalidade === 'CORRIDA' && (
            <CorridaEditor value={corrida} onChange={setCorrida} />
          )}
          {modalidade === 'CICLISMO' && (
            <CiclismoEditor value={ciclismo} onChange={setCiclismo} />
          )}
          {modalidade === 'NATACAO' && (
            <NatacaoEditor series={natacao} onChange={setNatacao} />
          )}
          {modalidade === 'OUTRO' && (
            <>
              <Label>Descrição</Label>
              <textarea
                value={outroDescricao}
                onChange={(e) => setOutroDescricao(e.target.value)}
                placeholder="Detalhes livres do treino..."
                className="w-full min-h-[120px] px-3.5 py-2.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4 resize-y"
              />
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50 mt-4"
          >
            {submitting ? 'Salvando...' : 'Prescrever treino'}
          </button>
        </form>
      </div>
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

// ─────────────────────────────────────────────────────────────
// Editores por modalidade
// ─────────────────────────────────────────────────────────────
function MuscEditor({ exercicios, onChange }: { exercicios: ExerForm[]; onChange: (v: ExerForm[]) => void }) {
  const update = (i: number, patch: Partial<ExerForm>) => {
    onChange(exercicios.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };
  const remove = (i: number) => onChange(exercicios.filter((_, idx) => idx !== i));
  const add = () => onChange([...exercicios, novoExercicio()]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Exercícios ({exercicios.length})</Label>
        <button type="button" onClick={add} className="text-[11px] font-bold uppercase tracking-wider text-accent">
          + Adicionar
        </button>
      </div>
      {exercicios.map((ex, i) => (
        <div key={i} className="p-3 mb-2 rounded-[14px] bg-surface border border-app">
          <div className="flex items-center justify-between mb-2">
            <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
              Exercício {String(i + 1).padStart(2, '0')}
            </span>
            {exercicios.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-[10px] uppercase tracking-wider text-danger">
                remover
              </button>
            )}
          </div>
          <Field label="Nome" placeholder="Supino Inclinado" value={ex.nome} onChange={(e) => update(i, { nome: e.target.value })} required />
          <Field label="Vídeo URL (opcional)" placeholder="https://..." value={ex.videoUrl} onChange={(e) => update(i, { videoUrl: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Séries" type="number" min={1} value={ex.series} onChange={(e) => update(i, { series: Number(e.target.value) })} />
            <Field label="Reps" type="number" min={1} value={ex.reps} onChange={(e) => update(i, { reps: Number(e.target.value) })} />
            <Field label="% RP" type="number" min={0} max={150} value={ex.cargaPctRP ?? ''} onChange={(e) => update(i, { cargaPctRP: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Descanso (s)" type="number" min={0} value={ex.descansoSeg} onChange={(e) => update(i, { descansoSeg: Number(e.target.value) })} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CorridaEditor({ value, onChange }: { value: CorridaForm; onChange: (v: CorridaForm) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Distância (km)" type="number" step="0.1" min={0.1} value={value.distanciaKm} onChange={(e) => onChange({ ...value, distanciaKm: Number(e.target.value) })} />
      <Field label="Ritmo alvo (MM:SS/km)" placeholder="5:30" value={value.ritmoAlvoMinKm} onChange={(e) => onChange({ ...value, ritmoAlvoMinKm: e.target.value })} />
    </div>
  );
}

function CiclismoEditor({ value, onChange }: { value: CiclismoForm; onChange: (v: CiclismoForm) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Distância (km)" type="number" step="0.5" min={1} value={value.distanciaKm} onChange={(e) => onChange({ ...value, distanciaKm: Number(e.target.value) })} />
      <Field label="Potência alvo (W)" type="number" min={0} value={value.potenciaAlvoW ?? ''} onChange={(e) => onChange({ ...value, potenciaAlvoW: e.target.value === '' ? undefined : Number(e.target.value) })} />
    </div>
  );
}

function NatacaoEditor({ series, onChange }: { series: NatacaoForm[]; onChange: (v: NatacaoForm[]) => void }) {
  const update = (i: number, patch: Partial<NatacaoForm>) => onChange(series.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const add = () => onChange([...series, { repeticoes: 4, distanciaM: 100, estilo: 'LIVRE', descansoSeg: 20 }]);
  const remove = (i: number) => onChange(series.filter((_, idx) => idx !== i));

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Séries ({series.length})</Label>
        <button type="button" onClick={add} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Série</button>
      </div>
      {series.map((s, i) => (
        <div key={i} className="p-3 mb-2 rounded-[14px] bg-surface border border-app">
          <div className="flex items-center justify-between mb-2">
            <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
              Série {String(i + 1).padStart(2, '0')}
            </span>
            {series.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-[10px] uppercase text-danger">
                remover
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Repetições" type="number" min={1} value={s.repeticoes} onChange={(e) => update(i, { repeticoes: Number(e.target.value) })} />
            <Field label="Distância (m)" type="number" min={25} step={25} value={s.distanciaM} onChange={(e) => update(i, { distanciaM: Number(e.target.value) })} />
          </div>
          <Label>Estilo</Label>
          <select
            value={s.estilo}
            onChange={(e) => update(i, { estilo: e.target.value as NatacaoForm['estilo'] })}
            className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
          >
            <option value="LIVRE">Livre</option>
            <option value="COSTAS">Costas</option>
            <option value="PEITO">Peito</option>
            <option value="BORBOLETA">Borboleta</option>
            <option value="MEDLEY">Medley</option>
          </select>
          <Field label="Descanso (s)" type="number" min={0} value={s.descansoSeg ?? ''} onChange={(e) => update(i, { descansoSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </div>
      ))}
    </div>
  );
}
