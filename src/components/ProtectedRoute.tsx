import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, dashboardPathFor, type Role } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  roles?: Role[];
};

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-ink-muted text-mono text-sm uppercase tracking-wider">
        carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={dashboardPathFor(user.role)} replace />;
  }

  return <>{children}</>;
}
