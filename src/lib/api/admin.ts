import { api } from '@/lib/api';
import type { Role } from '@/contexts/AuthContext';

// PR #42 — Contrato espelhando GET /api/admin/metrics
// (apex-training-backend/src/services/adminMetrics.service.js).
//
// `porRole` é Record<Role, number> com TODAS as 4 keys sempre presentes
// (backend normaliza ausentes pra 0 → UI nunca renderiza undefined).
//
// `taxaAdesao` pode ser null quando prescritosSemana=0 — frontend
// distingue "sem dados" (—) de "0%" (zero adesão real).

export type AdminMetrics = {
  geradoEm: string;
  usuarios: {
    total: number;
    ativos: number;
    porRole: Record<Role, number>;
    pendentes: {
      professores: number;
      nutris: number;
    };
  };
  treinos: {
    prescritosSemana: number;
    concluidosSemana: number;
    taxaAdesao: number | null;
    totalHistorico: number;
  };
  alertas: {
    alunosSemAtividade7d: number;
    alunosSemProfessor: number;
    alunosSemAlvo: number;
  };
};

export async function getAdminMetrics(opts: { signal?: AbortSignal } = {}): Promise<AdminMetrics> {
  const { data } = await api.get<AdminMetrics>('/admin/metrics', { signal: opts.signal });
  return data;
}

// ──────────────────────────────────────────────────────────────────────
// PR #43 — Bloco B: Gerenciamento de usuários
// ──────────────────────────────────────────────────────────────────────

// Item da listagem (select compacto do backend).
export type AdminUserListItem = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  criadoEm: string;
};

export type AdminUsersListResponse = {
  usuarios: AdminUserListItem[];
  proximoCursor: string | null;
  temMais: boolean;
};

export type AdminUsersListFilters = {
  limit?: number;
  cursor?: string | null;
  search?: string;
  role?: Role;
  ativo?: boolean;
};

// Detalhe — variant por role do alvo. Campos opcionais cobrem o shape
// `{}` que o backend devolve quando o user não tem perfil correspondente.
export type AdminUserDetalheAluno = {
  // Aluno.id (não User.id) — usado pelo Bloco C (PUT vinculo-professor).
  alunoId: string;
  vinculoProfessor: { id: string; nome: string } | null;
  vinculoNutri: { id: string; nome: string } | null;
  treinosCount: number;
  ultimoTreino: {
    dataAlvo: string;
    status: string;
    titulo: string;
  } | null;
};

export type AdminUserDetalheProfessor = {
  alunosCount: number;
  treinosPrescritosCount: number;
  alunosTop5: Array<{
    id: string;
    nome: string;
    ultimaAtividade: string | null;
  }>;
};

export type AdminUserDetalheNutri = {
  alunosCount: number;
  alunosTop5: Array<{ id: string; nome: string }>;
};

// Discriminated union pelo role do user no envelope. Frontend faz narrow
// via `user.role` antes de acessar `detalhe`.
export type AdminUserDetalhe = {
  user: {
    id: string;
    nome: string;
    email: string;
    role: Role;
    ativo: boolean;
    avatarUrl: string | null;
    criadoEm: string;
    atualizadoEm: string;
  };
  detalhe:
    | AdminUserDetalheAluno
    | AdminUserDetalheProfessor
    | AdminUserDetalheNutri
    | Record<string, never>;
};

export async function listAdminUsers(
  filters: AdminUsersListFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<AdminUsersListResponse> {
  const params: Record<string, string | number> = {};
  if (filters.limit) params.limit = filters.limit;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.search) params.search = filters.search;
  if (filters.role) params.role = filters.role;
  if (typeof filters.ativo === 'boolean') params.ativo = filters.ativo ? 'true' : 'false';
  const { data } = await api.get<AdminUsersListResponse>('/admin/users', {
    params,
    signal: opts.signal,
  });
  return data;
}

export async function getAdminUserDetalhe(
  id: string,
  opts: { signal?: AbortSignal } = {},
): Promise<AdminUserDetalhe> {
  const { data } = await api.get<AdminUserDetalhe>(`/admin/users/${id}`, {
    signal: opts.signal,
  });
  return data;
}

export type AdminUserMutationResponse = {
  success: true;
  user: AdminUserListItem;
  noop?: boolean;
};

export async function aprovarAdminUser(id: string): Promise<AdminUserMutationResponse> {
  const { data } = await api.patch<AdminUserMutationResponse>(`/admin/users/${id}/aprovar`);
  return data;
}

export async function atualizarStatusAdminUser(
  id: string,
  ativo: boolean,
): Promise<AdminUserMutationResponse> {
  const { data } = await api.patch<AdminUserMutationResponse>(`/admin/users/${id}/status`, { ativo });
  return data;
}

