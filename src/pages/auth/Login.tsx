import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import AuthShell from '@/components/auth/AuthShell';
import { Field } from '@/components/auth/Field';
import { dashboardPathFor, useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from || dashboardPathFor(user.role)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email.trim(), senha);
      navigate(from || dashboardPathFor(u.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre para acessar seus treinos.">
      <form onSubmit={onSubmit} noValidate>
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
          autoComplete="current-password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

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
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="text-center mt-5 text-[13px] text-ink-muted">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="text-ink font-semibold hover:underline">
            Criar conta
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
