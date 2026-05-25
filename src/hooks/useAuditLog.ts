import { useCallback, useEffect, useReducer, useRef } from 'react';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  listAuditLogs,
  type AuditLogEntry,
  type AuditLogFilters,
} from '@/lib/api/admin';

// PR #45 — Hook do AuditLog viewer.
//
// Mesmo padrão de useAdminUsers (Bloco B): state machine via useReducer
// com cursor + race-safety por requestId. Audit é read-only (sem
// mutations optimistic — nada de replaceItem/removeItem).

type Filters = Omit<AuditLogFilters, 'limit' | 'cursor'>;

type State = {
  filters: Filters;
  items: AuditLogEntry[];
  cursor: string | null;
  hasMore: boolean;
  loadingFirst: boolean;
  loadingMore: boolean;
  error: string | null;
  requestId: number;
};

type Action =
  | { type: 'reset'; filters: Filters }
  | { type: 'fetchStart'; mode: 'first' | 'more'; requestId: number }
  | { type: 'fetchOk'; mode: 'first' | 'more'; requestId: number; items: AuditLogEntry[]; cursor: string | null; hasMore: boolean }
  | { type: 'fetchErr'; requestId: number; message: string };

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

export type UseAuditLogResult = {
  items: AuditLogEntry[];
  hasMore: boolean;
  loadingFirst: boolean;
  loadingMore: boolean;
  error: string | null;
  filters: Filters;
  setFilters: (next: Filters) => void;
  loadMore: () => void;
};

export function useAuditLog(initialFilters: Filters = {}): UseAuditLogResult {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL, filters: initialFilters });
  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (mode: 'first' | 'more', requestId: number, cursor: string | null, filters: Filters) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      dispatch({ type: 'fetchStart', mode, requestId });
      try {
        const data = await listAuditLogs(
          { ...filters, limit: 30, cursor: cursor ?? undefined },
          { signal: ctrl.signal },
        );
        dispatch({
          type: 'fetchOk',
          mode,
          requestId,
          items: data.logs,
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

  return {
    items: state.items,
    hasMore: state.hasMore,
    loadingFirst: state.loadingFirst,
    loadingMore: state.loadingMore,
    error: state.error,
    filters: state.filters,
    setFilters,
    loadMore,
  };
}
