import { useAuth } from '@/contexts/AuthContext';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import type { AdminMetrics } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

// PR #42 (Sprint 16 — Bloco A) — Cockpit do Admin · Fase 1.
//
// Métricas globais consumidas de GET /api/admin/metrics. Substitui o
// placeholder do PR #41c-hotfix.
//
// Layout: grupos visuais espelham o shape do payload:
//   - Usuários (total/ativos + porRole + pendentes)
//   - Treinos (semana + adesão + histórico)
//   - Alertas (alunos órfãos / sem atividade / sem alvo)
//
// Estados:
//   - loading (sem dados ainda) → skeleton de cards
//   - error sem dados anteriores → banner inline + retry
//   - data + erro de refresh → mantém último snapshot bom + chip de erro
//     no header. Operação de admin não pode flashar pra branco.

export default function AdminCockpit() {
  const { user, logout } = useAuth();
  const { metrics, loading, refreshing, error, refresh } = useAdminMetrics();
  const nome = user?.nome ?? 'Admin';

  async function onLogout() {
    await logout();
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="px-6 pt-10 pb-6 max-w-5xl mx-auto flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-2">
            Cockpit · Administração
          </div>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight truncate">
            {nome}
          </h1>
          {metrics && (
            <p className="text-[11px] text-ink-subtle mt-1 text-mono">
              Atualizado {formatarRelativo(metrics.geradoEm)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            data-testid="admin-refresh"
            className="text-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold disabled:opacity-40 hover:text-ink"
          >
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            data-testid="admin-logout"
            className="text-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold hover:text-ink"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="px-6 pb-16 max-w-5xl mx-auto space-y-6">
        {/* Banner de erro (mesmo com dados antigos exibidos). */}
        {error && (
          <div
            data-testid="admin-error-banner"
            className="px-4 py-2.5 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-mono text-[10px] uppercase tracking-wider font-bold"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {loading && !metrics ? (
          <SkeletonGrid />
        ) : metrics ? (
          <>
            <SecaoUsuarios m={metrics} />
            <SecaoTreinos m={metrics} />
            <SecaoAlertas m={metrics} />
          </>
        ) : null}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Seções
// ─────────────────────────────────────────────────────────────────────

function SecaoUsuarios({ m }: { m: AdminMetrics }) {
  const { usuarios } = m;
  const pendentesTotal = usuarios.pendentes.professores + usuarios.pendentes.nutris;
  return (
    <section>
      <SectionTitle>Usuários</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Ativos" value={usuarios.ativos} sub={`de ${usuarios.total} totais`} />
        <KpiCard label="Alunos" value={usuarios.porRole.ALUNO} />
        <KpiCard label="Professores" value={usuarios.porRole.PROFESSOR} />
        <KpiCard label="Nutricionistas" value={usuarios.porRole.NUTRICIONISTA} />
      </div>
      {pendentesTotal > 0 && (
        <div
          data-testid="admin-pendentes-chip"
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warn-bg text-warn text-[11.5px] font-bold tracking-tight"
        >
          <span aria-hidden>●</span>
          {pendentesTotal} profissional{pendentesTotal === 1 ? '' : 'is'} aguardando aprovação
          <span className="text-ink-subtle font-normal">
            ({usuarios.pendentes.professores} prof · {usuarios.pendentes.nutris} nutri)
          </span>
        </div>
      )}
    </section>
  );
}

function SecaoTreinos({ m }: { m: AdminMetrics }) {
  const { treinos } = m;
  return (
    <section>
      <SectionTitle>Treinos · semana corrente</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Prescritos" value={treinos.prescritosSemana} />
        <KpiCard label="Concluídos" value={treinos.concluidosSemana} />
        <KpiCard
          label="Taxa de adesão"
          value={treinos.taxaAdesao == null ? '—' : `${Math.round(treinos.taxaAdesao * 100)}%`}
          highlighted={treinos.taxaAdesao != null && treinos.taxaAdesao >= 0.7}
        />
        <KpiCard
          label="Histórico total"
          value={treinos.totalHistorico.toLocaleString('pt-BR')}
          sub="todos os tempos"
        />
      </div>
    </section>
  );
}

function SecaoAlertas({ m }: { m: AdminMetrics }) {
  const { alertas } = m;
  const semNada =
    alertas.alunosSemAtividade7d === 0 &&
    alertas.alunosSemProfessor === 0 &&
    alertas.alunosSemAlvo === 0;
  return (
    <section>
      <SectionTitle>Alertas operacionais</SectionTitle>
      {semNada ? (
        <div
          data-testid="admin-sem-alertas"
          className="px-4 py-3 rounded-[14px] border border-app bg-surface text-[13px] text-ink-muted"
        >
          Nenhum alerta no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AlertCard
            label="Sem atividade há 7d"
            value={alertas.alunosSemAtividade7d}
            descricao="Alunos ativos sem treino concluído na última semana."
          />
          <AlertCard
            label="Sem professor"
            value={alertas.alunosSemProfessor}
            descricao="Alunos ativos sem vínculo com nenhum profissional."
          />
          <AlertCard
            label="Sem alvo (Race A)"
            value={alertas.alunosSemAlvo}
            descricao="Alunos ativos sem prova prioridade A ativa."
          />
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle mb-3">
      {children}
    </h2>
  );
}

function KpiCard({
  label, value, sub, highlighted,
}: {
  label: string;
  value: number | string;
  sub?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      data-testid="admin-kpi-card"
      className={cn(
        'rounded-[14px] border p-4',
        highlighted
          ? 'bg-accent/10 border-accent/30'
          : 'bg-surface border-app',
      )}
    >
      <div className="text-mono text-[9.5px] uppercase tracking-[0.5px] font-bold text-ink-subtle mb-1.5">
        {label}
      </div>
      <div className="text-[26px] font-bold tabular tracking-tight leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-[10.5px] text-ink-muted mt-1">{sub}</div>
      )}
    </div>
  );
}

function AlertCard({
  label, value, descricao,
}: {
  label: string;
  value: number;
  descricao: string;
}) {
  const zero = value === 0;
  return (
    <div
      data-testid="admin-alert-card"
      data-zero={zero}
      className={cn(
        'rounded-[14px] border p-4',
        zero ? 'bg-surface border-app' : 'bg-warn-bg/40 border-warn/30',
      )}
    >
      <div className="text-mono text-[9.5px] uppercase tracking-[0.5px] font-bold text-ink-subtle mb-1.5">
        {label}
      </div>
      <div className={cn(
        'text-[26px] font-bold tabular tracking-tight leading-none',
        !zero && 'text-warn',
      )}>
        {value}
      </div>
      <div className="text-[10.5px] text-ink-muted mt-2 leading-snug">
        {descricao}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div data-testid="admin-skeleton" className="space-y-6">
      {[0, 1, 2].map((g) => (
        <section key={g}>
          <div className="h-3 w-32 bg-app rounded mb-3 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((c) => (
              <div key={c} className="h-24 rounded-[14px] bg-surface border border-app animate-pulse" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatarRelativo(iso: string): string {
  const agora = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Math.round((agora - t) / 1000));
  if (diff < 60) return 'agora há pouco';
  if (diff < 3600) return `há ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.round(diff / 3600)}h`;
  return `há ${Math.round(diff / 86400)}d`;
}
