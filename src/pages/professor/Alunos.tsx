import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import { desvincular, listAlunos, vincularPorEmail, type AlunoVinculado } from '@/lib/api/professor';

export default function ProfAlunos() {
  const [alunos, setAlunos] = useState<AlunoVinculado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    try {
      const list = await listAlunos();
      setAlunos(list);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => { refresh(); }, []);

  async function onVincular(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // PR #14 — backend retorna mensagem genérica (anti-enumeration).
      // O refresh abaixo é quem mostra se o aluno realmente foi vinculado.
      const result = await vincularPorEmail(email.trim());
      toast.info(result.message);
      setEmail('');
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(vinculoId: string) {
    if (!confirm('Remover vínculo com este aluno?')) return;
    try {
      await desvincular(vinculoId);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink pb-20">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/professor/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
      </header>

      <div className="px-5">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Meus alunos</h1>
        <p className="text-ink-muted text-sm mb-5">{alunos?.length ?? 0} vinculados</p>

        <form onSubmit={onVincular} className="mb-6 p-4 rounded-[14px] border border-app bg-surface">
          <div className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono mb-2">
            Vincular novo aluno
          </div>
          <Field
            label="Email do aluno"
            type="email"
            placeholder="aluno@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-[12px] bg-accent text-accent-ink font-bold text-[13px] disabled:opacity-50"
          >
            {submitting ? 'Vinculando...' : 'Vincular'}
          </button>
        </form>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {error}
          </div>
        )}

        {alunos === null && <div className="text-ink-subtle text-sm">Carregando...</div>}
        {alunos !== null && alunos.length === 0 && (
          <div className="px-4 py-8 rounded-[16px] bg-surface border border-app text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-[14px] font-semibold text-ink">Nenhum aluno ainda</div>
            <div className="text-[12px] text-ink-muted mt-1">Vincule pelo email acima.</div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {alunos?.map((a) => (
            <div
              key={a.vinculoId}
              className="flex items-center gap-3 px-3 py-3 rounded-[14px] bg-surface border border-app"
            >
              <div className="size-10 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-[14px] flex-shrink-0">
                {a.nome.slice(0, 1).toUpperCase()}
              </div>
              <Link to={`/professor/aluno/${a.alunoId}`} className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold tracking-tight truncate">{a.nome}</div>
                <div className="text-[11.5px] text-ink-muted truncate">{a.email}</div>
              </Link>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span
                  className={`text-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                    a.treinosPendentes > 0 ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  {a.treinosPendentes} pend.
                </span>
                <button
                  onClick={() => onRemove(a.vinculoId)}
                  className="text-[10px] uppercase tracking-wider text-ink-subtle hover:text-danger"
                >
                  remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
