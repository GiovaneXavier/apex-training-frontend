import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AlunoTabs } from '@/components/AlunoTabs';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiErrorMessage } from '@/lib/api';
import {
  aceitarNutri,
  listMinhasNutris,
  listMeusProfessores,
  recusarNutri,
  type VinculoNutricionistaItem,
  type VinculoProfessorItem,
} from '@/lib/api/alunoVinculos';
import { getPlanoAtual, type PlanoAlimentar } from '@/lib/api/planos';
import { FaixaProgresso } from '@/components/aluno/FaixaProgresso';
import {
  buildStravaAuthUrl,
  disconnectStrava,
  getStravaStatus,
  listAtividadesStrava,
  syncStrava,
  type AtividadeStrava,
  type StravaStatus,
  type SyncResult,
} from '@/lib/api/strava';
import { formatDate, relativeDay } from '@/lib/format';

export default function AlunoPerfil() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [params] = useSearchParams();
  const [nutris, setNutris] = useState<VinculoNutricionistaItem[]>([]);
  const [profs, setProfs] = useState<VinculoProfessorItem[]>([]);
  const [strava, setStrava] = useState<StravaStatus | null>(null);
  const [planoAlimentar, setPlanoAlimentar] = useState<PlanoAlimentar | null>(null);
  const [atividades, setAtividades] = useState<AtividadeStrava[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState<'idle' | 'sync' | 'disconnect'>('idle');

  async function refresh() {
    try {
      const alunoId = user?.aluno?.id;
      // PR #18b — plano alimentar via getPlanoAtual quando há alunoId.
      // Fora do Promise.all principal pra falha de plano não derrubar os
      // outros (uso de .catch local — plano é opcional).
      const [n, p, s] = await Promise.all([
        listMinhasNutris(),
        listMeusProfessores(),
        getStravaStatus(),
      ]);
      setNutris(n);
      setProfs(p);
      setStrava(s);
      if (s.connected && alunoId) {
        const ats = await listAtividadesStrava(alunoId, 10);
        setAtividades(ats);
      } else {
        setAtividades([]);
      }
      if (alunoId) {
        getPlanoAtual(alunoId).then(setPlanoAlimentar).catch(() => setPlanoAlimentar(null));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.aluno?.id]);

  // Callback do redirect OAuth Strava ecoa `?strava=ok|error` no query param.
  useEffect(() => {
    const flag = params.get('strava');
    if (flag === 'ok') toast.success('Strava conectado com sucesso!');
    else if (flag === 'error') toast.error('Falha ao conectar Strava');
  }, [params]);

  async function onAceitar(id: string) {
    try {
      await aceitarNutri(id);
      await refresh();
      toast.success('Nutricionista aceito');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }
  async function onRecusar(id: string) {
    if (!confirm('Recusar/remover este nutricionista?')) return;
    try {
      await recusarNutri(id);
      await refresh();
      toast.success('Nutricionista removido');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function onConectarStrava() {
    try {
      window.location.href = buildStravaAuthUrl();
    } catch (err) {
      // Erro síncrono típico aqui: VITE_STRAVA_CLIENT_ID ausente no .env.
      console.error('[Strava] falha ao montar URL OAuth:', err);
      toast.error(apiErrorMessage(err));
    }
  }

  async function onSincronizar() {
    setBusy('sync');
    try {
      const r = await syncStrava();
      setSyncResult(r);
      const msg = r.novas === 0
        ? `Nenhuma atividade nova · ${r.total} verificadas`
        : `${r.novas} ${r.novas === 1 ? 'nova atividade' : 'novas atividades'} · ${r.total} verificadas`;
      toast.success(msg);
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy('idle');
    }
  }

  async function onDesconectar() {
    if (!confirm('Desconectar do Strava? Seus tokens serão apagados.')) return;
    setBusy('disconnect');
    try {
      await disconnectStrava();
      await refresh();
      toast.success('Strava desconectado');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy('idle');
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
        <button
          onClick={toggle}
          className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-app-strong text-ink-muted"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <div className="px-5">
        <div className="flex items-center gap-4 mb-6">
          <div className="size-16 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-[26px]">
            {user?.nome.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">{user?.nome}</h1>
            <div className="text-[12px] text-ink-muted">{user?.email}</div>
          </div>
        </div>

        {/* PR #24 — Jornada do Faixa Preta (BJJ). Aparece sempre;
            componente cuida do empty state. Posicionado antes do
            plano alimentar porque é uma seção mais densa visualmente
            (faixa + barra + métricas) — fluxo de leitura natural. */}
        <div className="mb-6">
          <FaixaProgresso />
        </div>

        {/* PR #18b — plano alimentar vigente. Card discreto: aparece
            só quando há plano ativo. Ausência intencional de empty
            state pra não criar ansiedade no aluno que ainda não tem
            nutri vinculado. */}
        {planoAlimentar && (
          <div className="mb-6 p-4 rounded-[14px] bg-accent text-accent-ink">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-mono opacity-80">
                Plano alimentar · {relativeDay(planoAlimentar.criadoEm)}
              </div>
              <a
                href={planoAlimentar.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] uppercase tracking-wider font-bold"
              >
                Baixar PDF ↗
              </a>
            </div>
            {planoAlimentar.metasText && (
              <div className="text-[13px] whitespace-pre-wrap">{planoAlimentar.metasText}</div>
            )}
          </div>
        )}

        <Section title="Nutricionistas" subtitle="Aceite o convite para compartilhar sua rotina.">
          {nutris.length === 0 ? (
            <Empty msg="Nenhum nutricionista vinculado" />
          ) : (
            <div className="flex flex-col gap-2">
              {nutris.map((n) => (
                <div key={n.vinculoId} className="px-3 py-3 rounded-[14px] bg-surface border border-app">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="size-9 rounded-full bg-success-bg text-success-ink flex items-center justify-center font-bold text-[13px]">
                      {n.nome.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold truncate">{n.nome}</div>
                      <div className="text-[11px] text-ink-muted truncate">{n.email}{n.crn ? ` · ${n.crn}` : ''}</div>
                    </div>
                    <span
                      className={`text-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                        n.aceito ? 'bg-success-bg text-success-ink' : 'bg-warn-bg text-warn'
                      }`}
                    >
                      {n.aceito ? 'aceito' : 'pendente'}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-ink-subtle font-mono uppercase tracking-wider mb-2">
                    Solicitado {relativeDay(n.desde)}
                  </div>
                  <div className="flex gap-2">
                    {!n.aceito && (
                      <button
                        onClick={() => onAceitar(n.vinculoId)}
                        className="flex-1 h-9 rounded-[10px] bg-accent text-accent-ink font-bold text-[12px]"
                      >
                        Aceitar
                      </button>
                    )}
                    <button
                      onClick={() => onRecusar(n.vinculoId)}
                      className={`h-9 rounded-[10px] text-[12px] font-bold uppercase tracking-wider ${
                        n.aceito ? 'flex-1 bg-surface-muted text-ink-muted' : 'px-4 bg-surface-muted text-danger'
                      }`}
                    >
                      {n.aceito ? 'Remover' : 'Recusar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Professores" subtitle="Quem prescreve seus treinos.">
          {profs.length === 0 ? (
            <Empty msg="Nenhum professor vinculado" />
          ) : (
            <div className="flex flex-col gap-2">
              {profs.map((p) => (
                <div key={p.vinculoId} className="px-3 py-3 rounded-[14px] bg-surface border border-app flex items-center gap-3">
                  <div className="size-9 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-[13px]">
                    {p.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold truncate">{p.nome}</div>
                    <div className="text-[11px] text-ink-muted truncate">{p.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Conexões" subtitle="Sincronize com plataformas externas.">
          <div className="px-3 py-3 rounded-[14px] bg-surface border border-app">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[13.5px] font-semibold flex items-center gap-1.5">
                  <span className="text-orange-500">⚡</span> Strava
                </div>
                {strava?.connected ? (
                  <div className="text-[11px] text-ink-muted">
                    Conectado{strava.stravaUserId ? ` · ID ${strava.stravaUserId}` : ''}
                  </div>
                ) : (
                  <div className="text-[11px] text-ink-muted">Não conectado</div>
                )}
              </div>
              <span
                className={`text-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  strava?.connected ? 'bg-success-bg text-success-ink' : 'bg-surface-muted text-ink-subtle'
                }`}
              >
                {strava?.connected ? 'ativo' : 'desconectado'}
              </span>
            </div>

            {strava?.connected ? (
              <div className="flex gap-2">
                <button
                  onClick={onSincronizar}
                  disabled={busy === 'sync'}
                  className="flex-1 h-10 rounded-[10px] bg-accent text-accent-ink font-bold text-[12px] disabled:opacity-50"
                >
                  {busy === 'sync' ? 'Sincronizando...' : 'Sincronizar agora'}
                </button>
                <button
                  onClick={onDesconectar}
                  disabled={busy === 'disconnect'}
                  className="h-10 px-4 rounded-[10px] bg-surface-muted text-danger text-[12px] font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <button
                onClick={onConectarStrava}
                className="w-full h-10 rounded-[10px] bg-accent text-accent-ink font-bold text-[12px]"
              >
                Conectar Strava
              </button>
            )}

            {syncResult && (
              <div className="text-[11px] text-ink-muted mt-2 text-mono uppercase tracking-wider">
                Última sync: {formatDate(syncResult.sincronizadoEm)} · {syncResult.novas} novas
              </div>
            )}
          </div>

          {strava?.connected && atividades.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono mb-2">
                Últimas atividades
              </div>
              <div className="flex flex-col gap-1.5">
                {atividades.map((a) => (
                  <div key={a.id} className="px-3 py-2.5 rounded-[12px] bg-surface border border-app flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold tracking-tight truncate">{a.nome}</div>
                      <div className="text-mono text-[10px] uppercase text-ink-subtle font-bold tracking-wider">
                        {a.tipo} · {relativeDay(a.iniciadoEm)}
                      </div>
                    </div>
                    <div className="text-mono text-[12px] tabular text-ink font-bold flex-shrink-0">
                      {(a.distanciaM / 1000).toFixed(1)}km
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <button
          onClick={logout}
          className="w-full mt-2 h-12 rounded-[12px] border border-app-strong text-danger font-bold text-[13px]"
        >
          Sair
        </button>
      </div>

      <AlunoTabs />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono mb-1">{title}</h2>
      {subtitle && <p className="text-[12px] text-ink-muted mb-3">{subtitle}</p>}
      {!subtitle && <div className="h-2" />}
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-4 rounded-[12px] bg-surface border border-app text-ink-subtle text-[13px] text-center">
      {msg}
    </div>
  );
}
