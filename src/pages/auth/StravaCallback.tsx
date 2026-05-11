import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { connectStrava, consumeStravaState, verifyStravaState } from '@/lib/api/strava';

export default function StravaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  const code = params.get('code');
  const stateFromUrl = params.get('state');
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
      // Usuário não logado quando voltou — manda pro login.
      navigate('/login', { replace: true });
      return;
    }

    // ── Validação do state (PR #6) ───────────────────────────────
    // consumeStravaState é one-shot: leu, apagou. Replay attempt depois
    // disso retorna null e cai em "state ausente".
    const expectedState = consumeStravaState();
    if (!stateFromUrl || !expectedState) {
      setError('Fluxo OAuth incompleto. Inicie a conexão novamente pelo perfil.');
      return;
    }
    if (!verifyStravaState(stateFromUrl, expectedState)) {
      // Mismatch = possível Account Linking Hijacking. Aborta antes de
      // tocar o backend. Mensagem deliberadamente curta — não dar dicas
      // sobre o formato esperado.
      setError('Falha de validação OAuth. Tente conectar novamente.');
      return;
    }

    connectStrava(code, stateFromUrl)
      .then(() => navigate('/aluno/perfil?strava=ok', { replace: true }))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [code, stateFromUrl, stravaError, user, loading, navigate]);

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
          <div className="text-[14px] text-ink-muted">Validando e salvando seu token de acesso...</div>
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
