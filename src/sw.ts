/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// PR #26 — SW customizado (injectManifest mode).
//
// Substitui o SW autogerado pelo VitePWA generateSW. Mantém TODO o
// comportamento offline-first do PR #9 (precache App Shell + runtime
// NetworkFirst pra /api) e adiciona:
//
//   1. `push` listener — recebe payload, mostra notification.
//   2. `notificationclick` listener — foca aba existente em vez de abrir
//       duplicata (gotcha do user, "O Foco da Aba").
//   3. `pushsubscriptionchange` listener — re-subscribe + sync com server
//       quando o Push Service rotaciona endpoint.
//
// CRÍTICO: precacheAndRoute(self.__WB_MANIFEST) DEVE estar antes de
// qualquer registerRoute. Sem isso, offline-first explode (gotcha do
// user, "O Array self.__WB_MANIFEST").

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Precache (App Shell) ────────────────────────────────────────────
// Injectado pelo VitePWA no build. Sem isto, navegar offline pra
// /aluno/treino/abc serve tela branca.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigate fallback: rota client-side desconhecida (ex.
// /aluno/treino/abc) serve index.html cacheado. Sem isto, navegação
// offline pra rotas internas serve "página não disponível" do browser.
// Denylist evita interceptar chamadas /api/* (devem ir pra cache ou
// rede normal, nunca cair em index.html).
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// ─── Runtime caching — portado 1:1 da config do PR #9 ────────────────
//
// NetworkFirst pras APIs que precisam de dados frescos mas devem
// degradar pra cache quando offline. networkTimeoutSeconds=3 evita
// esperar 30s num celular sem sinal.

const NETWORK_FIRST_API = [
  { pattern: /\/api\/treinos(\/|\?|$)/, cacheName: 'apex-api-treinos', maxAge: 60 * 60 * 24 * 7, maxEntries: 100 },
  { pattern: /\/api\/rotinas(\/|\?|$)/, cacheName: 'apex-api-rotinas', maxAge: 60 * 60 * 24 * 7, maxEntries: 50 },
  { pattern: /\/api\/auth\/me(\?|$)/, cacheName: 'apex-api-me', maxAge: 60 * 60, maxEntries: 1 },
  { pattern: /\/api\/(aluno|rps|evolucoes|strava)(\/|\?|$)/, cacheName: 'apex-api-misc', maxAge: 60 * 60 * 24, maxEntries: 50 },
];

for (const { pattern, cacheName, maxAge, maxEntries } of NETWORK_FIRST_API) {
  registerRoute(
    ({ url }) => pattern.test(url.pathname + url.search),
    new NetworkFirst({
      cacheName,
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries, maxAgeSeconds: maxAge }),
      ],
    }),
  );
}

// Fontes Google: CSS volátil (SWR), arquivos imutáveis (CacheFirst).
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// Imagens (avatares S3, ícones, evolucao photos).
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'apex-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// ─── Lifecycle: skipWaiting controlado pelo client (ReloadPrompt) ────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Push listener ───────────────────────────────────────────────────
//
// Payload esperado (JSON): { title, body, url?, tag?, icon? }
// Backend valida shape via Zod (notificationPayloadSchema). Aqui
// guardamos defensivamente caso chegue null (push sem payload).

type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
};

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'Apex Training' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Apex Training', body: event.data.text() };
    }
  }

  const url = payload.url || '/';
  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag,
    // requireInteraction true seria intrusivo demais — deixamos OS decidir
    // quando colapsar.
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// ─── Notificationclick — foco da aba (gotcha #1) ─────────────────────
//
// Sem o matchAll/focus, cada click abre uma janela nova do PWA — após
// 3 clicks o atleta tem 3 instâncias do app e o estado in-memory cada
// uma na sua. O padrão ouro abaixo: foca aba existente quando possível.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // Procura cliente já no destino exato — só foca, sem navegar.
    const exact = allClients.find((c) => c.url === target);
    if (exact) {
      await exact.focus();
      return;
    }

    // Procura qualquer cliente do app — foca + navega.
    // Comparamos por origin pra cobrir SPA com rotas client-side.
    const sameOrigin = allClients.find((c) =>
      new URL(c.url).origin === self.location.origin,
    );
    if (sameOrigin) {
      await sameOrigin.focus();
      if ('navigate' in sameOrigin) {
        try {
          // navigate só funciona pra mesma origin — já checado.
          await sameOrigin.navigate(target);
        } catch {
          // Alguns browsers (Safari) ainda rejeitam navigate; ignora.
        }
      }
      return;
    }

    // Fallback: nenhum cliente vivo → abre janela nova.
    await self.clients.openWindow(target);
  })());
});

// ─── pushsubscriptionchange — re-subscribe quando endpoint rotaciona ─
//
// Push Services rotacionam endpoints ocasionalmente (segurança, key
// rotation interna). Sem este handler, o user vira "fantasma" — backend
// guarda endpoint velho que sempre falha com 410.
//
// Estratégia:
//   1. Re-subscribe com a applicationServerKey usada antes (vem do oldSub
//      ou via fetch /push/vapid-public-key).
//   2. Avisar o backend pra trocar oldEndpoint → newEndpoint.
//
// Em iOS/Safari atual, esse evento raramente dispara — mantemos para
// futureproof.

self.addEventListener('pushsubscriptionchange', ((event: Event) => {
  // Cast: tipos DOM declaram este event como `PushSubscriptionChangeEvent`,
  // mas com oldSubscription: PushSubscription | null. Tratamos como
  // ExtendableEvent + props opcionais pra cobrir polyfills/diferenças
  // entre runtimes.
  const e = event as ExtendableEvent & {
    oldSubscription: PushSubscription | null;
    newSubscription: PushSubscription | null;
  };
  e.waitUntil((async () => {
    try {
      let newSub = e.newSubscription;
      if (!newSub) {
        const oldKey = e.oldSubscription?.options?.applicationServerKey;
        if (!oldKey) return; // sem chave não dá pra resubscribe
        newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: oldKey,
        });
      }

      // Manda nova sub pro backend. Se o user já tinha cookie válido, o
      // upsert por endpoint cuida da idempotência (mesmo user, nova entry,
      // velha some no próximo 410).
      await fetch('/api/push/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub.toJSON()),
      });
    } catch (err) {
      // Silencioso — falha aqui não tem UI pra mostrar. Próximo dispatch
      // do backend vai 410 no endpoint velho e fazer cleanup natural.
      console.warn('[sw] pushsubscriptionchange falhou', err);
    }
  })());
}) as EventListener);

export {};
