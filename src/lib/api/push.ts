import { api } from '@/lib/api';

// PR #26 — client de Web Push.
//
// vapid-public-key é endpoint público (a chave É pública). Chamamos
// SEM withCredentials porque não há cookie envolvido — economiza
// pre-flight CORS em alguns browsers.

export type VapidPublicKeyResponse = {
  key: string;
  hash: string;
};

// PR #36 — backend agora devolve `hash` (SHA-256 base64url da `key`)
// pro client validar integridade em trânsito antes de pushManager.subscribe.
export async function fetchVapidPublicKey(): Promise<VapidPublicKeyResponse> {
  const { data } = await api.get<VapidPublicKeyResponse>('/push/vapid-public-key');
  return data;
}

export type SubscribePayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

export async function postSubscription(payload: SubscribePayload): Promise<void> {
  await api.post('/push/subscriptions', payload);
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  // axios.delete com body precisa de config.data — body em DELETE é raro
  // mas suportado pelo Express bodyParser.
  await api.delete('/push/subscriptions', { data: { endpoint } });
}

export async function sendTestPush(
  payload: { title?: string; body?: string; url?: string } = {},
): Promise<{ sent: number; dead: number; failed: number }> {
  const { data } = await api.post<{ sent: number; dead: number; failed: number }>(
    '/push/test',
    payload,
  );
  return data;
}
