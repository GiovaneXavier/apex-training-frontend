import { get as idbGet, set as idbSet } from 'idb-keyval';

import {
  deleteSubscription as apiDeleteSubscription,
  fetchVapidPublicKey,
  postSubscription,
  type VapidPublicKeyResponse,
} from '@/lib/api/push';

// PR #26 — Web Push subscription lifecycle no client.
//
// 6 estados expostos via getStatus():
//   unsupported          → browser não fala Web Push (Safari iOS < 16.4
//                          como tab; outros browsers muito antigos)
//   ios-needs-install    → Safari iOS detectado MAS PWA não instalado
//                          (Add to Home Screen exigido pra push)
//   denied               → user já recusou permissão; só vai voltar via
//                          settings do browser
//   granted-unsubscribed → permissão OK, mas não há subscription ativa
//   subscribed           → tudo certo
//   hash-mismatch        → PR #36: SHA-256 da VAPID key não bate com hash
//                          do server (cache corrompido). Não inscreve;
//                          UI silenciosa, próximo reload retenta.
//
// Detecção iOS é frágil — userAgent sniff é o melhor disponível porque
// Apple não expõe API decente. Standalone check via display-mode é
// confiável.

export type PushStatus =
  | 'unsupported'
  | 'ios-needs-install'
  | 'denied'
  | 'granted-unsubscribed'
  | 'subscribed'
  | 'hash-mismatch';

// Chave de cache no IndexedDB com o último hash VAPID associado à
// subscription ativa. Quando o server rotaciona a chave, este hash fica
// diferente do hash atual do server — sinal pra unsubscribe e re-subscribe.
export const VAPID_HASH_STORAGE_KEY = 'apex:push:vapid-hash';

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPad masquerading como Mac (iPadOS 13+) — checa touch events.
  const iPadOnMac =
    /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  const iPhoneIPad = /iPhone|iPad|iPod/i.test(ua);
  if (!iPhoneIPad && !iPadOnMac) return false;
  // Safari real (não Chrome iOS, que usa WKWebView mas com "CriOS").
  return !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS expõe navigator.standalone; outros browsers usam matchMedia.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return false;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    // iOS Safari < 16.4 cai aqui. Sub-classifica pra UX dar mensagem útil.
    if (isIOSSafari() && !isStandalonePWA()) return 'ios-needs-install';
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) return 'subscribed';
  return 'granted-unsubscribed';
}

// Converte VAPID public key (base64url) pra Uint8Array que o pushManager
// aceita como applicationServerKey. Padding base64 normalizado.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// PR #36 — SHA-256 base64url da string, via Web Crypto. Espelha o cálculo
// server-side (`crypto.createHash('sha256').update(key).digest('base64url')`).
async function sha256Base64Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PR #36 — busca VAPID key + hash, valida integridade em trânsito.
// Throw 'hash-mismatch' se o SHA-256 recalculado da chave não bate com o
// hash devolvido pelo server (cache HTTP/proxy corrompeu o payload).
async function fetchAndVerifyVapid(): Promise<VapidPublicKeyResponse> {
  const payload = await fetchVapidPublicKey();
  const computed = await sha256Base64Url(payload.key);
  if (computed !== payload.hash) {
    const err = new Error('VAPID_HASH_MISMATCH');
    (err as Error & { code: string }).code = 'hash-mismatch';
    throw err;
  }
  return payload;
}

/**
 * Pede permissão (se necessário), assina no PushManager, manda pro
 * backend. Idempotente: se já subscrito, retorna o estado atual sem
 * re-subscrever.
 *
 * Throw: erro com .code legível pra UX decidir mensagem.
 */
export async function subscribe(): Promise<PushStatus> {
  if (!isPushSupported()) {
    const err = new Error('Push não suportado neste navegador');
    (err as Error & { code: string }).code = 'unsupported';
    throw err;
  }

  if (Notification.permission === 'denied') {
    const err = new Error('Permissão de notificação negada');
    (err as Error & { code: string }).code = 'denied';
    throw err;
  }

  // requestPermission é idempotente — chamar de novo se já 'granted'
  // não exibe prompt.
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    const err = new Error('Permissão de notificação não concedida');
    (err as Error & { code: string }).code = 'not-granted';
    throw err;
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  // PR #36 — fetch + valida hash ANTES de qualquer subscribe/getSubscription.
  // Se mismatch (cache corrompido), aborta sem mexer no PushManager.
  let vapid: VapidPublicKeyResponse;
  try {
    vapid = await fetchAndVerifyVapid();
  } catch (err) {
    if ((err as Error & { code?: string }).code === 'hash-mismatch') {
      return 'hash-mismatch';
    }
    throw err;
  }

  // PR #36 — rotação de chave: se o hash armazenado é diferente do hash
  // atual, a subscription cacheada está atrelada à VAPID antiga.
  // Unsubscribe primeiro pra forçar re-subscribe abaixo com a nova
  // applicationServerKey. Sem isto, server não consegue enviar push
  // (web-push falha com auth error ou Push Service responde 410).
  if (sub) {
    const cachedHash = await idbGet<string>(VAPID_HASH_STORAGE_KEY);
    if (cachedHash && cachedHash !== vapid.hash) {
      try { await apiDeleteSubscription(sub.endpoint); } catch { /* best-effort */ }
      await sub.unsubscribe();
      sub = null;
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // applicationServerKey aceita BufferSource em runtime; o lib.dom
      // tipa estrito demais (não aceita Uint8Array<ArrayBufferLike>).
      // Cast aqui é seguro — a função produz Uint8Array com ArrayBuffer.
      applicationServerKey: urlBase64ToUint8Array(vapid.key) as unknown as BufferSource,
    });
  }

  // Envia pro backend (upsert idempotente). Sub.toJSON() devolve
  // { endpoint, keys: { p256dh, auth } }.
  const subJson = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
    const err = new Error('Subscription incompleta retornada pelo browser');
    (err as Error & { code: string }).code = 'invalid-subscription';
    throw err;
  }

  await postSubscription({
    endpoint: subJson.endpoint,
    keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });

  // PR #36 — fonte da verdade local: hash da VAPID key usada nesta sub.
  // Próximo subscribe() compara este valor com o hash do server pra detectar
  // rotação e re-inscrever automaticamente.
  await idbSet(VAPID_HASH_STORAGE_KEY, vapid.hash);

  return 'subscribed';
}

/**
 * Unsubscribe local + server. Idempotente.
 */
export async function unsubscribe(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return 'granted-unsubscribed';

  const endpoint = sub.endpoint;
  // Server primeiro — se falhar, mantém local pra retry. Mas no PushManager
  // o unsubscribe local é idempotente, então ordem inversa também serve.
  try {
    await apiDeleteSubscription(endpoint);
  } catch {
    // Não bloqueia: o sub local some, server fica órfão; próximo dispatch
    // recebe 410/404 e limpa naturalmente.
  }
  await sub.unsubscribe();
  return 'granted-unsubscribed';
}

// Exports só pra testes.
export const __internal = { urlBase64ToUint8Array, isIOSSafari, isStandalonePWA, sha256Base64Url, fetchAndVerifyVapid };
