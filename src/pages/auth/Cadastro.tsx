import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/auth/Field';
import { dashboardPathFor, useAuth, type Role } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const ROLES: { id: Role; title: string; subtitle: string; emoji: string }[] = [
  { id: 'ALUNO',         title: 'Aluno',          subtitle: 'Quero treinar e acompanhar meus RPs', emoji: '🏃' },
  { id: 'PROFESSOR',     title: 'Professor',      subtitle: 'Vou prescrever treinos para alunos',  emoji: '🏋️' },
  { id: 'NUTRICIONISTA', title: 'Nutricionista',  subtitle: 'Acompanho a rotina dos atletas',      emoji: '🥦' },
];

export default function Cadastro() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>('ALUNO');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [crn, setCrn] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={dashboardPathFor(user.role)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await register({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        role,
        crn: role === 'NUTRICIONISTA' ? crn.trim() || undefined : undefined,
        bio: role === 'PROFESSOR' ? bio.trim() || undefined : undefined,
      });
      navigate(dashboardPathFor(u.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Escolha seu perfil para começar.">
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-5 grid grid-cols-1 gap-2">
          {ROLES.map((r) => {
            const active = r.id === role;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={cn(
                  'flex items-center gap-3 text-left px-3.5 py-3 rounded-[14px] border transition-colors',
                  active
                    ? 'bg-accent text-accent-ink border-accent shadow-card'
                    : 'bg-surface border-app-strong text-ink hover:border-ink-muted',
                )}
              >
                <span className="text-2xl leading-none">{r.emoji}</span>
                <span className="flex-1">
                  <span className="block text-[14px] font-bold tracking-tight">{r.title}</span>
                  <span className={cn('block text-[11.5px] mt-0.5', active ? 'text-accent-ink/80' : 'text-ink-muted')}>
                    {r.subtitle}
                  </span>
                </span>
                <span
                  className={cn(
                    'size-4 rounded-full border-2 flex-shrink-0',
                    active ? 'bg-accent-ink border-accent-ink' : 'border-app-strong',
                  )}
                />
              </button>
            );
          })}
        </div>

        <Field
          label="Nome"
          autoComplete="name"
          placeholder="Como devemos te chamar"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          minLength={2}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          hint="Pelo menos 8 caracteres."
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={8}
        />

        {role === 'NUTRICIONISTA' && (
          <Field
            label="CRN (opcional)"
            placeholder="CRN-3 12345"
            value={crn}
            onChange={(e) => setCrn(e.target.value)}
          />
        )}
        {role === 'PROFESSOR' && (
          <Field
            label="Bio (opcional)"
            placeholder="Especialidade, certificações..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        )}

        {error && (
          <div className="mb-3 px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-[12px] bg-accent text-accent-ink font-bold text-[14px] tracking-wide disabled:opacity-50 transition-opacity"
        >
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </button>

        <div className="text-center mt-5 text-[13px] text-ink-muted">
          Já tem conta?{' '}
          <Link to="/login" className="text-ink font-semibold hover:underline">
            Entrar
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
