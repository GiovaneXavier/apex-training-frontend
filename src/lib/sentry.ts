import * as Sentry from '@sentry/react';

// PR #34 — Observabilidade frontend (Sprint 13).
//
// Init no-op quando VITE_SENTRY_DSN ausente OU MODE=test. Zero overhead
// em dev/test. Tree-shake: módulo é importado em main.tsx; sem DSN o
// init não roda mas o bundle ainda traz Sentry (~30KB Gzip). Quando
// estabilizar, dynamic import pra cortar isso.
//
// Distributed tracing: tracePropagationTargets bate com origens conhecidas
// (localhost dev + prod domain via env). Sem isso, Sentry adiciona
// sentry-trace header em chamadas pra DOMÍNIOS ALHEIOS (CDNs, S3) — log
// poluído.
//
// Filtro de ruído: erros de chrome-extension://, scripts embedados (ad-blockers)
// e ResizeObserver loops são descartados.

const NOISE_PATTERNS = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  // ResizeObserver loop é warning benigno em browsers modernos.
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
];

function isNoise(event: Sentry.Event): boolean {
  const values = event.exception?.values ?? [];
  for (const v of values) {
    const msg = `${v.type ?? ''} ${v.value ?? ''}`;
    if (NOISE_PATTERNS.some((p) => p.test(msg))) return true;
    // Stack frames vindas de extensão.
    for (const frame of v.stacktrace?.frames ?? []) {
      const file = frame.filename ?? '';
      if (NOISE_PATTERNS.some((p) => p.test(file))) return true;
    }
  }
  return false;
}

let initialized = false;

export function initSentryFrontend() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // no-op em dev sem DSN
  if (import.meta.env.MODE === 'test') return;

  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3333/api';
  // Extrai origem (sem path) pra propagar sentry-trace só pro backend.
  let apiOrigin = '';
  try { apiOrigin = new URL(apiUrl).origin; } catch { /* ignore */ }

  Sentry.init({
    dsn,
    environment: (import.meta.env.MODE as string) || 'production',
    release: (import.meta.env.VITE_SENTRY_RELEASE as string) || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    // Distributed tracing: PROPAGAR sentry-trace SOMENTE pra esses targets.
    // Sem propagação cross-origin pra Anthropic, S3, Strava etc.
    tracePropagationTargets: [
      'localhost',
      ...(apiOrigin ? [apiOrigin] : []),
    ],
    beforeSend(event) {
      if (isNoise(event)) return null;
      return event;
    },
  });
  initialized = true;
}

// Captura manual enriquecida — usado pelo axios interceptor pra
// reportar ERR_NETWORK com contexto (navigator.onLine, URL, método).
// No-op silencioso se Sentry não inicializou (dev/test).
export function captureNetworkError(err: unknown, ctx: {
  url?: string;
  method?: string;
  code?: string;
}) {
  if (!initialized) return;
  const online = typeof navigator !== 'undefined' ? navigator.onLine : null;
  Sentry.captureException(err, {
    tags: {
      kind: 'network',
      code: ctx.code ?? 'unknown',
      online: online === null ? 'unknown' : String(online),
    },
    extra: {
      url: ctx.url,
      method: ctx.method,
      online,
      timestamp: new Date().toISOString(),
    },
  });
}

// Test hook.
export function __resetForTests() {
  initialized = false;
}

// Exports pra teste do filtro.
export const __internal = { isNoise, NOISE_PATTERNS };
