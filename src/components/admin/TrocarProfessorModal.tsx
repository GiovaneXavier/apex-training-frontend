import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  listProfessoresAtivos,
  substituirVinculoProfessor,
  type ProfessorAtivo,
} from '@/lib/api/admin';
import { cn } from '@/lib/utils';

// PR #44 — Modal de troca/atribuição de professor.
//
// Reusável tanto pra trocar quanto pra atribuir (aluno sem vínculo).
// `professorAtualNome` é opcional — quando ausente, header diz "Atribuir
// professor" em vez de "Trocar".
//
// Fluxo:
//   1. Mount → fetch /admin/professores/ativos (sem search).
//   2. User digita → debounced 300ms re-fetch.
//   3. User clica no item → selecionado vira state local.
//   4. (opcional) preenche motivo.
//   5. Confirma → PUT /admin/alunos/:alunoId/vinculo-professor.
//   6. Sucesso → toast + onConfirmed(novoProfNome) → caller fecha modal
//      e refresca detalhe do aluno.
//
// Erros de search são silenciosos (lista zera, sem banner) — UX comum
// em autocomplete. Erro do PUT vira toast.error.

type Props = {
  alunoId: string;
  alunoNome: string;
  professorAtualNome?: string | null;
  onClose: () => void;
  onConfirmed: () => void;
};

export function TrocarProfessorModal({
  alunoId, alunoNome, professorAtualNome, onClose, onConfirmed,
}: Props) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ProfessorAtivo[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<ProfessorAtivo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch lista (inicial + debounced em search).
  useEffect(() => {
    const tid = window.setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadingList(true);
      listProfessoresAtivos(search.trim() || undefined, { signal: ctrl.signal })
        .then((data) => { if (!ctrl.signal.aborted) setItems(data); })
        .catch((err) => {
          if (isCancelError(err)) return;
          // silencioso — autocomplete sem feedback ruidoso
          setItems([]);
        })
        .finally(() => { if (!ctrl.signal.aborted) setLoadingList(false); });
    }, 300);
    return () => window.clearTimeout(tid);
  }, [search]);

  async function onConfirmar() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await substituirVinculoProfessor(alunoId, selected.id, motivo.trim() || undefined);
      const msg = res.noop
        ? `${alunoNome} já tinha ${selected.nome} como professor`
        : res.removidos > 0
        ? `${alunoNome} agora tem ${selected.nome} (${res.removidos} vínculo${res.removidos === 1 ? '' : 's'} substituído${res.removidos === 1 ? '' : 's'})`
        : `${selected.nome} atribuído a ${alunoNome}`;
      toast.success(msg);
      onConfirmed();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isTroca = !!professorAtualNome;
  const title = isTroca ? 'Trocar professor' : 'Atribuir professor';

  return (
    <>
      <div
        data-testid="trocar-prof-backdrop"
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 bg-black/50 z-[60]"
      />
      <div
        data-testid="trocar-prof-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trocar-prof-title"
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]',
          'w-[min(440px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)]',
          'rounded-2xl bg-bg border border-app shadow-2xl flex flex-col',
        )}
      >
        <header className="px-5 pt-4 pb-3 border-b border-app">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-1">
                {alunoNome}
              </div>
              <h2 id="trocar-prof-title" className="text-[16px] font-bold tracking-tight">
                {title}
              </h2>
              {isTroca && (
                <p className="text-[11.5px] text-ink-muted mt-0.5">
                  Atual: <span className="text-ink">{professorAtualNome}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="text-ink-muted hover:text-ink text-xl leading-none"
            >
              ×
            </button>
          </div>
        </header>

        <div className="px-5 py-4 flex-1 overflow-y-auto">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email"
            data-testid="trocar-prof-search"
            autoFocus
            className="w-full h-10 px-3 rounded-[10px] bg-surface border border-app text-[13px] focus:outline-none focus:border-ink-muted mb-3"
          />

          {loadingList && items.length === 0 ? (
            <div className="space-y-1.5" data-testid="trocar-prof-skeleton">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-[10px] bg-surface border border-app animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted text-center py-6">
              Nenhum professor ativo encontrado.
            </p>
          ) : (
            <ul className="space-y-1.5" data-testid="trocar-prof-list">
              {items.map((p) => {
                const isSelected = selected?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      data-testid="trocar-prof-item"
                      data-selected={isSelected}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-[10px] border transition-colors',
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-app bg-surface hover:border-ink-muted',
                      )}
                    >
                      <div className="text-[13px] font-semibold text-ink truncate">{p.nome}</div>
                      <div className="text-[11px] text-ink-muted truncate">{p.email}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected && (
            <div className="mt-4">
              <label className="block text-mono text-[9.5px] uppercase tracking-[0.5px] font-bold text-ink-subtle mb-1.5">
                Motivo (opcional)
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da troca para o histórico…"
                rows={3}
                maxLength={500}
                data-testid="trocar-prof-motivo"
                className="w-full px-3 py-2 rounded-[10px] bg-surface border border-app text-[12.5px] focus:outline-none focus:border-ink-muted resize-none"
              />
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-app flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 h-10 rounded-[10px] bg-surface border border-app text-ink-muted text-[12px] font-bold tracking-tight"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!selected || submitting}
            data-testid="trocar-prof-confirmar"
            className="flex-1 h-10 rounded-[10px] bg-accent text-accent-ink text-[12px] font-bold tracking-tight disabled:opacity-50"
          >
            {submitting ? 'Salvando…' : isTroca ? 'Confirmar troca' : 'Atribuir'}
          </button>
        </footer>
      </div>
    </>
  );
}
