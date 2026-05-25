import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  aprovarAdminUser,
  atualizarStatusAdminUser,
  getAdminUserDetalhe,
  removerVinculoProfessor,
  type AdminUserDetalhe,
  type AdminUserDetalheAluno,
  type AdminUserDetalheNutri,
  type AdminUserDetalheProfessor,
  type AdminUserListItem,
} from '@/lib/api/admin';
import { useAuth } from '@/contexts/AuthContext';
import { TrocarProfessorModal } from '@/components/admin/TrocarProfessorModal';
import { cn } from '@/lib/utils';

// PR #43 — Drawer rico de detalhe + ações de aprovação/desativação.
//
// Layout: overlay full-height à direita, fecha clicando no backdrop ou
// botão X. Suspense leve (carrega detalhe ao montar). Ações exibidas
// condicionalmente conforme regras do backend (D2/D3):
//   - "Aprovar" só pra PROFESSOR/NUTRI inativo.
//   - "Desativar" oculto pro próprio user logado (auto-disable bloqueio).
//   - "Desativar" oculto pra outros ADMINs (cross-admin bloqueio).
//
// Mutações são fire-and-await: aguarda backend, sucesso atualiza linha
// na lista via callback (replaceItem/removeItem) — não usa optimistic
// porque as ações são raras e o feedback de transição "carregando" é
// útil pra confirmar que a operação foi registrada (vs optimistic
// silencioso que confunde admin).

type Props = {
  userId: string | null;
  onClose: () => void;
  onUserUpdated: (user: AdminUserListItem) => void;
};

