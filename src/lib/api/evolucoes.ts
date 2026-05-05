import { api } from '@/lib/api';

export type AvaliadorTipo = 'ALUNO' | 'NUTRICIONISTA' | 'PROFESSOR';

export type Protocolo =
  | 'ALUNO_FITA'
  | 'ISAK_RESTRITO'
  | 'JP3' | 'JP4' | 'JP7'
  | 'DURNIN_WOMERSLEY'
  | 'OUTRO';

export const PROTOCOLO_LABEL: Record<Protocolo, string> = {
  ALUNO_FITA: 'Auto-avaliação (fita)',
  ISAK_RESTRITO: 'ISAK Restrito',
  JP3: 'Jackson-Pollock 3 dobras',
  JP4: 'Jackson-Pollock 4 dobras',
  JP7: 'Jackson-Pollock 7 dobras',
  DURNIN_WOMERSLEY: 'Durnin & Womersley',
  OUTRO: 'Outro',
};

export type MedidasAluno = {
  tipo: 'ALUNO_FITA';
  cinturaCm?: number;
  quadrilCm?: number;
  bracoCm?: number;
  coxaCm?: number;
  pescocoCm?: number;
};

export type Dobras = Partial<{
  triceps: number; subescapular: number; biceps: number;
  axilarMedia: number; suprailiaca: number; abdominal: number;
  coxa: number; panturrilha: number; peitoral: number;
}>;

export type Perimetros = Partial<{
  braco: number; cintura: number; quadril: number; coxa: number;
  panturrilha: number; pescoco: number; antebraco: number; bracoContraido: number;
}>;

export type Diametros = Partial<{ umeral: number; femoral: number; bistiloide: number }>;

export type MedidasISAK = {
  tipo: 'ISAK_RESTRITO';
  dobras?: Dobras;
  perimetros?: Perimetros;
  diametros?: Diametros;
};

export type Medidas = MedidasAluno | MedidasISAK | { tipo: 'OUTRO'; [k: string]: any };

export type Fotos = {
  frente?: string;
  lado?: string;
  costas?: string;
  extras?: string[];
};

export type Evolucao = {
  id: string;
  alunoId: string;
  avaliadorId: string | null;
  avaliadorTipo: AvaliadorTipo;
  dataAvaliacao: string;
  pesoKg: number | null;
  alturaCm: number | null;
  imc: number | null;
  percentualGordura: number | null;
  protocolo: Protocolo | null;
  medidas: Medidas | null;
  fotos: Fotos | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type EvolucaoInput = {
  alunoId?: string;
  dataAvaliacao?: string;
  pesoKg?: number;
  alturaCm?: number;
  protocolo?: Protocolo;
  sexoBio?: 'M' | 'F';
  idadeAnos?: number;
  medidas?: Medidas;
  fotos?: Fotos;
  observacoes?: string;
};

export async function listEvolucoes(filters: { alunoId?: string; desde?: string; ate?: string; limit?: number } = {}): Promise<Evolucao[]> {
  const { data } = await api.get<Evolucao[]>('/evolucoes', { params: filters });
  return data;
}

export async function getEvolucao(id: string): Promise<Evolucao> {
  const { data } = await api.get<Evolucao>(`/evolucoes/${id}`);
  return data;
}

export async function createEvolucao(input: EvolucaoInput): Promise<Evolucao> {
  const { data } = await api.post<Evolucao>('/evolucoes', input);
  return data;
}

export async function updateEvolucao(id: string, input: Partial<EvolucaoInput>): Promise<Evolucao> {
  const { data } = await api.put<Evolucao>(`/evolucoes/${id}`, input);
  return data;
}

export async function deleteEvolucao(id: string): Promise<void> {
  await api.delete(`/evolucoes/${id}`);
}

export async function previewBodyFat(input: Partial<EvolucaoInput>): Promise<{ imc: number | null; percentualGordura: number | null }> {
  const { data } = await api.post<{ imc: number | null; percentualGordura: number | null }>('/evolucoes/preview', input);
  return data;
}
