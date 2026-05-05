import { useState } from 'react';
import { apiErrorMessage } from '@/lib/api';
import { reagendarTreino } from '@/lib/api/rotinas';
import { Field } from '@/components/auth/Field';

type Props = {
  treinoId: string;
  dataAtual: string; // ISO
  onReagendado?: (novaDataIso: string) => void;
};

export function ReagendarButton({ treinoId, dataAtual, onReagendado }: Props) {
  const [open, setOpen] = useState(false);
  const [novaData, setNovaData] = useState(() => dataAtual.slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSalvar() {
    if (!novaData) { setError('Selecione uma data'); return; }
    setSaving(true);
    setError(null);
    try {
      const iso = new Date(novaData).toISOString();
      await reagendarTreino(treinoId, iso);
      onReagendado?.(iso);
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-30 px-3 py-1.5 rounded-full bg-surface/90 backdrop-blur border border-app-strong text-[10px] uppercase tracking-wider font-bold text-ink-muted hover:text-ink hover:border-ink-muted transition-colors"
      >
        Reagendar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full md:max-w-sm bg-bg rounded-t-[20px] md:rounded-[20px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Reagendar treino</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-muted text-[20px] leading-none">×</button>
            </div>

            <p className="text-ink-muted text-[12px] mb-3">
              Mova este treino para outro dia/hora. A data original fica registrada.
            </p>

            {error && (
              <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
            )}

            <Field
              label="Nova data e hora"
              type="datetime-local"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
            />

            <button
              type="button"
              onClick={onSalvar}
              disabled={saving}
              className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50 mt-2"
            >
              {saving ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
