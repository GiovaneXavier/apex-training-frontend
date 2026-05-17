import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AlunoTabs } from '@/components/AlunoTabs';
import { Button } from '@/components/ui/button';
import { WeeklyTimeline } from '@/components/aluno/WeeklyTimeline';
import { inicioSemana, key as dayKey, comHoraAtual } from '@/lib/dates';
import { WorkoutDayCard, RestDayCard } from '@/components/aluno/WorkoutDayCard';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage, isCancelError } from '@/lib/api';
import { listTreinos } from '@/lib/api/treinos';
import { iniciarTreinoDeRotina, listRotinas, type DiaSemana, type Rotina } from '@/lib/api/rotinas';
import { listProvas } from '@/lib/api/provas';
import { ProximaProvaWidget } from '@/components/aluno/ProximaProvaWidget';
import {
  buildStravaAuthUrl, getStravaStatus, syncStrava,
  type StravaStatus,
} from '@/lib/api/strava';
import type { Treino, Prova } from '@/types/treino';

const DIA_SEMANA_INDEX: Record<DiaSemana, number> = {
  DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6,
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function AlunoDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Janela: semana corrente (SEG → DOM)
  const [semanaInicio, setSemanaInicio] = useState(() => inicioSemana(new Date()));
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date());

  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [strava, setStrava] = useState<StravaStatus | null>(null);
  // PR #21 — próxima prova alvo (countdown). Fetch fora do Promise.all
  // principal pra falha de prova não derrubar treinos/rotinas.
  const [proximaProva, setProximaProva] = useState<Prova | null>(null);
  const [loading, setLoading] = useState(true);
  // Feedbacks transientes (erros de sync, msgs de sucesso) agora via Sonner.
  // `loadError` mantido só pra erro de carregamento da página (banner inline).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [iniciandoId, setIniciandoId] = useState<string | null>(null);

  const semanaFim = useMemo(() => {
    const f = new Date(semanaInicio);
    f.setDate(f.getDate() + 7);
    return f;
  }, [semanaInicio]);

  // Busca treinos da semana + todas as rotinas do aluno (para projetar).
  // PR #15: aceita AbortSignal pra useEffect cleanup cancelar fetches
  // pendentes quando o aluno troca de semana ou navega pra outra rota.
  async function carregar(signal?: AbortSignal) {
    if (!user?.aluno?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [t, r, s] = await Promise.all([
        listTreinos(
          user.aluno.id,
          {
            desde: semanaInicio.toISOString(),
            ate: semanaFim.toISOString(),
            limit: 100,
          },
          { signal },
        ),
        listRotinas({ alunoId: user.aluno.id }, { signal }).catch((e) => {
          if (isCancelError(e)) throw e; // re-throw cancel pro outer catch
          return [];
        }),
        getStravaStatus({ signal }).catch((e) => {
          if (isCancelError(e)) throw e;
          return null;
        }),
      ]);
      setTreinos(t);
      setRotinas(r);
      if (s) setStrava(s);

      // PR #21 — próxima prova alvo. Fetch isolado pra não bloquear
      // o resto se /provas falhar; provas é feature secundária.
      // `desde=agora` filtra só provas futuras; `limit=1` é suficiente
      // pro widget (próxima é o que importa).
      const agora = new Date().toISOString();
      listProvas(user.aluno.id, { desde: agora, limit: 1 })
        .then((provas) => setProximaProva(provas[0] ?? null))
        .catch(() => {
          // silencioso — widget mostra estado vazio
        });
    } catch (err) {
      // Erro de cancel não é falha real — usuário trocou de tela.
      if (isCancelError(err)) return;
      setLoadError(apiErrorMessage(err));
    } finally {
      // Cancelado: o componente está sendo desmontado (ou refetch novo
      // já começou). Não toca em loading pra evitar flash.
      if (!signal?.aborted) setLoading(false);
    }
  }

  // PR #15 (audit 5.17) — cleanup aborta o fetch em curso. Trocar de
  // semana, mudar de rota ou rerender desencadeia abort imediato; o
  // novo render dispara a fetch nova com signal fresco.
  useEffect(() => {
    const ctrl = new AbortController();
    void carregar(ctrl.signal);
    return () => ctrl.abort();
    /* eslint-disable-next-line */
  }, [user?.aluno?.id, semanaInicio.getTime()]);

  // ─── Mapas para a fita + feed ────────────────────────────────
  const treinosByDay = useMemo(() => {
    const map = new Map<string, Treino[]>();
    for (const t of treinos) {
      const k = dayKey(new Date(t.dataAlvo));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [treinos]);

  const rotinasByDay = useMemo(() => {
    const map = new Map<string, Rotina[]>();
    if (rotinas.length === 0) return map;
    // Para cada dia da semana visível, projeta rotinas vigentes daquele dia
    for (let i = 0; i < 7; i++) {
      const d = new Date(semanaInicio);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const ativas = rotinas.filter((r) => {
        if (DIA_SEMANA_INDEX[r.diaSemana] !== dow) return false;
        const ini = new Date(r.vigenciaInicio); ini.setHours(0, 0, 0, 0);
        if (d < ini) return false;
        if (r.vigenciaFim) {
          const fim = new Date(r.vigenciaFim); fim.setHours(23, 59, 59, 999);
          if (d > fim) return false;
        }
        return true;
      });
      if (ativas.length > 0) map.set(dayKey(d), ativas);
    }
    return map;
  }, [rotinas, semanaInicio]);

  const diasComEventos = useMemo(() => {
    const s = new Set<string>();
    for (const k of treinosByDay.keys()) s.add(k);
    for (const k of rotinasByDay.keys()) s.add(k);
    return s;
  }, [treinosByDay, rotinasByDay]);

  const selKey = dayKey(diaSelecionado);
  const treinosDoDia = treinosByDay.get(selKey) ?? [];
  // Rotina projetada só conta se ainda não há treino instanciado no dia
  const rotinasDoDia = treinosDoDia.length > 0 ? [] : rotinasByDay.get(selKey) ?? [];
  const isDescanso = treinosDoDia.length === 0 && rotinasDoDia.length === 0;

  // ─── Ações ─────────────────────────────────────────────────
  async function onSync() {
    if (!strava?.connected) {
      try {
        window.location.href = buildStravaAuthUrl();
      } catch (err) {
        console.error('[Strava] falha ao montar URL OAuth:', err);
        toast.error(apiErrorMessage(err));
      }
      return;
    }
    setSyncing(true);
    try {
      const r = await syncStrava();
      const msg = r.novas === 0
        ? 'Nenhuma atividade nova'
        : `${r.novas} ${r.novas === 1 ? 'nova atividade' : 'novas atividades'} sincronizadas`;
      toast.success(msg);
      await carregar();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  async function onIniciarRotina(rotina: Rotina) {
    setIniciandoId(rotina.id);
    try {
      // PR #14 — hora real do dispositivo, não 7AM hardcoded. Mantém a
      // DATA selecionada (atleta pode estar revisando ontem ou pré-
      // agendando amanhã) mas grava a hora atual. Backend valida janela.
      const dataAlvo = comHoraAtual(diaSelecionado);
      const treino = await iniciarTreinoDeRotina(rotina.id, dataAlvo.toISOString());
      navigate(`/aluno/treino/${treino.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setIniciandoId(null);
    }
  }

  function navegarSemana(delta: number) {
    const next = new Date(semanaInicio);
    next.setDate(next.getDate() + delta * 7);
    setSemanaInicio(next);
    // mantém o dia selecionado se ainda na nova janela; senão, vai pra primeira segunda
    if (delta !== 0) setDiaSelecionado(next);
  }

  const primeiroNome = user?.nome.split(' ')[0] ?? 'atleta';

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="px-5 pt-7 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
            {MESES[diaSelecionado.getMonth()]} · semana
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight truncate">
            Olá, {primeiroNome}
          </h1>
        </div>

        <Button
          variant="coral"
          size="icon"
          onClick={onSync}
          disabled={syncing || strava === null}
          aria-label={strava?.connected ? 'Sincronizar Strava' : 'Conectar Strava'}
          className={syncing ? 'animate-pulse' : ''}
        >
          <IconRefresh spinning={syncing} />
        </Button>
      </header>

      {/* Erro de carregamento INICIAL fica inline — sem dados, toast some rápido demais. */}
      {loadError && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[11.5px] font-medium">
          {loadError}
        </div>
      )}

      {/* PR #21 — countdown da prova alvo. Posicionado imediatamente
          após o header pra ser o primeiro elemento visual abaixo do
          nome. Sem alvo cadastrado, mostra CTA discreto. */}
      <ProximaProvaWidget
        prova={proximaProva}
        onCriada={(p) => setProximaProva(p)}
      />


      {/* ── Navegação de semana ─────────────────────────────────── */}
      <div className="px-5 flex items-center justify-between mb-1">
        <button
          onClick={() => navegarSemana(-1)}
          className="size-8 rounded-full bg-surface border border-app-strong text-ink flex items-center justify-center font-bold text-[14px]"
          aria-label="Semana anterior"
        >
          ‹
        </button>
        <span className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold">
          {fmtIntervaloSemana(semanaInicio)}
        </span>
        <button
          onClick={() => navegarSemana(1)}
          className="size-8 rounded-full bg-surface border border-app-strong text-ink flex items-center justify-center font-bold text-[14px]"
          aria-label="Próxima semana"
        >
          ›
        </button>
      </div>

      {/* ── Fita horizontal ─────────────────────────────────────── */}
      <div className="px-5 mb-3">
        <WeeklyTimeline
          startDate={semanaInicio}
          selected={diaSelecionado}
          onSelect={setDiaSelecionado}
          diasComEventos={diasComEventos}
        />
      </div>

      {/* ── Feed do dia ────────────────────────────────────────── */}
      <main className="px-5 max-w-2xl mx-auto">
        <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-3 text-mono">
          {labelDia(diaSelecionado)}
        </h2>

        {loading ? (
          <div className="rounded-2xl bg-surface border border-app px-4 py-6 text-ink-subtle text-[13px] text-center">
            Carregando…
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {treinosDoDia.map((t) => (
              <WorkoutDayCard
                key={t.id}
                treino={t}
                subtituloOverride={subtituloDaRotina(t, rotinas)}
              />
            ))}

            {rotinasDoDia.map((r) => (
              <RotinaCard
                key={r.id}
                rotina={r}
                loading={iniciandoId === r.id}
                onIniciar={() => onIniciarRotina(r)}
              />
            ))}

            {isDescanso && <RestDayCard />}
          </div>
        )}

        {/* Atalho para evolução corporal */}
        <Link
          to="/aluno/progresso"
          className="mt-5 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-surface border border-app hover:border-ink-muted transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="size-9 rounded-2xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <IconChart />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold tracking-tight">Ver progresso</div>
              <div className="text-[11px] text-ink-subtle">Desempenho atlético + evolução física</div>
            </div>
          </div>
          <span className="text-ink-muted">→</span>
        </Link>
      </main>

      <AlunoTabs />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────
function RotinaCard({
  rotina, onIniciar, loading,
}: { rotina: Rotina; onIniciar: () => void; loading: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border-0 shadow-[0_2px_18px_-10px_rgba(0,0,0,0.18)] bg-surface p-4 pl-5"
    >
      <span
        className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
        style={{ backgroundColor: '#7BC79E' }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0 flex-1">
          <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
            Rotina semanal · {rotina.exercicios.length} exer.
          </div>
          <h3 className="text-[16px] font-bold text-ink leading-tight tracking-tight truncate">
            {rotina.nome}
          </h3>
        </div>
      </div>
      <button
        type="button"
        onClick={onIniciar}
        disabled={loading}
        className="mt-3 inline-flex items-center justify-center h-9 px-4 rounded-2xl text-white text-[12px] font-bold disabled:opacity-50"
        style={{ backgroundColor: '#fc4c02' }}
      >
        {loading ? 'Iniciando…' : 'Iniciar treino →'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmtIntervaloSemana(seg: Date): string {
  const dom = new Date(seg);
  dom.setDate(dom.getDate() + 6);
  const segStr = `${seg.getDate().toString().padStart(2, '0')}/${(seg.getMonth() + 1).toString().padStart(2, '0')}`;
  const domStr = `${dom.getDate().toString().padStart(2, '0')}/${(dom.getMonth() + 1).toString().padStart(2, '0')}`;
  return `${segStr} → ${domStr}`;
}

function labelDia(d: Date): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const sel = new Date(d);
  sel.setHours(0, 0, 0, 0);
  const diff = Math.round((sel.getTime() - hoje.getTime()) / 86400000);
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return `${dias[d.getDay()]} · ${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function subtituloDaRotina(t: Treino, rotinas: Rotina[]): string | undefined {
  if (t.detalhes.tipo !== 'musculacao') return undefined;
  const r = rotinas.find((x) => x.id === (t.detalhes as { rotinaId?: string }).rotinaId
    || x.id === (t as { rotinaId?: string }).rotinaId);
  return r ? `Rotina · ${r.nome.replace(/\s*—.*$/, '')}` : undefined;
}

// ─────────────────────────────────────────────────────────────
// Ícones
// ─────────────────────────────────────────────────────────────
function IconRefresh({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
    </svg>
  );
}
