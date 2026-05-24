import type { AdminUserListItem } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

// PR #43 — Linha da tabela de usuários do cockpit admin.
//
// Mantida burra: render puro + onClick pro drawer. Toda lógica de
// mutação (aprovar/desativar) vive no drawer pra não duplicar guards e
// reduzir re-render em update otimista.

const ROLE_LABEL: Record<string, string> = {
  ALUNO: 'Aluno',
  PROFESSOR: 'Professor',
  NUTRICIONISTA: 'Nutricionista',
  ADMIN: 'Admin',
};

type Props = {
  user: AdminUserListItem;
  onClick: () => void;
  selected?: boolean;
};

export function UsuarioRow({ user, onClick, selected }: Props) {
  const pendente = !user.ativo && (user.role === 'PROFESSOR' || user.role === 'NUTRICIONISTA');
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="admin-user-row"
      data-user-id={user.id}
      className={cn(
        'w-full text-left px-4 py-3 rounded-[12px] border bg-surface transition-colors',
        'flex items-center gap-3',
        selected
          ? 'border-accent/60'
          : 'border-app hover:border-ink-muted',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold tracking-tight truncate text-ink">
            {user.nome}
          </span>
          {pendente && (
            <span
              data-testid="admin-user-pendente-badge"
              className="text-mono text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-warn-bg text-warn"
            >
              Pendente
            </span>
          )}
          {!user.ativo && !pendente && (
            <span className="text-mono text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-app text-ink-muted">
              Inativo
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-ink-muted truncate mt-0.5">
          {user.email} · {ROLE_LABEL[user.role] ?? user.role}
        </div>
      </div>
      <span className="text-mono text-[10px] text-ink-subtle shrink-0">
        {formatarDataCurta(user.criadoEm)}
      </span>
    </button>
  );
}

function formatarDataCurta(iso: string): string {
  const d = new Date(iso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}`;
}
