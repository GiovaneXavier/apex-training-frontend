import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import { listAlunos, type AlunoVinculado } from '@/lib/api/professor';
import { prescreverTreino } from '@/lib/api/treinos';
import { cn } from '@/lib/utils';
import {
  CORRIDA_SUBTIPO_LABEL,
  HYROX_MOV_LABEL,
  MODALIDADE_LABEL,
  ZONA_FTP_DESCR,
  type CiclismoBloco,
  type CorridaBloco,
  type CorridaBlocoTipo,
  type CorridaSubtipo,
  type ExercicioMusc,
  type HyroxBloco,
  type HyroxExercicio,
  type HyroxExercicioMov,
  type HyroxFormato,
  type Modalidade,
  type NatacaoBloco,
  type TreinoDetalhes,
  type ZonaFTP,
} from '@/types/treino';

// HYROX no front é mapeado pra modalidade OUTRO no backend (Prisma enum sem HYROX).
type ModalidadeUI = Modalidade | 'HYROX';
const MODALIDADES_UI: ModalidadeUI[] = [
  'MUSCULACAO', 'CORRIDA', 'CICLISMO', 'NATACAO', 'HYROX', 'OUTRO',
];

const MODALIDADE_UI_LABEL: Record<ModalidadeUI, string> = {
  ...MODALIDADE_LABEL,
  HYROX: 'Hyrox',
  TRIATHLON: 'Triathlon',
};

// ─────────────────────────────────────────────────────────────
// Tipos auxiliares de form
// ─────────────────────────────────────────────────────────────
type ExerForm = {
  nome: string;
  videoUrl: string;
  series: number;
  reps: number;
  cargaPctRP?: number;
  descansoSeg: number;
};

const novoExercicio = (): ExerForm => ({
  nome: '', videoUrl: '', series: 3, reps: 12, cargaPctRP: 70, descansoSeg: 90,
});

const novoCorridaBloco = (tipo: CorridaBlocoTipo = 'tiro'): CorridaBloco => ({
  tipo,
  distanciaM: tipo === 'aquecimento' || tipo === 'volta_calma' ? 1000 : 400,
  ritmoAlvoMinKm: '5:00',
  repeticoes: tipo === 'tiro' ? 6 : 1,
  recuperacaoSeg: tipo === 'tiro' ? 90 : 0,
  recuperacaoTipo: 'trote',
});

const novoCiclismoBloco = (zona: ZonaFTP = 4): CiclismoBloco => ({
  tipo: 'intervalo',
  zonaFTP: zona,
  potenciaAlvoPctFTP: zona === 4 ? 100 : zona === 5 ? 110 : 70,
  duracaoSeg: 300,
  repeticoes: 4,
  recuperacaoSeg: 180,
});

const novoNatacaoBloco = (): NatacaoBloco => ({
  tipo: 'principal',
  repeticoes: 10,
  distanciaM: 100,
  estilo: 'LIVRE',
  paceCssOffsetSeg: 2,
  descansoSeg: 15,
});

const novoHyroxBloco = (formato: HyroxFormato = 'AMRAP'): HyroxBloco => {
  const base: HyroxBloco = { formato };
  if (formato === 'AMRAP') return { ...base, duracaoSeg: 600, exercicios: [novoHyroxExercicio()] };
  if (formato === 'EMOM') return { ...base, rounds: 10, intervaloOffSeg: 60, exercicios: [novoHyroxExercicio()] };
  if (formato === 'FOR_TIME') return { ...base, duracaoSeg: 1200, exercicios: [novoHyroxExercicio()] };
  if (formato === 'TABATA') return { ...base, rounds: 8, intervaloOnSeg: 20, intervaloOffSeg: 10, exercicios: [novoHyroxExercicio()] };
  if (formato === 'INTERVAL') return { ...base, rounds: 5, intervaloOnSeg: 60, intervaloOffSeg: 30, exercicios: [novoHyroxExercicio()] };
  if (formato === 'RUN') return { ...base, distanciaM: 1000, ritmoAlvoMinKm: '5:00' };
  return { ...base, exercicios: [novoHyroxExercicio()] }; // STATION
};

