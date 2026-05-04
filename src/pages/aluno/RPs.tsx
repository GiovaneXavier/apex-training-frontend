import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { listRPs, type RPGroup } from '@/lib/api/rps';
import { relativeDay } from '@/lib/format';
import { MODALIDADE_LABEL } from '@/types/treino';

export default function AlunoRPs() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<RPGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.aluno?.id) return;
    let cancelled = false;
    listRPs(user.aluno.id, { limit: 500 })
      .then((d) => !cancelled && setGrupos(d.grouped))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => { cancelled = true; };
  }, [user?.aluno?.id]);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
      </header>

      <div className="px-5">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Recordes Pessoais</h1>
        <p className="text-ink-muted text-sm mb-5">{grupos?.length ?? 0} exercícios com registro</p>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        {grupos === null && !error && <div className="text-ink-subtle text-sm">Carregando...</div>}

        {grupos !== null && grupos.length === 0 && (
          <div className="px-4 py-8 rounded-[16px] bg-surface border border-app text-center">
            <div className="text-3xl mb-2">🏋️</div>
            <div className="text-[14px] font-semibold text-ink">Sem RPs ainda</div>
            <div className="text-[12px] text-ink-muted mt-1">
              Conclua um treino de musculação e seu primeiro RP é registrado.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {grupos?.map((g) => {
            const isOpen = expandido === g.exercicio;
            return (
              <div key={g.exercicio} className="rounded-[14px] bg-surface border border-app overflow-hidden">
                <button
                  onClick={() => setExpandido(isOpen ? null : g.exercicio)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
                      {MODALIDADE_LABEL[g.modalidade]}
                    </div>
                    <div className="text-[14px] font-semibold tracking-tight truncate">{g.exercicio}</div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className="text-mono text-[18px] font-bold tabular text-accent leading-none">
                      {g.top.valor}{g.top.unidade}
                    </div>
                    {g.top.reps !== null && (
                      <div className="text-mono text-[10px] text-ink-subtle font-bold uppercase tracking-wider mt-0.5">
                        × {g.top.reps} reps
                      </div>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-app">
                    <div className="px-4 py-2 bg-surface-muted text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono">
                      Por nº de repetições
                    </div>
                    {g.porReps.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-2.5 border-t border-app">
                        <div className="text-mono text-[12px] text-ink font-bold tabular">
                          {r.reps ?? '—'} reps
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-mono text-[14px] font-bold tabular text-ink">
                            {r.valor}{r.unidade}
                          </span>
                          <span className="text-mono text-[10px] uppercase text-ink-subtle font-bold tracking-wider">
                            {relativeDay(r.dataRecorde)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
