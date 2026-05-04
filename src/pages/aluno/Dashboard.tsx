import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AlunoTabs } from '@/components/AlunoTabs';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { listTreinos } from '@/lib/api/treinos';
import { apiErrorMessage } from '@/lib/api';
import { buildStravaAuthUrl, getStravaStatus, syncStrava, type StravaStatus } from '@/lib/api/strava';
import { formatDate, relativeDay } from '@/lib/format';
import { MODALIDADE_LABEL, STATUS_LABEL, type Treino } from '@/types/treino';
import { cn } from '@/lib/utils';

export default function AlunoDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [treinos, setTreinos] = useState<Treino[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strava, setStrava] = useState<StravaStatus | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user?.aluno?.id) return;
    let cancelled = false;
    Promise.all([
      listTreinos(user.aluno.id, { status: 'PENDENTE', limit: 20 }),
      getStravaStatus().catch(() => null),
    ])
      .then(([t, s]) => {
        if (cancelled) return;
        setTreinos(t);
        if (s) setStrava(s);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => { cancelled = true; };
  }, [user?.aluno?.id]);

  async function onSyncStrava() {
    setError(null);
    setInfo(null);
    if (!strava?.connected) {
      window.location.href = buildStravaAuthUrl();
      return;
    }
    setSyncing(true);
    try {
      const r = await syncStrava();
      setInfo(`${r.novas} ${r.novas === 1 ? 'nova atividade' : 'novas atividades'} sincronizadas`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  const proximo = treinos?.[0];
  const restantes = treinos?.slice(1) ?? [];
  const primeiroNome = user?.nome.split(' ')[0] ?? 'atleta';

  return (
    <div className="min-h-screen bg-bg text-ink pb-20">
      <header className="px-5 pt-7 pb-5 flex items-start justify-between">
        <div>
          <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
            {formatDate(new Date().toISOString())}
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">Bom treino, {primeiroNome}</h1>
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
        <button
          onClick={onSyncStrava}
          disabled={syncing || strava === null}
          className="w-full mb-1.5 h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[13px] tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <span>⚡</span>
          {strava === null
            ? 'Carregando Strava...'
            : syncing
            ? 'Sincronizando...'
            : strava.connected
            ? 'Sincronizar com Strava'
            : 'Conectar Strava'}
          {strava?.connected && (
            <span className="size-1.5 rounded-full bg-bg/70" />
          )}
        </button>
        {strava?.connected ? (
          <div className="mb-3 text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono">
            Conectado{strava.stravaUserId ? ` · ID ${strava.stravaUserId}` : ''}
          </div>
        ) : strava && !strava.connected ? (
          <div className="mb-3 text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono">
            Não conectado · clique para autorizar no Strava
          </div>
        ) : (
          <div className="mb-3 h-3" />
        )}
        {info && (
          <div className="mb-3 px-3 py-2 rounded-[10px] bg-success-bg text-success-ink text-[11.5px] font-medium">{info}</div>
        )}

        <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-3 text-mono">
          Próximo treino
        </h2>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        {treinos === null && !error && (
          <div className="px-4 py-6 rounded-[16px] bg-surface border border-app text-ink-subtle text-[13px]">
            Carregando treinos...
          </div>
        )}

        {treinos !== null && treinos.length === 0 && (
          <div className="px-4 py-8 rounded-[16px] bg-surface border border-app text-center">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-[14px] font-semibold text-ink">Nenhum treino pendente</div>
            <div className="text-[12px] text-ink-muted mt-1">
              Aguarde uma nova prescrição do seu professor.
            </div>
          </div>
        )}

        {proximo && <ProximoCard treino={proximo} />}

        {restantes.length > 0 && (
          <>
            <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-2 mt-6 text-mono">
              Próximos
            </h2>
            <div className="flex flex-col gap-2">
              {restantes.map((t) => <TreinoRow key={t.id} treino={t} />)}
            </div>
          </>
        )}
      </section>

      <AlunoTabs />
    </div>
  );
}

function ProximoCard({ treino }: { treino: Treino }) {
  return (
    <Link
      to={`/aluno/treino/${treino.id}`}
      className="block rounded-[20px] bg-ink text-bg p-5 mb-2 shadow-card hover:opacity-95 transition-opacity"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold opacity-70">
          {MODALIDADE_LABEL[treino.modalidade]}
        </span>
        <span className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold px-2 py-0.5 rounded-full bg-accent text-accent-ink">
          {relativeDay(treino.dataAlvo)}
        </span>
      </div>
      <div className="text-[22px] font-bold tracking-tight leading-tight mb-4">{treino.titulo}</div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] opacity-75">{summarizeDetalhes(treino)}</span>
        <span className="text-[13px] font-bold flex items-center gap-1">
          Iniciar →
        </span>
      </div>
    </Link>
  );
}

function TreinoRow({ treino }: { treino: Treino }) {
  return (
    <Link
      to={`/aluno/treino/${treino.id}`}
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-[14px]',
        'bg-surface border border-app hover:border-ink-muted transition-colors',
      )}
    >
      <div className="min-w-0">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
          {relativeDay(treino.dataAlvo)} · {MODALIDADE_LABEL[treino.modalidade]}
        </div>
        <div className="text-[14px] font-semibold tracking-tight truncate">{treino.titulo}</div>
      </div>
      <div className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold flex-shrink-0 ml-3">
        {STATUS_LABEL[treino.status]}
      </div>
    </Link>
  );
}

function summarizeDetalhes(treino: Treino): string {
  const d = treino.detalhes;
  switch (d.tipo) {
    case 'musculacao': return `${d.exercicios.length} exercícios`;
    case 'corrida': return `${d.distanciaKm}km${d.ritmoAlvoMinKm ? ` · ${d.ritmoAlvoMinKm}/km` : ''}`;
    case 'ciclismo': return `${d.distanciaKm}km`;
    case 'natacao': return `${d.series.length} séries`;
    case 'triathlon': return `${d.blocos.length} blocos`;
    case 'outro': return d.descricao.slice(0, 60);
  }
}
