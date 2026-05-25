import type { AuditLogEntry } from '@/lib/api/admin';
import { AUDIT_ACTION_LABELS } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

// PR #45 — Drawer de detalhe do audit log.
//
// Mostra todos os campos do log + payload JSON formatado. Read-only
// (audit não pode ser editado — append-only sagrado).
//
// JSON tree é renderizado como <pre> formatado com 2 spaces — não
// trouxemos `react-json-view` ou similar pra evitar dep nova
// (consistência com a política do projeto).

type Props = {
  log: AuditLogEntry | null;
  onClose: () => void;
};

export function AuditDetalheDrawer({ log, onClose }: Props) {
  if (!log) return null;
  const meta = AUDIT_ACTION_LABELS[log.action] ?? { label: log.action, group: 'Outros' };

  return (
    <>
      <div
        data-testid="audit-drawer-backdrop"
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 bg-black/40 z-40"
      />
      <aside
        data-testid="audit-drawer"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-bg border-l border-app',
          'overflow-y-auto flex flex-col',
        )}
      >
        <header className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-app">
          <div className="min-w-0">
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-1">
              {meta.group}
            </div>
            <h2 className="text-[18px] font-bold tracking-tight">
              {meta.label}
            </h2>
            <p className="text-[11px] text-ink-muted mt-1 text-mono break-all">
              {log.action}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-ink-muted hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4 flex-1 space-y-5">
          <section className="space-y-2">
            <SectionTitle>Quando</SectionTitle>
            <Linha label="Data/hora" value={formatarDataExtensa(log.criadoEm)} />
          </section>

          <section className="space-y-2">
            <SectionTitle>Quem</SectionTitle>
            <Linha label="Nome" value={log.ator.nome} />
            <Linha label="Email" value={log.ator.email} />
            <Linha label="Role" value={log.ator.role} />
            <Linha label="User ID" value={log.atorUserId} mono />
          </section>

          <section className="space-y-2">
            <SectionTitle>O quê</SectionTitle>
            <Linha label="Entity type" value={log.entityType} mono />
            <Linha label="Entity ID" value={log.entityId} mono />
          </section>

          {(log.ip || log.userAgent) && (
            <section className="space-y-2">
              <SectionTitle>Onde</SectionTitle>
              {log.ip && <Linha label="IP" value={log.ip} mono />}
              {log.userAgent && <Linha label="User-Agent" value={log.userAgent} mono small />}
            </section>
          )}

          <section className="space-y-2">
            <SectionTitle>Payload</SectionTitle>
            {log.payload && Object.keys(log.payload).length > 0 ? (
              <pre
                data-testid="audit-drawer-payload"
                className="text-mono text-[11px] bg-surface border border-app p-3 rounded-[10px] overflow-x-auto whitespace-pre-wrap leading-snug"
              >
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            ) : (
              <p className="text-[12px] text-ink-subtle italic">Sem payload adicional.</p>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
      {children}
    </h3>
  );
}

function Linha({
  label, value, mono, small,
}: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-ink-subtle text-mono text-[10.5px] uppercase tracking-wider font-bold shrink-0">
        {label}
      </span>
      <span
        className={cn(
          'text-ink text-right break-all',
          mono && 'text-mono',
          small && 'text-[10.5px]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatarDataExtensa(iso: string): string {
  const d = new Date(iso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const ano = d.getFullYear();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${dia}/${mes}/${ano} ${h}:${m}:${s}`;
}
