import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

// StateStorage adapter para o middleware `persist` do Zustand.
// IndexedDB > localStorage para offline:
// - sem limite de 5MB
// - assíncrono (não bloqueia main thread)
// - sobrevive em modo standalone PWA mesmo com storage pressure
export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};
