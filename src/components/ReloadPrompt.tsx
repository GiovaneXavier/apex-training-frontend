import { useRegisterSW } from 'virtual:pwa-register/react';

// Toast PWA — fixo bottom-right, discreto.
// needRefresh → SW novo em waiting. updateServiceWorker(true) = skipWaiting + reload.
// offlineReady → primeira instalação concluída, app utilizável offline.
export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.error('[pwa] SW register error', err);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  const title = needRefresh ? 'Nova versão disponível!' : 'App pronto para uso offline!';
  const desc = needRefresh
    ? 'Atualize para receber as melhorias mais recentes.'
    : 'Você já pode usar o Apex sem conexão durante o treino.';

  return (
    <div
      role="status"
      aria-live="polite"
      className="
        fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm
        rounded-lg border border-white/10 shadow-2xl
        bg-[#0a0a0b] text-white
        px-4 py-3
        animate-in fade-in slide-in-from-bottom-4 duration-200
      "
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 inline-block h-2 w-2 rounded-full bg-[#fc4c02]"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-white/60 mt-0.5">{desc}</p>

          <div className="mt-3 flex items-center gap-2">
            {needRefresh && (
              <button
                type="button"
                onClick={() => updateServiceWorker(true)}
                className="
                  inline-flex items-center justify-center
                  rounded-md px-3 py-1.5 text-xs font-semibold
                  bg-[#fc4c02] text-white
                  hover:bg-[#e04402] active:bg-[#c43c02]
                  transition-colors
                "
              >
                Atualizar
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="
                inline-flex items-center justify-center
                rounded-md px-3 py-1.5 text-xs font-medium
                text-white/70 hover:text-white hover:bg-white/5
                transition-colors
              "
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
