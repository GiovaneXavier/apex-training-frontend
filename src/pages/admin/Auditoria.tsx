import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuditLog } from '@/hooks/useAuditLog';
import { AuditLogRow } from '@/components/admin/AuditLogRow';
import { AuditDetalheDrawer } from '@/components/admin/AuditDetalheDrawer';
import { AUDIT_ACTION_LABELS, type AuditLogEntry } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

// PR #45 (Sprint 16 — Bloco D) — Página `/admin/auditoria`.
//
// Layout reusa padrão do Bloco B (Usuarios.tsx): header + filtros laterais
// + lista infinite scroll + drawer. Sem tabela tradicional — rows são
// cards (mais respiráveis em mobile que tabela densa).

type Aba = 'todos' | 'vinculos' | 'usuarios' | 'autenticacao';

const ABAS: { id: Aba; label: string; actions: string[] }[] = [
  { id: 'todos', label: 'Todos', actions: [] },
  { id: 'vinculos', label: 'Vínculos', actions: ['vinculo.criar_prof', 'vinculo.quebrar_prof'] },
  { id: 'usuarios', label: 'Usuários', actions: ['user.aprovar', 'user.ativar', 'user.desativar'] },
  { id: 'autenticacao', label: 'Autenticação', actions: ['auth.login', 'auth.login_falhou', 'auth.logout'] },
];

export default function AdminAuditoria() {
  const [aba, setAba] = useState<Aba>('todos');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [atorFilter, setAtorFilter] = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Filtros combinam aba + dropdowns. Aba define grupo de actions; o
  // dropdown action específico (se preenchido) sobrescreve. Filtro
  // ator é entityId-ish — admin tipa um userId.
  const filters = useMemo(() => {
    const out: { action?: string; atorUserId?: string } = {};
    if (actionFilter) {
      out.action = actionFilter;
    } else {
      const abaConfig = ABAS.find((a) => a.id === aba);
      // Aba com >1 action não dá pra filtrar via 1 só param do backend.
      // Pra MVP, "Todos" ou aba específica de 1 grupo: backend filtra só
      // se exatamente 1 action — outros casos passam sem filtro e
      // frontend faz refinamento client-side (lista é paginada, então
      // funciona pra primeiras N páginas).
      if (abaConfig?.actions.length === 1) {
        out.action = abaConfig.actions[0];
      }
    }
    if (atorFilter.trim()) out.atorUserId = atorFilter.trim();
    return out;
  }, [aba, actionFilter, atorFilter]);

  const {
    items, hasMore, loadingFirst, loadingMore, error, setFilters, loadMore,
  } = useAuditLog(filters);

  // Debounce do filtro de ator (input livre) — evita request por keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setFilters(filters), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.action, filters.atorUserId]);

  // Refinamento client-side quando aba tem N actions (Vínculos/Usuários/
  // Autenticação). Backend filtra por 1 só, então pra "Vínculos" temos
  // que filtrar localmente as 2 actions. Comprometemos paginação aqui
  // em troca de UX — admin pode usar dropdown específico se quiser
  // garantia 100% da aba.
  const filteredItems = useMemo(() => {
    const abaConfig = ABAS.find((a) => a.id === aba);
    if (!abaConfig || abaConfig.actions.length <= 1) return items;
    return items.filter((l) => abaConfig.actions.includes(l.action));
  }, [items, aba]);

  // IntersectionObserver — infinite scroll (mesmo padrão Bloco B).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="px-6 pt-8 pb-4 max-w-5xl mx-auto">
        <Link
          to="/admin/cockpit"
          className="text-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold hover:text-ink"
        >
          ← Cockpit
        </Link>
        <div className="flex items-baseline justify-between gap-4 mt-3">
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">
            Auditoria
          </h1>
          <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
            {filteredItems.length} {filteredItems.length === 1 ? 'evento' : 'eventos'}
            {hasMore && '+'}
          </span>
        </div>
        <p className="text-[12px] text-ink-muted mt-1">
          Registro append-only de ações administrativas. Não editável.
        </p>
      </header>

      <main className="px-6 pb-16 max-w-5xl mx-auto">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-mono text-[9.5px] uppercase tracking-[0.5px] font-bold text-ink-subtle mb-1">
              Ação específica
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              data-testid="audit-action-filter"
              className="w-full h-10 px-2 rounded-[10px] bg-surface border border-app text-[12.5px]"
            >
              <option value="">— Qualquer —</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([action, meta]) => (
                <option key={action} value={action}>
                  [{meta.group}] {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-mono text-[9.5px] uppercase tracking-[0.5px] font-bold text-ink-subtle mb-1">
              Ator (User ID)
            </label>
            <input
              type="search"
              value={atorFilter}
              onChange={(e) => setAtorFilter(e.target.value)}
              placeholder="cmosi..."
              data-testid="audit-ator-filter"
              className="w-full h-10 px-3 rounded-[10px] bg-surface border border-app text-[12.5px] text-mono focus:outline-none focus:border-ink-muted"
            />
          </div>
        </div>

        {/* Abas de grupo */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              data-testid="audit-aba"
              data-active={aba === a.id}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-mono text-[10px] uppercase tracking-wider font-bold transition-colors',
                aba === a.id
                  ? 'bg-ink text-bg'
                  : 'bg-surface border border-app text-ink-muted hover:text-ink',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            data-testid="audit-error"
            className="mb-3 px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px]"
          >
            {error}
          </div>
        )}

        {loadingFirst ? (
          <ListSkeleton />
        ) : filteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2" data-testid="audit-list">
            {filteredItems.map((log) => (
              <li key={log.id}>
                <AuditLogRow
                  log={log}
                  selected={selected?.id === log.id}
                  onClick={() => setSelected(log)}
                />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loadingFirst && (
          <div
            ref={sentinelRef}
            data-testid="audit-sentinel"
            className="h-12 flex items-center justify-center text-mono text-[10px] text-ink-subtle uppercase tracking-wider"
          >
            {loadingMore ? 'Carregando…' : 'Role pra carregar mais'}
          </div>
        )}
      </main>

      <AuditDetalheDrawer log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2" data-testid="audit-skeleton">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="h-16 rounded-[12px] bg-surface border border-app animate-pulse" />
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="audit-empty"
      className="px-4 py-8 rounded-[14px] border border-app bg-surface text-center text-[13px] text-ink-muted"
    >
      Nenhum evento encontrado para os filtros atuais.
    </div>
  );
}
