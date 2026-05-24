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
