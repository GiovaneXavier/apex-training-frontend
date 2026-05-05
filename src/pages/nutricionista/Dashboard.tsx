import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiErrorMessage } from '@/lib/api';
import {
  desvincularNutri,
  listAlunosNutri,
  solicitarAcesso,
  type AlunoVinculadoNutri,
} from '@/lib/api/nutri';
import { relativeDay } from '@/lib/format';

export default function NutriDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [alunos, setAlunos] = useState<AlunoVinculadoNutri[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    try { setAlunos(await listAlunosNutri()); }
    catch (err) { setError(apiErrorMessage(err)); }
  }

  useEffect(() => { refresh(); }, []);

  async function onSolicitar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await solicitarAcesso(email.trim());
      setEmail('');
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remover vínculo com este aluno?')) return;
    try { await desvincularNutri(id); await refresh(); } catch (err) { setError(apiErrorMessage(err)); }
  }

  const aceitos = alunos.filter((a) => a.aceitoPeloAluno);
  const pendentes = alunos.filter((a) => !a.aceitoPeloAluno);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <div>
          <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">Nutricionista</div>
          <h1 className="text-[22px] font-bold tracking-tight">Olá, {user?.nome.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={toggle} className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-app-strong text-ink-muted">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button onClick={logout} className="text-[10px] uppercase tracking-wider text-ink-subtle font-semibold">Sair</button>
        </div>
      </header>

      <div className="px-5">
        <form onSubmit={onSolicitar} className="mb-6 p-4 rounded-[14px] border border-app bg-surface">
          <div className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono mb-2">
            Solicitar acesso a aluno
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
            {submitting ? 'Enviando...' : 'Solicitar'}
          </button>
        </form>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        {pendentes.length > 0 && (
          <Section title={`Aguardando aceite (${pendentes.length})`}>
            <div className="flex flex-col gap-2">
              {pendentes.map((a) => (
                <div key={a.vinculoId} className="px-3 py-3 rounded-[14px] bg-surface border border-app flex items-center gap-3">
                  <div className="size-9 rounded-full bg-warn-bg text-warn flex items-center justify-center font-bold text-[13px]">
                    {a.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold truncate">{a.nome}</div>
                    <div className="text-[11px] text-ink-muted truncate">{a.email}</div>
                  </div>
                  <span className="text-mono text-[10px] uppercase tracking-wider font-bold text-warn px-2 py-0.5 rounded-full bg-warn-bg">
                    pendente
                  </span>
                  <button onClick={() => onRemove(a.vinculoId)} className="text-[10px] uppercase tracking-wider text-ink-subtle hover:text-danger">
                    cancelar
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title={`Vinculados (${aceitos.length})`}>
          {aceitos.length === 0 ? (
            <div className="px-4 py-8 rounded-[16px] bg-surface border border-app text-center">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-[14px] font-semibold text-ink">Nenhum aluno aceito ainda</div>
              <div className="text-[12px] text-ink-muted mt-1">Solicite acesso pelo email acima.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {aceitos.map((a) => (
                <Link
                  key={a.vinculoId}
                  to={`/nutri/aluno/${a.alunoId}`}
                  className="px-3 py-3 rounded-[14px] bg-surface border border-app flex items-center gap-3 hover:border-ink-muted transition-colors"
                >
                  <div className="size-10 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-[14px]">
                    {a.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold tracking-tight truncate">{a.nome}</div>
                    <div className="text-[11.5px] text-ink-muted truncate">
                      vinculado {relativeDay(a.desde)}
                    </div>
                  </div>
                  <span className="text-ink-muted">→</span>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono mb-3">{title}</h2>
      {children}
    </div>
  );
}
