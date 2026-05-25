import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Role } from '@/contexts/AuthContext';

import { useAdminUsers } from '@/hooks/useAdminUsers';
import { UsuarioRow } from '@/components/admin/UsuarioRow';
import { UsuarioDetalheDrawer } from '@/components/admin/UsuarioDetalheDrawer';
import { cn } from '@/lib/utils';

// PR #43 (Sprint 16 — Bloco B) — Página `/admin/usuarios`.
//
// Layout:
//   - Header: link "← Cockpit", título, busca (input debounced 300ms).
//   - Abas de filtro: Todos / Pendentes / Alunos / Professores / Nutris / Inativos.
//     Cada aba mapeia em um conjunto fixo de {role?, ativo?} pra setFilters().
//   - Lista virtualizada via IntersectionObserver (D6) — sentinela no fim
//     dispara loadMore quando entra no viewport (margin 200px).
//   - Drawer lateral pra detalhe + ações.

type Aba = 'todos' | 'pendentes' | 'alunos' | 'professores' | 'nutris' | 'inativos';

const ABAS: { id: Aba; label: string; filters: { role?: Role; ativo?: boolean } }[] = [
  { id: 'todos', label: 'Todos', filters: {} },
  { id: 'pendentes', label: 'Pendentes', filters: { ativo: false } },
  { id: 'alunos', label: 'Alunos', filters: { role: 'ALUNO' } },
  { id: 'professores', label: 'Professores', filters: { role: 'PROFESSOR' } },
  { id: 'nutris', label: 'Nutricionistas', filters: { role: 'NUTRICIONISTA' } },
  { id: 'inativos', label: 'Inativos', filters: { ativo: false } },
];

export default function AdminUsuarios() {
  const [aba, setAba] = useState<Aba>('todos');
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const abaConfig = useMemo(() => ABAS.find((a) => a.id === aba) ?? ABAS[0], [aba]);

  const {
    items,
    hasMore,
    loadingFirst,
    loadingMore,
    error,
    setFilters,
    loadMore,
    replaceItem,
  } = useAdminUsers(abaConfig.filters);

  // Debounce search 300ms — evita disparar fetch a cada keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters({
        ...abaConfig.filters,
        search: searchInput.trim() || undefined,
      });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, aba]);

  // IntersectionObserver pra infinite scroll. Sentinela ~200px antes do
  // fim → carrega próxima página antes do usuário ver "vazio".
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
            Usuários
          </h1>
          <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
            {items.length} {items.length === 1 ? 'carregado' : 'carregados'}
            {hasMore && '+'}
          </span>
        </div>
      </header>

      <main className="px-6 pb-16 max-w-5xl mx-auto">
        {/* Busca */}
        <div className="mb-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou email"
            data-testid="admin-search"
            className="w-full h-10 px-3 rounded-[10px] bg-surface border border-app text-[13px] focus:outline-none focus:border-ink-muted"
          />
        </div>

        {/* Abas */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              data-testid="admin-aba"
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

        {/* Banner de erro */}
        {error && (
          <div
            data-testid="admin-users-error"
            className="mb-3 px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px]"
          >
            {error}
          </div>
        )}

        {/* Lista */}
        {loadingFirst ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <EmptyState aba={aba} search={searchInput} />
        ) : (
          <ul className="space-y-2" data-testid="admin-user-list">
            {items.map((u) => (
              <li key={u.id}>
                <UsuarioRow
                  user={u}
                  selected={selectedId === u.id}
                  onClick={() => setSelectedId(u.id)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Sentinela do infinite scroll — visível só quando tem mais. */}
        {hasMore && !loadingFirst && (
          <div
            ref={sentinelRef}
            data-testid="admin-users-sentinel"
            className="h-12 flex items-center justify-center text-mono text-[10px] text-ink-subtle uppercase tracking-wider"
          >
            {loadingMore ? 'Carregando…' : 'Role pra carregar mais'}
          </div>
        )}
      </main>

      <UsuarioDetalheDrawer
        userId={selectedId}
        onClose={() => setSelectedId(null)}
        onUserUpdated={(u) => replaceItem(u)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <ul className="space-y-2" data-testid="admin-users-skeleton">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="h-16 rounded-[12px] bg-surface border border-app animate-pulse" />
      ))}
    </ul>
  );
}

function EmptyState({ aba, search }: { aba: Aba; search: string }) {
  const msg = search
    ? `Nenhum usuário encontrado para "${search}".`
    : aba === 'pendentes'
    ? 'Nenhum profissional aguardando aprovação.'
    : 'Nenhum usuário nesta categoria.';
  return (
    <div
      data-testid="admin-users-empty"
      className="px-4 py-8 rounded-[14px] border border-app bg-surface text-center text-[13px] text-ink-muted"
    >
      {msg}
    </div>
  );
}
