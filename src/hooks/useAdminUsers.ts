import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Role } from '@/contexts/AuthContext';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  listAdminUsers,
  type AdminUserListItem,
} from '@/lib/api/admin';

// PR #43 — Bloco B / Hook de gerenciamento de usuários.
//
// Responsabilidades:
//  - Manter lista paginada (infinite scroll por cursor).
//  - Reset automático quando filtros mudam.
//  - Expor mutate optimistic pra aprovar/desativar refletir na lista
//    sem refetch (lista grande → refetch quebraria a posição do scroll).
//
// Por que useReducer em vez de useState: a lógica de páginas + cursor +
// loading + erro vira state machine ("idle/loadingFirst/idle+hasMore/
// loadingMore/end/error"). Reducer torna transições explícitas e cobre
// race entre fetch novo de filtros vs append de página antiga.

type Filters = {
  search?: string;
  role?: Role;
  ativo?: boolean;
};

type State = {
  filters: Filters;
  items: AdminUserListItem[];
  cursor: string | null;
  hasMore: boolean;
  loadingFirst: boolean;
  loadingMore: boolean;
  error: string | null;
  // Token incrementado a cada reset (mudança de filtro) — resposta com
  // requestId antigo é descartada (race-safety).
  requestId: number;
};

type Action =
  | { type: 'reset'; filters: Filters }
  | { type: 'fetchStart'; mode: 'first' | 'more'; requestId: number }
  | { type: 'fetchOk'; mode: 'first' | 'more'; requestId: number; items: AdminUserListItem[]; cursor: string | null; hasMore: boolean }
  | { type: 'fetchErr'; requestId: number; message: string }
  | { type: 'replaceItem'; user: AdminUserListItem }
  | { type: 'removeItem'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return {
        ...state,
        filters: action.filters,
        items: [],
        cursor: null,
        hasMore: true,
        loadingFirst: true,
        loadingMore: false,
        error: null,
        requestId: state.requestId + 1,
      };
    case 'fetchStart':
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        loadingFirst: action.mode === 'first' ? true : state.loadingFirst,
        loadingMore: action.mode === 'more',
        error: null,
      };
    case 'fetchOk':
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        items: action.mode === 'first' ? action.items : [...state.items, ...action.items],
        cursor: action.cursor,
        hasMore: action.hasMore,
        loadingFirst: false,
        loadingMore: false,
      };
    case 'fetchErr':
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        loadingFirst: false,
        loadingMore: false,
        error: action.message,
      };
    case 'replaceItem':
      return {
        ...state,
        items: state.items.map((u) => (u.id === action.user.id ? action.user : u)),
      };
    case 'removeItem':
      return {
        ...state,
        items: state.items.filter((u) => u.id !== action.id),
      };
    default:
      return state;
  }
}

const INITIAL: State = {
  filters: {},
  items: [],
  cursor: null,
  hasMore: true,
  loadingFirst: true,
  loadingMore: false,
  error: null,
  requestId: 0,
};

export type UseAdminUsersResult = {
  items: AdminUserListItem[];
  hasMore: boolean;
  loadingFirst: boolean;
  loadingMore: boolean;
  error: string | null;
  filters: Filters;
  setFilters: (next: Filters) => void;
  loadMore: () => void;
  // Optimistic helpers — usados pelas ações do drawer/linha.
  replaceItem: (user: AdminUserListItem) => void;
  removeItem: (id: string) => void;
};

export function useAdminUsers(initialFilters: Filters = {}): UseAdminUsersResult {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL,
    filters: initialFilters,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (mode: 'first' | 'more', requestId: number, cursor: string | null, filters: Filters) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      dispatch({ type: 'fetchStart', mode, requestId });
      try {
        const data = await listAdminUsers(
          {
            limit: 20,
            cursor: cursor ?? undefined,
            search: filters.search,
            role: filters.role,
            ativo: filters.ativo,
          },
          { signal: ctrl.signal },
        );
        dispatch({
          type: 'fetchOk',
          mode,
          requestId,
          items: data.usuarios,
          cursor: data.proximoCursor,
          hasMore: data.temMais,
        });
      } catch (err) {
        if (isCancelError(err)) return;
        dispatch({ type: 'fetchErr', requestId, message: apiErrorMessage(err) });
      }
    },
    [],
  );

  // Primeira página + sempre que filtros mudarem (requestId muda também
  // — fetchPage usa o id pra ignorar respostas obsoletas).
  useEffect(() => {
    void fetchPage('first', state.requestId, null, state.filters);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.requestId]);

  const setFilters = useCallback((next: Filters) => {
    dispatch({ type: 'reset', filters: next });
  }, []);

  const loadMore = useCallback(() => {
    if (!state.hasMore || state.loadingMore || state.loadingFirst) return;
    if (!state.cursor) return;
    void fetchPage('more', state.requestId, state.cursor, state.filters);
  }, [fetchPage, state.cursor, state.filters, state.hasMore, state.loadingFirst, state.loadingMore, state.requestId]);

  const replaceItem = useCallback((user: AdminUserListItem) => {
    dispatch({ type: 'replaceItem', user });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'removeItem', id });
  }, []);

  return {
    items: state.items,
    hasMore: state.hasMore,
    loadingFirst: state.loadingFirst,
    loadingMore: state.loadingMore,
    error: state.error,
    filters: state.filters,
    setFilters,
    loadMore,
    replaceItem,
    removeItem,
  };
}