const novoHyroxExercicio = (mov: HyroxExercicioMov = 'WALL_BALLS'): HyroxExercicio => ({
  movimento: mov, repeticoes: 50, carga: { open: 6, pro: 9, unidade: 'kg' },
});

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function ProfPrescrever() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const alunoIdQuery = params.get('alunoId');

  const [alunos, setAlunos] = useState<AlunoVinculado[]>([]);
  const [alunoId, setAlunoId] = useState<string>(alunoIdQuery ?? '');
  const [modalidade, setModalidade] = useState<ModalidadeUI>('MUSCULACAO');
  const [titulo, setTitulo] = useState('');
  const [dataAlvo, setDataAlvo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  // Detalhes por modalidade
  const [exercicios, setExercicios] = useState<ExerForm[]>([novoExercicio()]);

  const [corridaSubtipo, setCorridaSubtipo] = useState<CorridaSubtipo>('BASE');
  const [corridaModo, setCorridaModo] = useState<'simples' | 'avancado'>('simples');
  const [corridaSimples, setCorridaSimples] = useState({ distanciaKm: 5, ritmoAlvoMinKm: '5:30' });
  const [corridaBlocos, setCorridaBlocos] = useState<CorridaBloco[]>([
    { tipo: 'aquecimento', distanciaM: 1500, ritmoAlvoMinKm: '6:30', repeticoes: 1 },
    novoCorridaBloco('tiro'),
    { tipo: 'volta_calma', distanciaM: 1000, ritmoAlvoMinKm: '6:30', repeticoes: 1 },
  ]);

  const [ftpW, setFtpW] = useState(220);
  const [ciclismoModo, setCiclismoModo] = useState<'simples' | 'avancado'>('avancado');
  const [ciclismoSimples, setCiclismoSimples] = useState({ distanciaKm: 30, potenciaAlvoW: 180 });
  const [ciclismoBlocos, setCiclismoBlocos] = useState<CiclismoBloco[]>([
    { tipo: 'aquecimento', zonaFTP: 2, duracaoSeg: 600 },
    novoCiclismoBloco(5),
    { tipo: 'volta_calma', zonaFTP: 1, duracaoSeg: 300 },
  ]);

  const [cssBaseSegPor100m, setCssBaseSegPor100m] = useState(95);
  const [natacaoBlocos, setNatacaoBlocos] = useState<NatacaoBloco[]>([
    { tipo: 'aquecimento', repeticoes: 1, distanciaM: 400, estilo: 'LIVRE' },
    novoNatacaoBloco(),
    { tipo: 'volta_calma', repeticoes: 1, distanciaM: 200, estilo: 'LIVRE' },
  ]);

  const [hyroxBlocos, setHyroxBlocos] = useState<HyroxBloco[]>([
    { formato: 'RUN', distanciaM: 1000, ritmoAlvoMinKm: '5:00' },
    novoHyroxBloco('AMRAP'),
  ]);

  const [outroDescricao, setOutroDescricao] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAlunos()
      .then((list) => {
        setAlunos(list);
        if (!alunoId && list.length > 0) setAlunoId(list[0].alunoId);
      })
      .catch((err) => setError(apiErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (corridaModo === 'simples') {
          return {
            tipo: 'corrida',
            subtipo: corridaSubtipo,
            distanciaKm: Number(corridaSimples.distanciaKm),
            ritmoAlvoMinKm: corridaSimples.ritmoAlvoMinKm || undefined,
          };
        }
        return { tipo: 'corrida', subtipo: corridaSubtipo, blocos: corridaBlocos };
      case 'CICLISMO':
        if (ciclismoModo === 'simples') {
          return {
            tipo: 'ciclismo',
            ftpW,
            distanciaKm: Number(ciclismoSimples.distanciaKm),
            potenciaAlvoW: Number(ciclismoSimples.potenciaAlvoW),
          };
        }
        return { tipo: 'ciclismo', ftpW, blocos: ciclismoBlocos };
      case 'NATACAO':
        return { tipo: 'natacao', cssBaseSegPor100m, blocos: natacaoBlocos };
      case 'HYROX':
        return { tipo: 'hyrox', blocos: hyroxBlocos };
      case 'OUTRO':
        return { tipo: 'outro', descricao: outroDescricao.trim() };
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
      setError('Todos os exercícios precisam de nome'); return;
    }
    if (modalidade === 'OUTRO' && !outroDescricao.trim()) {
      setError('Descreva o treino'); return;
    }

    // HYROX → modalidade OUTRO no Prisma (enum não tem HYROX)
    const modalidadeAPI: Modalidade = modalidade === 'HYROX' ? 'OUTRO' : modalidade;

    setSubmitting(true);
    try {
      const treino = await prescreverTreino({
        alunoId,
        modalidade: modalidadeAPI,
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

      <div className="px-5 max-w-2xl mx-auto">
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
            {MODALIDADES_UI.map((m) => (
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
                {MODALIDADE_UI_LABEL[m]}
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
            <CorridaEditor
              subtipo={corridaSubtipo} onSubtipo={setCorridaSubtipo}
              modo={corridaModo} onModo={setCorridaModo}
              simples={corridaSimples} onSimples={setCorridaSimples}
              blocos={corridaBlocos} onBlocos={setCorridaBlocos}
            />
          )}
          {modalidade === 'CICLISMO' && (
            <CiclismoEditor
              ftpW={ftpW} onFtpW={setFtpW}
              modo={ciclismoModo} onModo={setCiclismoModo}
              simples={ciclismoSimples} onSimples={setCiclismoSimples}
              blocos={ciclismoBlocos} onBlocos={setCiclismoBlocos}
            />
          )}
          {modalidade === 'NATACAO' && (
            <NatacaoEditor
              css={cssBaseSegPor100m} onCss={setCssBaseSegPor100m}
              blocos={natacaoBlocos} onBlocos={setNatacaoBlocos}
            />
          )}
          {modalidade === 'HYROX' && (
            <HyroxEditor blocos={hyroxBlocos} onBlocos={setHyroxBlocos} />
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

// ─────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
      {children}
    </div>
  );
}

function ModeToggle<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
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
            value === o.value ? 'bg-ink text-bg' : 'bg-surface border border-app-strong text-ink-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BlocoCard({
  index, total, label, onRemove, children,
}: {
  index: number; total: number; label: string;
  onRemove?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="p-3 mb-2 rounded-[14px] bg-surface border border-app">
      <div className="flex items-center justify-between mb-2">
        <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
          {label} {String(index + 1).padStart(2, '0')}
        </span>
        {onRemove && total > 1 && (
          <button type="button" onClick={onRemove} className="text-[10px] uppercase tracking-wider text-danger">
            remover
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MUSCULAÇÃO
// ─────────────────────────────────────────────────────────────
function MuscEditor({ exercicios, onChange }: {
  exercicios: ExerForm[]; onChange: (v: ExerForm[]) => void;
}) {
  const update = (i: number, patch: Partial<ExerForm>) =>
    onChange(exercicios.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
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
        <BlocoCard key={i} index={i} total={exercicios.length} label="Exercício" onRemove={() => remove(i)}>
          <Field label="Nome" placeholder="Supino Inclinado" value={ex.nome}
            onChange={(e) => update(i, { nome: e.target.value })} required />
          <Field label="Vídeo URL (opcional)" placeholder="https://..." value={ex.videoUrl}
            onChange={(e) => update(i, { videoUrl: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Séries" type="number" min={1} value={ex.series}
              onChange={(e) => update(i, { series: Number(e.target.value) })} />
            <Field label="Reps" type="number" min={1} value={ex.reps}
              onChange={(e) => update(i, { reps: Number(e.target.value) })} />
            <Field label="% RP" type="number" min={0} max={150} value={ex.cargaPctRP ?? ''}
              onChange={(e) => update(i, { cargaPctRP: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="RI (s)" type="number" min={0} value={ex.descansoSeg}
              onChange={(e) => update(i, { descansoSeg: Number(e.target.value) })} />
          </div>
        </BlocoCard>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CORRIDA
// ─────────────────────────────────────────────────────────────
function CorridaEditor({
  subtipo, onSubtipo, modo, onModo,
  simples, onSimples, blocos, onBlocos,
}: {
  subtipo: CorridaSubtipo; onSubtipo: (s: CorridaSubtipo) => void;
  modo: 'simples' | 'avancado'; onModo: (m: 'simples' | 'avancado') => void;
  simples: { distanciaKm: number; ritmoAlvoMinKm: string };
  onSimples: (v: { distanciaKm: number; ritmoAlvoMinKm: string }) => void;
  blocos: CorridaBloco[]; onBlocos: (v: CorridaBloco[]) => void;
}) {
  return (
    <>
      <Label>Tipo de treino</Label>
      <select
        value={subtipo}
        onChange={(e) => onSubtipo(e.target.value as CorridaSubtipo)}
        className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4"
      >
        {(Object.keys(CORRIDA_SUBTIPO_LABEL) as CorridaSubtipo[]).map((s) => (
          <option key={s} value={s}>{CORRIDA_SUBTIPO_LABEL[s]}</option>
        ))}
      </select>

      <ModeToggle value={modo} onChange={onModo} options={[
        { value: 'simples', label: 'Simples' },
        { value: 'avancado', label: 'Por blocos' },
      ]} />

      {modo === 'simples' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Distância (km)" type="number" step="0.1" min={0.1} value={simples.distanciaKm}
            onChange={(e) => onSimples({ ...simples, distanciaKm: Number(e.target.value) })} />
          <Field label="Ritmo alvo (MM:SS/km)" placeholder="5:30" value={simples.ritmoAlvoMinKm}
            onChange={(e) => onSimples({ ...simples, ritmoAlvoMinKm: e.target.value })} />
        </div>
      ) : (
        <CorridaBlocosEditor blocos={blocos} onChange={onBlocos} />
      )}
    </>
  );
}

function CorridaBlocosEditor({
  blocos, onChange,
}: { blocos: CorridaBloco[]; onChange: (v: CorridaBloco[]) => void }) {
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
          <select
            value={b.tipo}
            onChange={(e) => update(i, { tipo: e.target.value as CorridaBlocoTipo })}
            className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
          >
            <option value="aquecimento">Aquecimento</option>
            <option value="tiro">Tiro / Intervalo</option>
            <option value="continuo">Contínuo</option>
            <option value="progressao">Progressão</option>
            <option value="subida">Subida</option>
            <option value="recuperacao">Recuperação</option>
            <option value="volta_calma">Volta calma</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Distância (m)" type="number" min={0} value={b.distanciaM ?? ''}
              onChange={(e) => update(i, { distanciaM: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Duração (s)" type="number" min={0} value={b.duracaoSeg ?? ''}
              onChange={(e) => update(i, { duracaoSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Repetições" type="number" min={1} value={b.repeticoes ?? 1}
              onChange={(e) => update(i, { repeticoes: Number(e.target.value) })} />
            <Field label="Ritmo (MM:SS/km)" placeholder="4:30" value={b.ritmoAlvoMinKm ?? ''}
              onChange={(e) => update(i, { ritmoAlvoMinKm: e.target.value || undefined })} />
            <Field label="RI entre reps (s)" type="number" min={0} value={b.recuperacaoSeg ?? 0}
              onChange={(e) => update(i, { recuperacaoSeg: Number(e.target.value) })} />
            <Field label="RPE alvo (1-10)" type="number" min={1} max={10} value={b.rpeAlvo ?? ''}
              onChange={(e) => update(i, { rpeAlvo: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </div>
        </BlocoCard>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CICLISMO
// ─────────────────────────────────────────────────────────────
function CiclismoEditor({
  ftpW, onFtpW, modo, onModo,
  simples, onSimples, blocos, onBlocos,
}: {
  ftpW: number; onFtpW: (v: number) => void;
  modo: 'simples' | 'avancado'; onModo: (m: 'simples' | 'avancado') => void;
  simples: { distanciaKm: number; potenciaAlvoW: number };
  onSimples: (v: { distanciaKm: number; potenciaAlvoW: number }) => void;
  blocos: CiclismoBloco[]; onBlocos: (v: CiclismoBloco[]) => void;
}) {
  return (
    <>
      <Field label="FTP do aluno (W)" type="number" min={50} value={ftpW}
        onChange={(e) => onFtpW(Number(e.target.value))}
        hint="Functional Threshold Power — base das zonas de potência" />

      <ModeToggle value={modo} onChange={onModo} options={[
        { value: 'simples', label: 'Simples' },
        { value: 'avancado', label: 'Por zonas FTP' },
      ]} />

      {modo === 'simples' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Distância (km)" type="number" step="0.5" min={1} value={simples.distanciaKm}
            onChange={(e) => onSimples({ ...simples, distanciaKm: Number(e.target.value) })} />
          <Field label="Potência alvo (W)" type="number" min={0} value={simples.potenciaAlvoW}
            onChange={(e) => onSimples({ ...simples, potenciaAlvoW: Number(e.target.value) })} />
        </div>
      ) : (
        <CiclismoBlocosEditor ftpW={ftpW} blocos={blocos} onChange={onBlocos} />
      )}
    </>
  );
}

function CiclismoBlocosEditor({
  ftpW, blocos, onChange,
}: { ftpW: number; blocos: CiclismoBloco[]; onChange: (v: CiclismoBloco[]) => void }) {
  const update = (i: number, patch: Partial<CiclismoBloco>) =>
    onChange(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(blocos.filter((_, idx) => idx !== i));
  const add = () => onChange([...blocos, novoCiclismoBloco()]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Blocos ({blocos.length})</Label>
        <button type="button" onClick={add} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Bloco</button>
      </div>
      {blocos.map((b, i) => {
        const watts = b.potenciaAlvoPctFTP ? Math.round((b.potenciaAlvoPctFTP / 100) * ftpW) : b.potenciaAlvoW;
        return (
          <BlocoCard key={i} index={i} total={blocos.length} label="Bloco" onRemove={() => remove(i)}>
            <Label>Tipo</Label>
            <select
              value={b.tipo}
              onChange={(e) => update(i, { tipo: e.target.value as CiclismoBloco['tipo'] })}
              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
            >
              <option value="aquecimento">Aquecimento</option>
              <option value="intervalo">Intervalo</option>
              <option value="continuo">Contínuo</option>
              <option value="sprint">Sprint</option>
              <option value="recuperacao">Recuperação</option>
              <option value="volta_calma">Volta calma</option>
            </select>

            <Label>Zona FTP</Label>
            <select
              value={b.zonaFTP ?? ''}
              onChange={(e) => update(i, { zonaFTP: e.target.value === '' ? undefined : Number(e.target.value) as ZonaFTP })}
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
              <Field label="% FTP alvo" type="number" min={0} max={300} value={b.potenciaAlvoPctFTP ?? ''}
                onChange={(e) => update(i, { potenciaAlvoPctFTP: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Field label="Potência (W)" type="number" min={0} value={watts ?? ''}
                onChange={(e) => update(i, { potenciaAlvoW: e.target.value === '' ? undefined : Number(e.target.value), potenciaAlvoPctFTP: undefined })}
                hint={b.potenciaAlvoPctFTP ? `${watts}W @ ${b.potenciaAlvoPctFTP}% FTP` : undefined} />
              <Field label="Duração (s)" type="number" min={0} value={b.duracaoSeg ?? ''}
                onChange={(e) => update(i, { duracaoSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Field label="Repetições" type="number" min={1} value={b.repeticoes ?? 1}
                onChange={(e) => update(i, { repeticoes: Number(e.target.value) })} />
              <Field label="RI (s)" type="number" min={0} value={b.recuperacaoSeg ?? 0}
                onChange={(e) => update(i, { recuperacaoSeg: Number(e.target.value) })} />
              <Field label="Cadência (rpm)" type="number" min={0} value={b.cadenciaRpm ?? ''}
                onChange={(e) => update(i, { cadenciaRpm: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
          </BlocoCard>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NATAÇÃO — CSS
// ─────────────────────────────────────────────────────────────
function NatacaoEditor({
  css, onCss, blocos, onBlocos,
}: {
  css: number; onCss: (v: number) => void;
  blocos: NatacaoBloco[]; onBlocos: (v: NatacaoBloco[]) => void;
}) {
  return (
    <>
      <Field label="CSS base (s/100m)" type="number" min={30} max={300} value={css}
        onChange={(e) => onCss(Number(e.target.value))}
        hint="Critical Swim Speed — calculado dos testes 400m e 200m" />
      <NatacaoBlocosEditor css={css} blocos={blocos} onChange={onBlocos} />
    </>
  );
}

function NatacaoBlocosEditor({
  css, blocos, onChange,
}: { css: number; blocos: NatacaoBloco[]; onChange: (v: NatacaoBloco[]) => void }) {
  const update = (i: number, patch: Partial<NatacaoBloco>) =>
    onChange(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(blocos.filter((_, idx) => idx !== i));
  const add = () => onChange([...blocos, novoNatacaoBloco()]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Blocos ({blocos.length})</Label>
        <button type="button" onClick={add} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Bloco</button>
      </div>
      {blocos.map((b, i) => {
        const paceAbs = b.paceCssOffsetSeg !== undefined ? css + b.paceCssOffsetSeg : b.paceAlvoSegPor100m;
        const paceTxt = paceAbs ? `${Math.floor(paceAbs / 60)}:${String(Math.round(paceAbs % 60)).padStart(2, '0')}/100m` : '—';
        return (
          <BlocoCard key={i} index={i} total={blocos.length} label="Bloco" onRemove={() => remove(i)}>
            <Label>Tipo</Label>
            <select
              value={b.tipo}
              onChange={(e) => update(i, { tipo: e.target.value as NatacaoBloco['tipo'] })}
              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
            >
              <option value="aquecimento">Aquecimento</option>
              <option value="principal">Principal</option>
              <option value="tecnica">Técnica</option>
              <option value="volta_calma">Volta calma</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Repetições" type="number" min={1} value={b.repeticoes}
                onChange={(e) => update(i, { repeticoes: Number(e.target.value) })} />
              <Field label="Distância (m)" type="number" min={25} step={25} value={b.distanciaM}
                onChange={(e) => update(i, { distanciaM: Number(e.target.value) })} />
            </div>

            <Label>Estilo</Label>
            <select
              value={b.estilo ?? 'LIVRE'}
              onChange={(e) => update(i, { estilo: e.target.value as NatacaoBloco['estilo'] })}
              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
            >
              <option value="LIVRE">Livre</option>
              <option value="COSTAS">Costas</option>
              <option value="PEITO">Peito</option>
              <option value="BORBOLETA">Borboleta</option>
              <option value="MEDLEY">Medley</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Offset CSS (s)" type="number" step="1" value={b.paceCssOffsetSeg ?? ''}
                onChange={(e) => update(i, { paceCssOffsetSeg: e.target.value === '' ? undefined : Number(e.target.value), paceAlvoSegPor100m: undefined })}
                hint={b.paceCssOffsetSeg !== undefined ? `Pace alvo: ${paceTxt}` : 'CSS+0 = ritmo CSS'} />
              <Field label="Send-off (s)" type="number" min={0} value={b.sendOffSeg ?? ''}
                onChange={(e) => update(i, { sendOffSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Field label="RI fixo (s)" type="number" min={0} value={b.descansoSeg ?? ''}
                onChange={(e) => update(i, { descansoSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
          </BlocoCard>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HYROX — AMRAP / EMOM / FOR_TIME / RUN / STATION
// ─────────────────────────────────────────────────────────────
function HyroxEditor({
  blocos, onBlocos,
}: { blocos: HyroxBloco[]; onBlocos: (v: HyroxBloco[]) => void }) {
  const update = (i: number, patch: Partial<HyroxBloco>) =>
    onBlocos(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onBlocos(blocos.filter((_, idx) => idx !== i));

  function add(formato: HyroxFormato) {
    onBlocos([...blocos, novoHyroxBloco(formato)]);
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <Label>Blocos ({blocos.length})</Label>
      </div>
      <div className="grid grid-cols-4 gap-1 mb-3">
        {(['AMRAP', 'EMOM', 'FOR_TIME', 'TABATA', 'INTERVAL', 'RUN', 'STATION'] as HyroxFormato[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => add(f)}
            className="py-1.5 rounded-[8px] text-[10px] font-bold uppercase tracking-wider bg-surface border border-app-strong text-accent"
          >
            +{f}
          </button>
        ))}
      </div>
      {blocos.map((b, i) => (
        <BlocoCard key={i} index={i} total={blocos.length} label={b.formato} onRemove={() => remove(i)}>
          {(b.formato === 'AMRAP' || b.formato === 'FOR_TIME') && (
            <Field label="Cap (s)" type="number" min={0} value={b.duracaoSeg ?? ''}
              onChange={(e) => update(i, { duracaoSeg: Number(e.target.value) })}
              hint={b.formato === 'AMRAP' ? 'Tempo total — máximo de reps' : 'Tempo limite para completar'} />
          )}
          {(b.formato === 'EMOM' || b.formato === 'TABATA' || b.formato === 'INTERVAL') && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Rounds" type="number" min={1} value={b.rounds ?? 1}
                onChange={(e) => update(i, { rounds: Number(e.target.value) })} />
              <Field label="On (s)" type="number" min={0} value={b.intervaloOnSeg ?? ''}
                onChange={(e) => update(i, { intervaloOnSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Field label="Off (s)" type="number" min={0} value={b.intervaloOffSeg ?? ''}
                onChange={(e) => update(i, { intervaloOffSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
          )}
          {b.formato === 'RUN' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Distância (m)" type="number" min={0} value={b.distanciaM ?? ''}
                onChange={(e) => update(i, { distanciaM: Number(e.target.value) })} />
              <Field label="Ritmo (MM:SS/km)" placeholder="5:00" value={b.ritmoAlvoMinKm ?? ''}
                onChange={(e) => update(i, { ritmoAlvoMinKm: e.target.value || undefined })} />
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
}: { exercicios: HyroxExercicio[]; onChange: (v: HyroxExercicio[]) => void }) {
  const update = (i: number, patch: Partial<HyroxExercicio>) =>
    onChange(exercicios.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const updateCarga = (i: number, patch: Partial<NonNullable<HyroxExercicio['carga']>>) =>
    onChange(exercicios.map((e, idx) => (idx === i ? { ...e, carga: { ...e.carga, ...patch } } : e)));
  const remove = (i: number) => onChange(exercicios.filter((_, idx) => idx !== i));
  const add = () => onChange([...exercicios, novoHyroxExercicio()]);

  return (
    <div className="mt-3 pt-3 border-t border-app">
      <div className="flex items-center justify-between mb-2">
        <Label>Exercícios ({exercicios.length})</Label>
        <button type="button" onClick={add} className="text-[11px] font-bold uppercase tracking-wider text-accent">+ Mov</button>
      </div>
      {exercicios.map((ex, i) => (
        <div key={i} className="p-2 mb-2 rounded-[10px] bg-bg border border-app">
          <div className="flex items-center justify-between mb-2">
            <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">Mov {String(i + 1).padStart(2, '0')}</span>
            {exercicios.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-[10px] uppercase text-danger">remover</button>
            )}
          </div>
          <Label>Movimento</Label>
          <select
            value={ex.movimento}
            onChange={(e) => update(i, { movimento: e.target.value as HyroxExercicioMov })}
            className="w-full h-10 px-3 rounded-[10px] bg-surface border border-app-strong text-ink text-[13px] mb-2"
          >
            {(Object.keys(HYROX_MOV_LABEL) as HyroxExercicioMov[]).map((m) => (
              <option key={m} value={m}>{HYROX_MOV_LABEL[m]}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Reps" type="number" min={0} value={ex.repeticoes ?? ''}
              onChange={(e) => update(i, { repeticoes: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Distância (m)" type="number" min={0} value={ex.distanciaM ?? ''}
              onChange={(e) => update(i, { distanciaM: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Duração (s)" type="number" min={0} value={ex.duracaoSeg ?? ''}
              onChange={(e) => update(i, { duracaoSeg: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Carga Open (kg)" type="number" min={0} value={ex.carga?.open ?? ''}
              onChange={(e) => updateCarga(i, { open: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <Field label="Carga Pro (kg)" type="number" min={0} value={ex.carga?.pro ?? ''}
              onChange={(e) => updateCarga(i, { pro: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </div>
        </div>
      ))}
    </div>
  );
}
