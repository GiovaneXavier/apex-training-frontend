import { FormEvent, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Field } from '@/components/auth/Field';
import { Card } from '@/components/ui/card';
import { apiErrorMessage } from '@/lib/api';
import { listAlunos, type AlunoVinculado } from '@/lib/api/professor';
import { prescreverTreino } from '@/lib/api/treinos';
import { cn } from '@/lib/utils';
import {
  type CiclismoBloco,
  type CorridaBloco,
  type CorridaSubtipo,
  type ExercicioMusc,
  type HyroxBloco,
  type Modalidade,
  type NatacaoBloco,
  type TreinoDetalhes,
} from '@/types/treino';

import { FormCiclismo } from '@/components/professor/forms/FormCiclismo';
import { FormCorrida } from '@/components/professor/forms/FormCorrida';
import { FormHyrox } from '@/components/professor/forms/FormHyrox';
import { FormMusculacao } from '@/components/professor/forms/FormMusculacao';
// PR #39 (Sprint 14) — contexto Race A do aluno no "cockpit" do coach.
import { ProvaAlvoBanner } from '@/components/professor/ProvaAlvoBanner';
import type { DraftTreinoResponse } from '@/lib/api/aiDraft';

// PR #30 — AIDraftModal lazy. Chunk separado: só baixa quando coach
// clica "✨ Gerar com IA". Mantém initial bundle do Prescrever intacto.
const AIDraftModal = lazy(() => import('@/components/professor/AIDraftModal'));
import { FormNatacao } from '@/components/professor/forms/FormNatacao';
import { PreviewCard } from '@/components/professor/forms/PreviewCard';
import {
  MODALIDADES_UI,
  MODALIDADE_UI_LABEL,
  novoCiclismoBloco,
  novoCorridaBloco,
  novoExercicio,
  novoHyroxBloco,
  novoNatacaoBloco,
  type ExerForm,
  type ModalidadeUI,
} from '@/components/professor/forms/shared';