export function UsuarioDetalheDrawer({ userId, onClose, onUserUpdated }: Props) {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<AdminUserDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [trocarOpen, setTrocarOpen] = useState(false);

  // Re-fetch detalhe on demand (após confirmar troca/remoção de vínculo).
  function refetchDetalhe() {
    if (!userId) return;
    getAdminUserDetalhe(userId)
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)));
  }

  async function onRemoverVinculo() {
    // Backend recebe Aluno.id (não User.id). detalhe.alunoId é exposto
    // pelo Bloco B (atualizado pra suportar Bloco C).
    const alunoId =
      data?.user.role === 'ALUNO' && 'alunoId' in data.detalhe
        ? data.detalhe.alunoId
        : null;
    if (!alunoId) return;
    const ok = window.confirm(
      'Remover o vínculo com o professor atual? O aluno fica sem coach até nova atribuição.',
    );
    if (!ok) return;
    setMutating(true);
    try {
      await removerVinculoProfessor(alunoId);
      toast.success('Vínculo removido');
      refetchDetalhe();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setMutating(false);
    }
  }

  useEffect(() => {
    if (!userId) {
      setData(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    getAdminUserDetalhe(userId, { signal: ctrl.signal })
      .then((d) => { if (!ctrl.signal.aborted) setData(d); })
      .catch((err) => {
        if (isCancelError(err)) return;
        setError(apiErrorMessage(err));
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [userId]);

  if (!userId) return null;

  async function onAprovar() {
    if (!userId) return;
    setMutating(true);
    try {
      const res = await aprovarAdminUser(userId);
      toast.success(`${res.user.nome} aprovado`);
      onUserUpdated(res.user);
      // Atualiza header local também pra refletir botão sumindo.
      setData((cur) => (cur ? { ...cur, user: { ...cur.user, ativo: true } } : cur));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setMutating(false);
    }
  }

  async function onToggleStatus(novoAtivo: boolean) {
    if (!userId) return;
    if (!novoAtivo) {
      const ok = window.confirm(
        'Desativar este usuário? A conta perde acesso imediatamente, mas histórico fica preservado.',
      );
      if (!ok) return;
    }
    setMutating(true);
    try {
      const res = await atualizarStatusAdminUser(userId, novoAtivo);
      toast.success(novoAtivo ? 'Usuário ativado' : 'Usuário desativado');
      onUserUpdated(res.user);
      setData((cur) => (cur ? { ...cur, user: { ...cur.user, ativo: novoAtivo } } : cur));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setMutating(false);
    }
  }

  const user = data?.user;
  const isSelf = authUser?.id === userId;
  const isOtherAdmin = user?.role === 'ADMIN' && !isSelf;
  const podeAprovar =
    user && !user.ativo && (user.role === 'PROFESSOR' || user.role === 'NUTRICIONISTA');
  const podeDesativar = user?.ativo && !isSelf && !isOtherAdmin;
  const podeReativar = user && !user.ativo && !podeAprovar; // já-rejeitado/ALUNO inativo

  return (
    <>
      <div
        data-testid="admin-drawer-backdrop"
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 bg-black/40 z-40"
      />
      <aside
        data-testid="admin-drawer"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-bg border-l border-app',
          'overflow-y-auto flex flex-col',
        )}
      >
        <header className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-app">
          <div className="min-w-0">
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-1">
              Detalhe do usuário
            </div>
            <h2 className="text-[18px] font-bold tracking-tight truncate">
              {user?.nome ?? 'Carregando…'}
            </h2>
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

        <div className="px-5 py-4 flex-1">
          {loading && <SkeletonDrawer />}
          {error && (
            <div className="px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px]">
              {error}
            </div>
          )}
          {data && user && (
            <>
              <DadosBase user={user} />
              <DetalheVariant
                data={data}
                onTrocarProfClick={() => setTrocarOpen(true)}
                onRemoverProfClick={() => void onRemoverVinculo()}
                mutating={mutating}
              />
            </>
          )}
        </div>

        {data && user && (podeAprovar || podeDesativar || podeReativar) && (
          <footer className="px-5 py-4 border-t border-app flex gap-2">
            {podeAprovar && (
              <button
                type="button"
                onClick={onAprovar}
                disabled={mutating}
                data-testid="admin-drawer-aprovar"
                className="flex-1 h-10 rounded-[10px] bg-accent text-accent-ink text-[12px] font-bold tracking-tight disabled:opacity-50"
              >
                {mutating ? 'Aprovando…' : 'Aprovar conta'}
              </button>
            )}
            {podeReativar && (
              <button
                type="button"
                onClick={() => onToggleStatus(true)}
                disabled={mutating}
                data-testid="admin-drawer-reativar"
                className="flex-1 h-10 rounded-[10px] bg-accent text-accent-ink text-[12px] font-bold tracking-tight disabled:opacity-50"
              >
                {mutating ? 'Ativando…' : 'Reativar'}
              </button>
            )}
            {podeDesativar && (
              <button
                type="button"
                onClick={() => onToggleStatus(false)}
                disabled={mutating}
                data-testid="admin-drawer-desativar"
                className="flex-1 h-10 rounded-[10px] bg-surface border border-danger/40 text-danger text-[12px] font-bold tracking-tight disabled:opacity-50"
              >
                {mutating ? 'Desativando…' : 'Desativar'}
              </button>
            )}
          </footer>
        )}
      </aside>

      {/* PR #44 — Modal de troca/atribuição de professor.
          Renderizado fora do <aside> pra z-index ficar acima do drawer
          + backdrop próprio cobrir o drawer durante a interação. */}
      {trocarOpen &&
        data?.user.role === 'ALUNO' &&
        'alunoId' in data.detalhe && (
          <TrocarProfessorModal
            alunoId={data.detalhe.alunoId}
            alunoNome={data.user.nome}
            professorAtualNome={data.detalhe.vinculoProfessor?.nome ?? null}
            onClose={() => setTrocarOpen(false)}
            onConfirmed={() => {
              setTrocarOpen(false);
              refetchDetalhe();
            }}
          />
        )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  ALUNO: 'Aluno',
  PROFESSOR: 'Professor',
  NUTRICIONISTA: 'Nutricionista',
  ADMIN: 'Administrador',
};

function DadosBase({ user }: { user: AdminUserDetalhe['user'] }) {
  return (
    <section className="space-y-2.5 mb-5 pb-5 border-b border-app">
      <Linha label="Email" value={user.email} />
      <Linha label="Role" value={ROLE_LABEL[user.role] ?? user.role} />
      <Linha label="Status" value={user.ativo ? 'Ativa' : 'Inativa'} />
      <Linha label="Criado em" value={formatarDataExtensa(user.criadoEm)} />
    </section>
  );
}

function DetalheVariant({
  data, onTrocarProfClick, onRemoverProfClick, mutating,
}: {
  data: AdminUserDetalhe;
  onTrocarProfClick: () => void;
  onRemoverProfClick: () => void;
  mutating: boolean;
}) {
  const { user, detalhe } = data;
  if (user.role === 'ALUNO') {
    return (
      <DetalheAlunoSection
        d={detalhe as AdminUserDetalheAluno}
        onTrocarProfClick={onTrocarProfClick}
        onRemoverProfClick={onRemoverProfClick}
        mutating={mutating}
      />
    );
  }
  if (user.role === 'PROFESSOR') return <DetalheProfessorSection d={detalhe as AdminUserDetalheProfessor} />;
  if (user.role === 'NUTRICIONISTA') return <DetalheNutriSection d={detalhe as AdminUserDetalheNutri} />;
  return null;
}

function DetalheAlunoSection({
  d, onTrocarProfClick, onRemoverProfClick, mutating,
}: {
  d: AdminUserDetalheAluno;
  onTrocarProfClick: () => void;
  onRemoverProfClick: () => void;
  mutating: boolean;
}) {
  if (!d || !('treinosCount' in d)) {
    return <EmptyHint>Perfil ALUNO sem dados adicionais.</EmptyHint>;
  }
  const temProf = !!d.vinculoProfessor;
  return (
    <section className="space-y-2.5">
      <SectionTitle>Dados do aluno</SectionTitle>

      {/* Vínculo professor + ações inline (PR #44 — Bloco C) */}
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="text-ink-subtle text-mono text-[10.5px] uppercase tracking-wider font-bold shrink-0">
          Professor vinculado
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ink truncate">{d.vinculoProfessor?.nome ?? '—'}</span>
          <button
            type="button"
            onClick={onTrocarProfClick}
            disabled={mutating}
            data-testid="drawer-prof-trocar"
            className="text-mono text-[9.5px] uppercase tracking-wider font-bold text-accent hover:opacity-80 disabled:opacity-40"
          >
            {temProf ? 'Trocar' : 'Atribuir'}
          </button>
          {temProf && (
            <button
              type="button"
              onClick={onRemoverProfClick}
              disabled={mutating}
              data-testid="drawer-prof-remover"
              className="text-mono text-[9.5px] uppercase tracking-wider font-bold text-danger hover:opacity-80 disabled:opacity-40"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <Linha label="Nutricionista vinculado" value={d.vinculoNutri?.nome ?? '—'} />
      <Linha label="Treinos no histórico" value={d.treinosCount.toString()} />
      {d.ultimoTreino && (
        <Linha
          label="Último treino"
          value={`${d.ultimoTreino.titulo} · ${formatarDataExtensa(d.ultimoTreino.dataAlvo)}`}
        />
      )}
    </section>
  );
}

function DetalheProfessorSection({ d }: { d: AdminUserDetalheProfessor }) {
  if (!d || !('alunosCount' in d)) {
    return <EmptyHint>Perfil PROFESSOR sem dados adicionais.</EmptyHint>;
  }
  return (
    <section className="space-y-3">
      <SectionTitle>Operação do professor</SectionTitle>
      <Linha label="Alunos vinculados" value={d.alunosCount.toString()} />
      <Linha label="Treinos prescritos (lifetime)" value={d.treinosPrescritosCount.toString()} />
      {d.alunosTop5.length > 0 && (
        <div>
          <div className="text-mono text-[9.5px] uppercase tracking-[0.5px] text-ink-subtle font-bold mb-1.5">
            Top {d.alunosTop5.length} alunos
          </div>
          <ul className="space-y-1.5">
            {d.alunosTop5.map((a) => (
              <li key={a.id} className="text-[12px] text-ink flex items-center justify-between gap-2">
                <span className="truncate">{a.nome}</span>
                <span className="text-ink-subtle text-[10.5px] text-mono shrink-0">
                  {a.ultimaAtividade ? formatarDataExtensa(a.ultimaAtividade) : 'sem atividade'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DetalheNutriSection({ d }: { d: AdminUserDetalheNutri }) {
  if (!d || !('alunosCount' in d)) {
    return <EmptyHint>Perfil NUTRICIONISTA sem dados adicionais.</EmptyHint>;
  }
  return (
    <section className="space-y-3">
      <SectionTitle>Operação do nutricionista</SectionTitle>
      <Linha label="Alunos vinculados (aceitos)" value={d.alunosCount.toString()} />
      {d.alunosTop5.length > 0 && (
        <div>
          <div className="text-mono text-[9.5px] uppercase tracking-[0.5px] text-ink-subtle font-bold mb-1.5">
            Top {d.alunosTop5.length} alunos
          </div>
          <ul className="space-y-1.5">
            {d.alunosTop5.map((a) => (
              <li key={a.id} className="text-[12px] text-ink truncate">{a.nome}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-ink-subtle text-mono text-[10.5px] uppercase tracking-wider font-bold shrink-0">
        {label}
      </span>
      <span className="text-ink text-right truncate">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1">
      {children}
    </h3>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-ink-subtle italic">{children}</p>;
}

function SkeletonDrawer() {
  return (
    <div className="space-y-3" data-testid="admin-drawer-skeleton">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-4 bg-app rounded animate-pulse" />
      ))}
    </div>
  );
}

function formatarDataExtensa(iso: string): string {
  const d = new Date(iso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}