// ──────────────────────────────────────────────────────────────────────
// PR #44 — Bloco C: Overrides de vínculo aluno↔professor
// ──────────────────────────────────────────────────────────────────────

export type ProfessorAtivo = {
  id: string;   // Professor.id (não User.id) — uso direto no PUT do vínculo
  nome: string;
  email: string;
};

export async function listProfessoresAtivos(
  search: string | undefined,
  opts: { signal?: AbortSignal; limit?: number } = {},
): Promise<ProfessorAtivo[]> {
  const params: Record<string, string | number> = { limit: opts.limit ?? 20 };
  if (search) params.search = search;
  const { data } = await api.get<{ professores: ProfessorAtivo[] }>('/admin/professores/ativos', {
    params,
    signal: opts.signal,
  });
  return data.professores;
}

export type SubstituirVinculoResponse = {
  success: true;
  noop: boolean;
  vinculo: { id: string; alunoId: string; professorId: string; criadoEm?: string };
  removidos: number;
};

export async function substituirVinculoProfessor(
  alunoId: string,
  professorId: string,
  motivo?: string,
): Promise<SubstituirVinculoResponse> {
  const body: { professorId: string; motivo?: string } = { professorId };
  if (motivo) body.motivo = motivo;
  const { data } = await api.put<SubstituirVinculoResponse>(
    `/admin/alunos/${alunoId}/vinculo-professor`,
    body,
  );
  return data;
}

export type RemoverVinculoResponse = {
  success: true;
  noop: boolean;
  removidos: number;
};

export async function removerVinculoProfessor(
  alunoId: string,
  motivo?: string,
): Promise<RemoverVinculoResponse> {
  const body = motivo ? { motivo } : {};
  const { data } = await api.delete<RemoverVinculoResponse>(
    `/admin/alunos/${alunoId}/vinculo-professor`,
    { data: body },
  );
  return data;
}

// ──────────────────────────────────────────────────────────────────────
// PR #45 — Bloco D: Audit log viewer
// ──────────────────────────────────────────────────────────────────────

// Actions canônicas — espelha src/lib/auditLog.js (AUDIT_ACTIONS).
// Manter sincronizado com o backend. String union pra dropdown tipado.
export type AuditAction =
  | 'vinculo.criar_prof'
  | 'vinculo.quebrar_prof'
  | 'user.aprovar'
  | 'user.ativar'
  | 'user.desativar'
  | 'auth.login'
  | 'auth.login_falhou'
  | 'auth.logout';

export type AuditLogEntry = {
  id: string;
  action: AuditAction | string;  // string fallback pra forward compat
  entityType: string;
  entityId: string;
  payload: Record<string, unknown> | null;
  atorUserId: string;
  ip: string | null;
  userAgent: string | null;
  criadoEm: string;
  ator: {
    id: string;
    nome: string;
    email: string;
    role: Role;
  };
};

export type AuditLogListResponse = {
  logs: AuditLogEntry[];
  proximoCursor: string | null;
  temMais: boolean;
};

export type AuditLogFilters = {
  action?: string;
  entityType?: string;
  entityId?: string;
  atorUserId?: string;
  desde?: string;
  ate?: string;
  limit?: number;
  cursor?: string | null;
};

export async function listAuditLogs(
  filters: AuditLogFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<AuditLogListResponse> {
  const params: Record<string, string | number> = {};
  if (filters.limit) params.limit = filters.limit;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.action) params.action = filters.action;
  if (filters.entityType) params.entityType = filters.entityType;
  if (filters.entityId) params.entityId = filters.entityId;
  if (filters.atorUserId) params.atorUserId = filters.atorUserId;
  if (filters.desde) params.desde = filters.desde;
  if (filters.ate) params.ate = filters.ate;
  const { data } = await api.get<AuditLogListResponse>('/admin/audit', {
    params,
    signal: opts.signal,
  });
  return data;
}

// Catálogo display-friendly de actions — usado pelo filter dropdown.
// Label PT-BR + categoria visual.
export const AUDIT_ACTION_LABELS: Record<string, { label: string; group: string }> = {
  'vinculo.criar_prof': { label: 'Vínculo criado', group: 'Vínculos' },
  'vinculo.quebrar_prof': { label: 'Vínculo quebrado', group: 'Vínculos' },
  'user.aprovar': { label: 'Usuário aprovado', group: 'Usuários' },
  'user.ativar': { label: 'Usuário ativado', group: 'Usuários' },
  'user.desativar': { label: 'Usuário desativado', group: 'Usuários' },
  'auth.login': { label: 'Login', group: 'Autenticação' },
  'auth.login_falhou': { label: 'Login falhou', group: 'Autenticação' },
  'auth.logout': { label: 'Logout', group: 'Autenticação' },
};