export default function ProfPrescrever() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const alunoIdQuery = params.get('alunoId');

  // ── Cabeçalho/base ─────────────────────────────────────────
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

  // ── Estados por modalidade ─────────────────────────────────
  const [exercicios, setExercicios] = useState<ExerForm[]>([novoExercicio()]);

  // PR #30 — Modal IA Draft. Lazy import. Aplicação substitui a lista
  // de exercícios com diasSugeridos[0] do draft (1 treino = 1 dia da
  // rotina); restante dos dias é exibido como toast pra coach criar
  // treinos adicionais.
  const [aiDraftOpen, setAiDraftOpen] = useState(false);

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

  // ── Compila JSON de detalhes (separa volume × intensidade no formato SWF) ──
  const detalhes: TreinoDetalhes = useMemo(() => {
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
  }, [
    modalidade, exercicios,
    corridaModo, corridaSubtipo, corridaSimples, corridaBlocos,
    ciclismoModo, ftpW, ciclismoSimples, ciclismoBlocos,
    cssBaseSegPor100m, natacaoBlocos,
    hyroxBlocos, outroDescricao,
  ]);

  // PR #30 — Aplica draft IA: substitui lista de exercícios com o dia 1
  // do draft. Demais dias viram toast informativo pra coach criar como
  // treinos adicionais. Confirma se há exercícios não-vazios pra evitar
  // sobrescrever trabalho.
  function applyAiDraft(draft: DraftTreinoResponse) {
    const hasFilledExercicios = exercicios.some((e) => e.nome.trim().length > 0);
    if (hasFilledExercicios) {
      const ok = window.confirm(
        'Já há exercícios preenchidos. Substituir pelo draft IA?',
      );
      if (!ok) return;
    }
    const dia1 = draft.diasSugeridos[0];
    if (!dia1) return;
    const novos: ExerForm[] = dia1.exercicios.map((ex) => ({
      exercicioId: ex.exercicioId ?? undefined,
      // Usa nome canônico quando bateu no catálogo; senão preserva o do LLM.
      nome: ex.nomeCanonico ?? ex.nome,
      videoUrl: '',
      series: ex.series,
      // repsRange → number pro form atual. Pega faixa alta ("8-12" → 12).
      reps: parseRepsRange(ex.repsRange),
      cargaPctRP: ex.cargaPctRP ?? undefined,
      descansoSeg: ex.descansoSeg,
    }));
    setExercicios(novos);
    // Sugestão de título se ainda vazio
    if (!titulo.trim()) setTitulo(`${dia1.label}`);
    // Dias restantes → toast com instrução
    const remainingDays = draft.diasSugeridos.length - 1;
    if (remainingDays > 0) {
      toast(`Aplicado o ${dia1.label}. Mais ${remainingDays} dia${remainingDays > 1 ? 's' : ''} no draft — crie como treinos separados se quiser.`, { duration: 8000 });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alunoId) { setError('Selecione um aluno'); return; }
    if (!titulo.trim()) { setError('Informe um título'); return; }
    if (modalidade === 'MUSCULACAO' && exercicios.some((ex) => !ex.nome.trim())) {
      setError('Todos os exercícios precisam de nome'); return;
    }
    if (modalidade === 'OUTRO' && !outroDescricao.trim()) {
      setError('Descreva o treino'); return;
    }

    // HYROX → modalidade OUTRO no Prisma (enum não tem HYROX ainda)
    const modalidadeAPI: Modalidade = modalidade === 'HYROX' ? 'OUTRO' : modalidade;

    setSubmitting(true);
    try {
      const treino = await prescreverTreino({
        alunoId,
        modalidade: modalidadeAPI,
        titulo: titulo.trim(),
        dataAlvo: new Date(dataAlvo).toISOString(),
        detalhes,
      });
      navigate(`/professor/aluno/${treino.alunoId}`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink pb-12">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link
          to={alunoIdQuery ? `/professor/aluno/${alunoIdQuery}` : '/professor/dashboard'}
          className="text-mono text-[12px] uppercase tracking-wider text-ink-muted font-bold"
        >
          ← Voltar
        </Link>
        <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
          Workout Builder
        </span>
      </header>

      <div className="px-5 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* ── Coluna: formulário ───────────────────────────── */}
        <div>
          <h1 className="text-[28px] font-bold tracking-tight mb-1">Prescrever treino</h1>
          <p className="text-ink-muted text-sm mb-5">
            Multi-sports · gera o JSON estruturado (SWF) automaticamente.
          </p>

          {error && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <Card className="p-4 mb-4">
              <SecHeader>1 · Configuração base</SecHeader>

              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
                Aluno
              </div>
              <select
                value={alunoId}
                onChange={(e) => setAlunoId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3"
              >
                <option value="">Selecione...</option>
                {alunos.map((a) => (
                  <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>
                ))}
              </select>
              {alunoSelecionado && (
                <div className="text-[11px] text-ink-subtle -mt-2 mb-2">
                  {alunoSelecionado.email}
                </div>
              )}

              {/* PR #39 — banner passivo da Race A do aluno selecionado.
                  Simetria de vocabulário com o Dashboard do aluno: mesma
                  fase, mesma cor, mesmas fronteiras temporais. Sem aluno
                  selecionado, banner não renderiza (null).
                  Aviso de colisão (volume vs fase) fica pra IA do Coach
                  no PR seguinte — gancho onFaseChange já está plantado. */}
              <ProvaAlvoBanner alunoId={alunoId} className="mb-4" />


              <Field
                label="Título"
                placeholder="Treino A · Superiores"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
              />

              <Field
                label="Data alvo"
                type="datetime-local"
                value={dataAlvo}
                onChange={(e) => setDataAlvo(e.target.value)}
                required
              />

              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5 mt-2">
                Modalidade
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-1">
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
            </Card>

            <Card className="p-4 mb-4">
              <SecHeader>
                2 · Detalhes da modalidade · {MODALIDADE_UI_LABEL[modalidade]}
              </SecHeader>

              {modalidade === 'MUSCULACAO' && (
                <>
                  {/* PR #30 — CTA pra abrir geração IA do esqueleto.
                      Disabled enquanto aluno não selecionado (modal
                      precisa do contexto). */}
                  <button
                    type="button"
                    onClick={() => setAiDraftOpen(true)}
                    disabled={!alunoId}
                    data-testid="ai-draft-open"
                    className={cn(
                      'w-full h-11 mb-3 rounded-[12px] border border-accent/40 bg-surface',
                      'text-accent text-[12px] font-bold uppercase tracking-wider',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    ✨ Gerar rotina com IA
                  </button>
                  <FormMusculacao
                    exercicios={exercicios}
                    onChange={setExercicios}
                    alunoId={alunoId}
                  />
                </>
              )}
              {modalidade === 'CORRIDA' && (
                <FormCorrida
                  subtipo={corridaSubtipo} onSubtipo={setCorridaSubtipo}
                  modo={corridaModo} onModo={setCorridaModo}
                  simples={corridaSimples} onSimples={setCorridaSimples}
                  blocos={corridaBlocos} onBlocos={setCorridaBlocos}
                />
              )}
              {modalidade === 'CICLISMO' && (
                <FormCiclismo
                  ftpW={ftpW} onFtpW={setFtpW}
                  modo={ciclismoModo} onModo={setCiclismoModo}
                  simples={ciclismoSimples} onSimples={setCiclismoSimples}
                  blocos={ciclismoBlocos} onBlocos={setCiclismoBlocos}
                />
              )}
              {modalidade === 'NATACAO' && (
                <FormNatacao
                  css={cssBaseSegPor100m} onCss={setCssBaseSegPor100m}
                  blocos={natacaoBlocos} onBlocos={setNatacaoBlocos}
                />
              )}
              {modalidade === 'HYROX' && (
                <FormHyrox blocos={hyroxBlocos} onBlocos={setHyroxBlocos} />
              )}
              {modalidade === 'OUTRO' && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
                    Descrição
                  </div>
                  <textarea
                    value={outroDescricao}
                    onChange={(e) => setOutroDescricao(e.target.value)}
                    placeholder="Detalhes livres do treino..."
                    className="w-full min-h-[120px] px-3.5 py-2.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-2 resize-y"
                  />
                </>
              )}
            </Card>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] uppercase tracking-wider disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : '✓ Salvar Prescrição'}
            </button>
          </form>
        </div>

        {/* ── Coluna: preview sticky (desktop/tablet) ───────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <PreviewCard
            modalidade={modalidade}
            titulo={titulo}
            dataAlvo={dataAlvo}
            detalhes={detalhes}
          />
          {alunoSelecionado && (
            <div className="mt-3 px-3 py-2 rounded-[10px] bg-surface border border-app text-[11px] text-ink-muted">
              Para: <span className="font-bold text-ink">{alunoSelecionado.nome}</span>
            </div>
          )}
        </aside>
      </div>

      {aiDraftOpen && (
        <Suspense fallback={null}>
          <AIDraftModal
            alunoId={alunoId}
            onApply={applyAiDraft}
            onClose={() => setAiDraftOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

// PR #30 — parser de faixa de reps do LLM ("8-12" → 12 / "30s" → 30 /
// "AMRAP" → fallback 12). Espelha lógica do PR #29 (mas inline aqui
// pra não criar dependência cruzada entre features de IA).
function parseRepsRange(reps: string): number {
  const range = reps.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (range) return Number(range[2]);
  const single = reps.match(/^\s*(\d+)/);
  if (single) return Number(single[1]);
  return 12;
}

function SecHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 pb-3 border-b border-app">
      <div className="text-mono text-[11px] uppercase tracking-[0.7px] font-bold text-ink">
        {children}
      </div>
    </div>
  );
}
