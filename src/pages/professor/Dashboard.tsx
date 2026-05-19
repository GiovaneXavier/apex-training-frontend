import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getDashboard,
  listAlertasProf,
  type Alerta,
  type AlertaSeveridade,
  type AlertaTipo,
  type ProfessorDashboard,
} from '@/lib/api/professor';
import { apiErrorMessage, isCancelError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CoachBriefingCard } from '@/components/professor/CoachBriefingCard';

export default function ProfDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [stats, setStats] = useState<ProfessorDashboard | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PR #15 padronizado — AbortController no cleanup. Dashboard +
  // alertas em paralelo: o painel pinta as duas seções
  // independentemente, sem esperar um do outro.
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.allSettled([
      getDashboard({ signal: ctrl.signal }).then(
        (s) => setStats(s),
        (err) => { if (!isCancelError(err)) setError(apiErrorMessage(err)); },
      ),
      listAlertasProf({ signal: ctrl.signal }).then(
        (a) => setAlertas(a),
        (err) => { if (!isCancelError(err)) setError(apiErrorMessage(err)); },
      ).finally(() => { if (!ctrl.signal.aborted) setLoadingAlertas(false); }),
    ]);
    return () => ctrl.abort();
  }, []);

  const primeiroNome = user?.nome.split(' ')[0] ?? 'Professor';

  return (
    <div className="min-h-screen bg-bg text-ink pb-20">
      <header className="px-5 pt-7 pb-5 flex items-start justify-between">
        <div>
          <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
            {formatDate(new Date().toISOString())}
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">Olá, {primeiroNome}</h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={toggle}
            className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-app-strong text-ink-muted"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button onClick={logout} className="text-[10px] uppercase tracking-wider text-ink-subtle font-semibold">
            Sair
          </button>
        </div>
      </header>

      <section className="px-5">
        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <StatCard label="Alunos" value={stats?.totalAlunos} />
          <StatCard label="Pendentes na semana" value={stats?.pendentesSemana} accent />
          <StatCard label="Concluídos na semana" value={stats?.concluidosSemana} />
          <StatCard label="Total prescritos" value={stats?.treinosPrescritos} />
        </div>

        {/* PR #28 — Coach Briefing Semanal (IA). Topo da hierarquia visual
            depois das stats secas — síntese deve preceder a lista crua de
            alertas (que continua disponível abaixo). */}
        <div className="mb-4">
          <CoachBriefingCard />
        </div>

        {/* PR #17 — Radar de aderência. Aparece acima das ações pra ser
            a primeira coisa que o prof vê ao abrir o painel. */}
        <AlertasSection alertas={alertas} loading={loadingAlertas} />

        <div className="flex flex-col gap-2.5">
          <Link to="/professor/alunos" className="action-card">
            <span className="text-2xl">👥</span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold tracking-tight">Meus alunos</span>
              <span className="block text-[11.5px] text-ink-muted">Gerenciar vínculos e ver progresso</span>
            </span>
            <span className="text-ink-muted">→</span>
          </Link>
          <Link to="/professor/prescrever" className="action-card">
            <span className="text-2xl">📝</span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold tracking-tight">Prescrever treino</span>
              <span className="block text-[11.5px] text-ink-muted">Multi-sports com vídeo e %RP</span>
            </span>
            <span className="text-ink-muted">→</span>
          </Link>
          <Link to="/professor/calendario" className="action-card">
            <span className="text-2xl">📅</span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold tracking-tight">Calendário</span>
              <span className="block text-[11.5px] text-ink-muted">Agenda mensal de todos os alunos</span>
            </span>
            <span className="text-ink-muted">→</span>
          </Link>
          <Link to="/professor/rotina/nova" className="action-card">
            <span className="text-2xl">🗓️</span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold tracking-tight">Nova rotina</span>
              <span className="block text-[11.5px] text-ink-muted">Treino semanal de musculação por aluno</span>
            </span>
            <span className="text-ink-muted">→</span>
          </Link>
          <Link to="/professor/exercicios" className="action-card">
            <span className="text-2xl">🏋️</span>
            <span className="flex-1">
              <span className="block text-[14px] font-bold tracking-tight">Catálogo de exercícios</span>
              <span className="block text-[11.5px] text-ink-muted">Biblioteca compartilhada</span>
            </span>
            <span className="text-ink-muted">→</span>
          </Link>
        </div>
      </section>

      <style>{`
        .action-card {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: 14px;
          background: rgb(var(--surface)); border: 1px solid rgba(var(--border), 0.08);
          color: rgb(var(--ink));
          transition: border-color 0.15s ease;
        }
        .action-card:hover { border-color: rgba(var(--ink), 0.4); }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Alertas de aderência (PR #17)
//
// O agrupamento por severidade reflete a regra do produto: high vai pro
// topo do painel pra ser visto primeiro. Limitamos a exibição (5 por
// grupo + "ver mais") pra evitar painel infinito quando o coach tem
// muitos alunos. Deep-link no card leva pro detalhe do aluno —
// caminho natural pra ação (mandar áudio, reagendar treino).
// ─────────────────────────────────────────────────────────────────────

const SEVERIDADE_BORDER: Record<AlertaSeveridade, string> = {
  high: 'border-l-danger',
  medium: 'border-l-warn',
  low: 'border-l-ink-subtle',
};

const TIPO_LABEL: Record<AlertaTipo, string> = {
  INACTIVE_7D: 'Inativo',
  MISSED_WORKOUT: 'Faltou',
  STREAK_BROKEN: 'Streak',
  MODALIDADE_GAP: 'Gap',
};

function AlertasSection({ alertas, loading }: { alertas: Alerta[]; loading: boolean }) {
  const [verMais, setVerMais] = useState(false);

  if (loading) {
    return (
      <div className="mb-5 px-4 py-5 rounded-[14px] bg-surface border border-app text-ink-subtle text-[12px] text-center">
        Carregando radar de aderência…
      </div>
    );
  }
  if (alertas.length === 0) {
    return (
      <div className="mb-5 px-4 py-4 rounded-[14px] bg-surface border border-app text-ink-subtle text-[12.5px] text-center">
        Tudo em ordem — nenhum alerta nos alunos agora ✓
      </div>
    );
  }

  const LIMITE = 5;
  const visiveis = verMais ? alertas : alertas.slice(0, LIMITE);
  const restantes = alertas.length - visiveis.length;

  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono">
          Radar de aderência ({alertas.length})
        </h2>
      </div>
      <div className="flex flex-col gap-1.5">
        {visiveis.map((a, i) => (
          <Link
            key={`${a.alunoId}-${a.tipo}-${a.treinoId ?? i}`}
            to={`/professor/aluno/${a.alunoId}`}
            className={
              'flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] ' +
              'bg-surface border border-app border-l-2 ' +
              SEVERIDADE_BORDER[a.severidade]
            }
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{a.alunoNome}</div>
              <div className="text-[11.5px] text-ink-muted truncate">{a.detalhe}</div>
            </div>
            <span className="text-mono text-[9px] uppercase tracking-[0.6px] font-bold text-ink-subtle flex-shrink-0">
              {TIPO_LABEL[a.tipo]}
            </span>
          </Link>
        ))}
        {restantes > 0 && (
          <button
            type="button"
            onClick={() => setVerMais(true)}
            className="text-[11px] uppercase tracking-wider font-bold text-accent text-center py-2"
          >
            + {restantes} alerta{restantes > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | undefined; accent?: boolean }) {
  return (
    <div
      className={`p-4 rounded-[14px] ${accent ? 'bg-ink text-bg' : 'bg-surface border border-app text-ink'}`}
    >
      <div className={`text-[10px] uppercase tracking-[0.6px] font-bold mb-1.5 text-mono ${accent ? 'opacity-70' : 'text-ink-subtle'}`}>
        {label}
      </div>
      <div className="text-mono text-[28px] font-bold tabular leading-none tracking-tight">
        {value ?? '—'}
      </div>
    </div>
  );
}
