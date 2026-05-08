import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom não tem IndexedDB. O store usa idb-keyval via persist middleware
// e dispara escritas assíncronas durante os testes. Substituímos por um
// Map em memória — mantém a API, evita unhandled rejections de IDB.
vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => {
      store.set(k, v);
    },
    del: async (k: string) => {
      store.delete(k);
    },
    clear: async () => {
      store.clear();
    },
  };
});
