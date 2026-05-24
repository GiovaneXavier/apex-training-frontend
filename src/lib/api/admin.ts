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
