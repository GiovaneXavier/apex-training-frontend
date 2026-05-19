import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AlunoTabs } from '@/components/AlunoTabs';
import { ConquistaBadge } from '@/components/aluno/ConquistaBadge';
import { apiErrorMessage, isCancelError } from '@/lib/api';
import { listConquistas, type ConquistasResponse } from '@/lib/api/conquistas';

// PR #31 — Estante de conquistas (Sprint 11).
//
// Listagem ordenada:
//   1. Desbloqueadas (cronológica reversa — mais recentes no topo).
//   2. Locked / próximas (ordem do catálogo).
// Deep-link via ?destaque=CODIGO destaca visualmente o badge.

export default function ConquistasPage() {
  const [params] = useSearchParams();
  const destaque = params.get('destaque');

  const [data, setData] = useState<ConquistasResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const r = await listConquistas({ signal: ctrl.signal });
        if (!ctrl.signal.aborted) setData(r);
      } catch (err) {
        if (ctrl.signal.aborted || isCancelError(err)) return;
        setErro(apiErrorMessage(err));
      }
    })();
    return () => ctrl.abort();
  }, []);

  const desbloqueadas = data?.itens.filter((i) => i.desbloqueada) ?? [];
  const lockeds = data?.itens.filter((i) => !i.desbloqueada) ?? [];

  // Ordena desbloqueadas por data DESC.
  desbloqueadas.sort((a, b) => {
    const ta = a.desbloqueadoEm ? Date.parse(a.desbloqueadoEm) : 0;
    const tb = b.desbloqueadoEm ? Date.parse(b.desbloqueadoEm) : 0;
    return tb - ta;
  });

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link
          to="/aluno/dashboard"
          className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
        >
          ← Dashboard
        </Link>
        <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
          Conquistas
        </span>
      </header>

      <div className="px-5 max-w-md mx-auto">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Sua estante</h1>
        {data && (
          <p className="text-[12px] text-ink-muted mb-5" data-testid="conquistas-progresso">
            {data.totalDesbloqueadas} de {data.totalCatalogo} desbloqueadas
          </p>
        )}

        {erro && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {erro}
          </div>
        )}

        {desbloqueadas.length > 0 && (
          <section className="mb-6">
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2">
              Desbloqueadas
            </div>
            <div className="space-y-2" data-testid="lista-desbloqueadas">
              {desbloqueadas.map((c) => (
                <ConquistaBadge
                  key={c.codigo}
                  conquista={c}
                  destaque={destaque === c.codigo}
                />
              ))}
            </div>
          </section>
        )}

        {lockeds.length > 0 && (
          <section>
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2">
              Próximas
            </div>
            <div className="space-y-2" data-testid="lista-locked">
              {lockeds.map((c) => (
                <ConquistaBadge key={c.codigo} conquista={c} />
              ))}
            </div>
          </section>
        )}

        {data && desbloqueadas.length === 0 && lockeds.length === 0 && (
          <p className="text-[12px] text-ink-muted">Nenhuma conquista disponível ainda.</p>
        )}
      </div>

      <AlunoTabs />
    </div>
  );
}
