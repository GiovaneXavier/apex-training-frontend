import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDashboard, type ProfessorDashboard } from '@/lib/api/professor';
import { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function ProfDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [stats, setStats] = useState<ProfessorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDashboard()
      .then((s) => !cancelled && setStats(s))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => { cancelled = true; };
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
