import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { getTheme, type DensityName, type ThemeName } from '@/themes/tokens';
import { useExecucaoTreino } from '@/hooks/useExecucaoTreino';
import { apiErrorMessage } from '@/lib/api';
import { getHistoricoCargas, type HistoricoCarga } from '@/lib/api/treinos';
import { formatDate } from '@/lib/format';
import type { Treino, DetalhesMusculacao } from '@/types/treino';

import { Header } from './Header';
import { ProgressStrip } from './ProgressStrip';
import { ExerciseCard } from './ExerciseCard';
import { SetsTableLive } from './SetsTableLive';
import { SaveSerieBar } from './SaveSerieBar';
import { FinalizeCTA } from './FinalizeCTA';
import { BottomTabs } from './BottomTabs';
import { OfflineBanner } from './OfflineBanner';
import { PRCelebration } from './PRCelebration';
import { WorkoutNavBar } from './WorkoutNavBar';
import { ExerciseListSheet } from './ExerciseListSheet';

type Props = {
  treino: Treino;
  theme: ThemeName;
  density?: DensityName;
};

export function WorkoutLive({ treino, theme, density = 'regular' }: Props) {
  const t = getTheme(theme);
  const navigate = useNavigate();
  const exec = useExecucaoTreino(treino);

  const [historico, setHistorico] = useState<Record<string, HistoricoCarga>>({});
  const [listOpen, setListOpen] = useState(false);
  // Alias do estado persistido — UI lê/escreve via setActiveIdx para
  // manter ergonomia local (`activeIdx`/`setActiveIdx`) sem perder o
  // benefício da persistência em localStorage do hook.
  const activeIdx = exec.state.currentExercicio;
  const setActiveIdx = exec.setExercicio;

  // Carrega histórico de cargas do aluno para os exercícios deste treino.
  // Usa como sugestão quando a prescrição não traz cargaKg explícita.
  //
  // PR #7: passa o nome CANONICAL (sem toLowerCase). O backend usa @>
  // containment com índice GIN no Treino.detalhes, que exige match
  // case-sensitive — alinhado com o snapshot gravado no JSON.
  useEffect(() => {
    if (treino.detalhes.tipo !== 'musculacao') return;
    const nomes = treino.detalhes.exercicios.map((e) => e.nome);
    getHistoricoCargas(nomes).then(setHistorico).catch(() => {});
  }, [treino.id]);

  if (treino.detalhes.tipo !== 'musculacao') {
    return null; // Só musculação por enquanto
  }

  const detalhesMusc = treino.detalhes as DetalhesMusculacao;
  const exAtual = exec.state.exercicios[exec.state.currentExercicio];
  const exAtualPrescrito = detalhesMusc.exercicios[exec.state.currentExercicio];
  const todosCompletos = exec.exerciciosCompletos === exec.state.exercicios.length;
  const exercicioCompleto = exAtual && exAtual.realizado.length >= exAtual.series;

  // Prepara índices dos sets que viraram PR (do retorno backend) por exercício corrente
  const prSetIdxs: number[] = [];
  if (exec.novosRecordes.length > 0 && exAtual) {
    const recsExercicio = exec.novosRecordes.filter((r) => r.exercicio === exAtual.nome);
    if (recsExercicio.length > 0) {
      exAtual.realizado.forEach((set, i) => {
        if (recsExercicio.some((r) => r.valor === set.kg && r.reps === set.reps)) {
          prSetIdxs.push(i);
        }
      });
    }
  }

  async function onFinalizar() {
    try {
      await exec.finalizar();
      // Sucesso silencioso aqui — PRCelebration cobre o feedback positivo
      // quando há novos RPs, e a navegação automática serve como ack visual.
    } catch (err) {
      // SyncBanner já mostra exec.state.syncError quando finalizar setou pending.
      // Toast cobre erros de fluxo (network down sem fila, 5xx, etc).
      toast.error(apiErrorMessage(err));
    }
  }

  function onCelebracaoContinuar() {
    exec.dismissCelebracao();
    if (todosCompletos) navigate('/aluno/dashboard', { replace: true });
  }

  // Caso edge: exercícios = 0
  if (exec.state.exercicios.length === 0) {
    return (
      <div style={{ background: t.bg, color: t.ink, minHeight: '100%', padding: 24, textAlign: 'center' }}>
        Treino sem exercícios.
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: t.bg,
        color: t.ink,
        fontFamily: t.font,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes wsPulse { 0% { transform: scale(1); opacity: .35 } 100% { transform: scale(2.2); opacity: 0 } }
        @keyframes wsBlink { 50% { opacity: 0 } }
      `}</style>

      <div style={{ flex: 1, overflow: 'auto', paddingTop: 4 }}>
        <Header
          t={t}
          density={density}
          online={exec.online}
          date={formatDate(treino.dataAlvo)}
          title={treino.titulo}
          onBack={() => navigate('/aluno/dashboard')}
        />

        {!exec.online && <OfflineBanner t={t} density={density} queueCount={1} />}
        {exec.state.syncStatus === 'pending-sync' && (
          <SyncBanner t={t} density={density} kind="pending" />
        )}
        {exec.state.syncStatus === 'syncing' && (
          <SyncBanner t={t} density={density} kind="syncing" />
        )}
        {exec.state.syncStatus === 'error' && (
          <SyncBanner t={t} density={density} kind="error" message={exec.state.syncError ?? undefined} />
        )}

        <ProgressStrip t={t} current={exec.exerciciosCompletos} total={exec.state.exercicios.length} density={density} />

        <ExerciseCard
          t={t}
          density={density}
          restTimer={exAtual.descansoSeg ?? 90}
          exerciseIndex={exec.state.currentExercicio + 1}
          exerciseTotal={exec.state.exercicios.length}
          exerciseName={exAtual.nome}
          videoUrl={exAtualPrescrito?.videoUrl ?? null}
          videoDuration="—:—"
          series={`${exAtual.series} × ${exAtual.reps ?? '—'}`}
          cargaAlvo={exAtualPrescrito?.prescrito.cargaKg ? `${exAtualPrescrito.prescrito.cargaKg}kg` : exAtualPrescrito?.prescrito.cargaPctRP ? `${exAtualPrescrito.prescrito.cargaPctRP}%` : '—'}
          pctRP={exAtualPrescrito?.prescrito.cargaPctRP ? `${exAtualPrescrito.prescrito.cargaPctRP}% RP` : ''}
          descansoSeg={exAtual.descansoSeg ?? 90}
        />

        <SetsTableLive
          t={t}
          density={density}
          exercicio={exAtual}
          activeSetIdx={exec.state.currentSet}
          prSetIdxs={prSetIdxs}
        />

        {!exercicioCompleto && (() => {
          const historicoEx = historico[exAtual.nome];
          const cargaSugerida =
            exAtualPrescrito?.prescrito.cargaKg
            ?? historicoEx?.kg
            ?? undefined;
          const repsSugeridas =
            exAtualPrescrito?.prescrito.reps
            ?? historicoEx?.reps
            ?? undefined;
          return (
            <SaveSerieBar
              t={t}
              density={density}
              serieNumero={exec.state.currentSet + 1}
              totalSeries={exAtual.series}
              cargaSugerida={cargaSugerida ?? undefined}
              repsSugeridas={repsSugeridas ?? undefined}
              disabled={exec.state.syncStatus === 'syncing'}
              onSalvar={exec.salvarSerie}
              onPular={exec.pularSerie}
            />
          );
        })()}

        {exercicioCompleto && !todosCompletos && (
          <NextExerciseBar t={t} density={density} onNext={exec.proximoExercicio} />
        )}

        <WorkoutNavBar
          t={t}
          density={density}
          activeIdx={activeIdx}
          total={exec.state.exercicios.length}
          onPrev={() => setActiveIdx(activeIdx - 1)}
          onNext={() => setActiveIdx(activeIdx + 1)}
          onOpenList={() => setListOpen(true)}
        />

        <FinalizeCTA
          t={t}
          density={density}
          ghost={!exec.isFinalizavel}
          onClick={exec.isFinalizavel ? onFinalizar : undefined}
        />
      </div>
      <BottomTabs t={t} />

      <ExerciseListSheet
        t={t}
        density={density}
        open={listOpen}
        exercicios={exec.state.exercicios}
        activeIdx={activeIdx}
        onSelect={(idx) => {
          setActiveIdx(idx);
          setListOpen(false);
        }}
        onClose={() => setListOpen(false)}
      />

      {exec.novosRecordes.length > 0 && (
        <PRCelebration
          t={t}
          message={celebrationMessage(exec.novosRecordes)}
          achievement={celebrationDetail(exec.novosRecordes)}
          onContinue={onCelebracaoContinuar}
          onShare={() => alert('Compartilhamento em breve')}
        />
      )}
    </div>
  );
}

function NextExerciseBar({
  t,
  density,
  onNext,
}: {
  t: ReturnType<typeof getTheme>;
  density: DensityName;
  onNext: () => void;
}) {
  const D = { compact: 12, regular: 16, comfortable: 20 }[density] ?? 16;
  return (
    <div style={{ margin: `0 ${D}px 14px` }}>
      <button
        onClick={onNext}
        style={{
          width: '100%',
          height: 46,
          borderRadius: t.radiusSm,
          background: t.accent,
          border: `0.5px solid ${t.accent}`,
          color: t.accentInk,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Próximo exercício →
      </button>
    </div>
  );
}

function SyncBanner({
  t,
  density,
  kind,
  message,
}: {
  t: ReturnType<typeof getTheme>;
  density: DensityName;
  kind: 'pending' | 'syncing' | 'error';
  message?: string;
}) {
  const D = { compact: 12, regular: 16, comfortable: 20 }[density] ?? 16;
  const config = {
    pending: { bg: t.warnBg, ink: t.warn, label: 'Aguardando conexão para sincronizar' },
    syncing: { bg: t.successBg, ink: t.successInk, label: 'Sincronizando treino...' },
    error: { bg: t.dangerBg, ink: t.danger, label: message ?? 'Erro ao sincronizar' },
  }[kind];

  return (
    <div
      style={{
        margin: `-4px ${D}px 14px`,
        padding: '9px 12px',
        borderRadius: 10,
        background: config.bg,
        color: config.ink,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {config.label}
    </div>
  );
}

function celebrationMessage(novos: { exercicio: string; valor: number; anterior: { valor: number } | null }[]): string {
  if (novos.length === 0) return '';
  const top = novos[0];
  const diff = top.anterior ? top.valor - top.anterior.valor : top.valor;
  return `+${diff}kg em ${top.exercicio}`;
}

function celebrationDetail(novos: { valor: number; reps: number | null; anterior: { valor: number; dataRecorde: string } | null }[]): { atual: string; anterior: string; diasAtras: number } {
  const top = novos[0];
  const atual = `${top.valor}kg${top.reps ? ` × ${top.reps}` : ''}`;
  if (!top.anterior) return { atual, anterior: 'sem registro anterior', diasAtras: 0 };
  const anterior = `${top.anterior.valor}kg${top.reps ? ` × ${top.reps}` : ''}`;
  const dias = Math.max(
    1,
    Math.round((Date.now() - new Date(top.anterior.dataRecorde).getTime()) / (1000 * 60 * 60 * 24)),
  );
  return { atual, anterior, diasAtras: dias };
}
