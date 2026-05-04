import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { connectStrava } from '@/lib/api/strava';

export default function StravaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  const code = params.get('code');
  const stravaError = params.get('error');

  useEffect(() => {
    if (loading) return;
    if (ranRef.current) return;
    ranRef.current = true;

    if (stravaError) {
      setError(`Strava recusou: ${stravaError}`);
      return;
    }
    if (!code) {
      setError('Código de autorização ausente');
      return;
    }
    if (!user) {
      // Usuário não está logado — manda para login preservando o code (raro)
      navigate('/login', { replace: true });
      return;
    }

    connectStrava(code)
      .then(() => navigate('/aluno/perfil?strava=ok', { replace: true }))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [code, stravaError, user, loading, navigate]);

  // Se aluno e callback OK, redirecionamos via efeito; se não-aluno, manda pro dashboard certo
  if (!loading && user && user.role !== 'ALUNO') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center px-6 text-center">
      {!error ? (
        <>
          <div className="size-14 rounded-full bg-accent text-accent-ink flex items-center justify-center text-2xl mb-4 animate-pulse">
            ⚡
          </div>
          <div className="text-mono text-[11px] uppercase tracking-[0.7px] font-bold text-ink-subtle mb-1">
            Conectando ao Strava
          </div>
          <div className="text-[14px] text-ink-muted">Salvando seu token de acesso...</div>
        </>
      ) : (
        <>
          <div className="size-14 rounded-full bg-danger-bg text-danger flex items-center justify-center text-2xl mb-4">
            ⚠️
          </div>
          <div className="text-mono text-[11px] uppercase tracking-[0.7px] font-bold text-danger mb-1">
            Erro na conexão
          </div>
          <div className="text-[14px] text-ink-muted max-w-xs mb-5">{error}</div>
          <Link
            to="/aluno/perfil"
            className="text-mono text-[11px] uppercase tracking-wider font-bold text-accent"
          >
            Voltar ao perfil →
          </Link>
        </>
      )}
    </div>
  );
}
