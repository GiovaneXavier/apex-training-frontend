import type { AuditLogEntry } from '@/lib/api/admin';
import { AUDIT_ACTION_LABELS } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

// PR #45 — Linha da tabela de audit log.
//
// Mantida burra (igual UsuarioRow do Bloco B): render puro + onClick
// pro drawer. Visual codificado por grupo de action (vínculo/usuário/auth).

type Props = {
  log: AuditLogEntry;
  onClick: () => void;
  selected?: boolean;
};

const GROUP_COLORS: Record<string, string> = {
  'Vínculos': 'bg-accent/10 text-accent',
  'Usuários': 'bg-warn-bg text-warn',
  'Autenticação': 'bg-surface text-ink-muted',
};

export function AuditLogRow({ log, onClick, selected }: Props) {
  const meta = AUDIT_ACTION_LABELS[log.action] ?? { label: log.action, group: 'Outros' };
  const groupClass = GROUP_COLORS[meta.group] ?? 'bg-app text-ink-muted';

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="audit-row"
      data-log-id={log.id}
      data-action={log.action}
      className={cn(
        'w-full text-left px-4 py-3 rounded-[12px] border bg-surface transition-colors',
        'flex items-center gap-3',
        selected ? 'border-accent/60' : 'border-app hover:border-ink-muted',
      )}
    >
      <span
        className={cn(
          'shrink-0 text-mono text-[9.5px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded',
          groupClass,
        )}
      >
        {meta.group}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold tracking-tight text-ink truncate">
          {meta.label}
        </div>
        <div className="text-[11px] text-ink-muted truncate mt-0.5">
          <span className="text-ink">{log.ator.nome}</span>
          {' · '}
          <span className="text-mono">
            {log.entityType}/{shortenId(log.entityId)}
          </span>
        </div>
      </div>
      <span className="text-mono text-[10px] text-ink-subtle shrink-0">
        {formatarDataHora(log.criadoEm)}
      </span>
    </button>
  );
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes} ${h}:${m}`;
}

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 6) + '…' + id.slice(-4);
}
