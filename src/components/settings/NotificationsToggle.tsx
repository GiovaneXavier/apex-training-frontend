import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { getStatus, subscribe, unsubscribe, type PushStatus } from '@/lib/push/registerPush';

// PR #26 — UI de opt-in pra Web Push.
//
// 5 estados visuais alinhados com PushStatus:
//   unsupported        → "Seu navegador não suporta notificações."
//   ios-needs-install  → "Adicione à Tela Inicial pra ativar."
//   denied             → "Você bloqueou. Habilite nas configurações do site."
//   granted-unsubscribed → CTA "Ativar notificações"
//   subscribed         → CTA "Desativar" + indicador ativo
//
// loading durante transições.

type Props = {
  className?: string;
};

export function NotificationsToggle({ className }: Props) {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await getStatus();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus('unsupported');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onEnable() {
    setBusy(true);
    try {
      const next = await subscribe();
      setStatus(next);
      toast.success('Notificações ativadas');
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'denied' || code === 'not-granted') {
        setStatus('denied');
        toast.error('Permissão negada. Habilite nas configurações do navegador.');
      } else {
        toast.error(apiErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    setBusy(true);
    try {
      const next = await unsubscribe();
      setStatus(next);
      toast.success('Notificações desativadas');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="notifications-toggle"
      data-status={status}
      className={className ?? 'p-4 rounded-[14px] bg-surface border border-app'}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
          🔔 Notificações Push
        </div>
        {status === 'subscribed' && (
          <span
            className="text-mono text-[9px] uppercase tracking-wider text-accent font-bold"
            aria-label="Status ativo"
          >
            ATIVO
          </span>
        )}
      </div>

      {status === 'loading' && (
        <p className="text-[12px] text-ink-subtle">Verificando…</p>
      )}

      {status === 'unsupported' && (
        <p className="text-[12px] text-ink-muted">
          Seu navegador não suporta notificações push.
        </p>
      )}

      {status === 'ios-needs-install' && (
        <p className="text-[12px] text-ink-muted" data-testid="ios-install-hint">
          Pra ativar notificações no iPhone, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela Inicial</strong> e abra o app pelo ícone instalado.
        </p>
      )}

      {status === 'denied' && (
        <p className="text-[12px] text-danger">
          Notificações bloqueadas. Habilite nas configurações do navegador
          (cadeado na barra de endereço → Notificações → Permitir).
        </p>
      )}

      {status === 'granted-unsubscribed' && (
        <>
          <p className="text-[12px] text-ink-muted mb-3">
            Receba avisos de novo plano alimentar, treino atribuído e marcos de progresso.
          </p>
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            data-testid="enable-push"
            className="h-10 px-4 rounded-[10px] bg-accent text-accent-ink text-[12px] font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {busy ? 'Ativando…' : 'Ativar notificações'}
          </button>
        </>
      )}

      {status === 'subscribed' && (
        <>
          <p className="text-[12px] text-ink-muted mb-3">
            Você receberá notificações deste dispositivo.
          </p>
          <button
            type="button"
            onClick={onDisable}
            disabled={busy}
            data-testid="disable-push"
            className="h-10 px-4 rounded-[10px] bg-surface border border-app-strong text-ink-muted text-[12px] font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {busy ? 'Desativando…' : 'Desativar'}
          </button>
        </>
      )}
    </div>
  );
}
