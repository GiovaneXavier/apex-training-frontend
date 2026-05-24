import { useAuth } from '@/contexts/AuthContext';

// PR #41c-hotfix — Shell mínimo do cockpit do Admin.
//
// Razão de existir: o role ADMIN já era emitido pelo backend (seed-admin)
// e o redirect pós-login aponta pra cá (dashboardPathFor('/admin/cockpit')),
// mas a rota não existia → 404 em produção.
//
// Conteúdo intencionalmente enxuto: saudação + logout. Funcionalidade real
// (gerenciamento de usuários, métricas globais, override de vínculos)
// entra em sprint dedicada quando o produto pra ADMIN estiver desenhado.
// Aqui o objetivo é desbloquear a navegação e fechar o ciclo de auth.

export default function AdminCockpit() {
  const { user, logout } = useAuth();
  const nome = user?.nome ?? 'Admin';

  async function onLogout() {
    await logout();
    // AuthContext já zera user/cookie; ProtectedRoute redireciona pro /login.
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="px-6 pt-10 pb-6 max-w-3xl mx-auto">
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-2">
          Cockpit · Administração
        </div>
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">
          {nome}
        </h1>
        <p className="text-[13px] text-ink-muted mt-1">
          Acesso de administrador autenticado.
        </p>
      </header>

      <main className="px-6 max-w-3xl mx-auto">
        <section
          data-testid="admin-cockpit-placeholder"
          className="rounded-2xl border border-app bg-surface p-6"
        >
          <h2 className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-3">
            Próximos passos
          </h2>
          <ul className="space-y-2 text-[13px] text-ink-muted">
            <li>· Gerenciamento de usuários (aprovar profissionais pendentes)</li>
            <li>· Métricas globais (alunos ativos, treinos prescritos, MAU)</li>
            <li>· Overrides de vínculo aluno ↔ profissional</li>
            <li>· Auditoria de eventos críticos (logins, mudanças de role)</li>
          </ul>
          <p className="text-[11.5px] text-ink-subtle mt-4">
            Funcionalidades em definição. Esta tela existe pra fechar o ciclo
            de autenticação enquanto o produto ADMIN é desenhado.
          </p>
        </section>

        <button
          type="button"
          onClick={onLogout}
          data-testid="admin-cockpit-logout"
          className="mt-6 inline-flex items-center justify-center h-10 px-5 rounded-[12px] bg-surface border border-app-strong text-ink-muted text-mono text-[11px] uppercase tracking-wider font-bold hover:text-ink hover:border-ink-muted transition-colors"
        >
          Sair
        </button>
      </main>
    </div>
  );
}
