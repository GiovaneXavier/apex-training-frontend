// Tipos espelhados do backend (src/schemas/treino.schemas.js).
// Mantém em sincronia manualmente — sem zod no front por enquanto.

// PR #22 — alinhamento com enum Prisma + Zod do backend.
// HYROX já existia no banco/Zod do schema (drift histórico).
// JIU_JITSU entra agora pelo Sprint 8.
export type Modalidade =
  | 'MUSCULACAO'
  | 'CORRIDA'
  | 'CICLISMO'
  | 'NATACAO'
  | 'TRIATHLON'
  | 'HYROX'
  | 'JIU_JITSU'
  | 'OUTRO';

export type StatusTreino = 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'PULADO';

// ─────────────────────────────────────────────────────────────
// MUSCULAÇÃO
// ─────────────────────────────────────────────────────────────
export type ExercicioPrescrito = {
  series: number;
  reps?: number;
  repsMin?: number;
  repsMax?: number;
  cargaPctRP?: number;
  cargaKg?: number;
  descansoSeg?: number;
  observacao?: string;
};

export type SetRealizado = {
  kg?: number;
  reps?: number;
  rpe?: number;
  observacao?: string;
  registradoEm?: string;
};

export type ExercicioMusc = {
  nome: string;
  videoUrl?: string;
  prescrito: ExercicioPrescrito;
  realizado?: SetRealizado[];
  observacao?: string;
};

export type DetalhesMusculacao = {
  tipo: 'musculacao';
  exercicios: ExercicioMusc[];
  observacao?: string;
};

// ─────────────────────────────────────────────────────────────
// CORRIDA — taxonomia avançada (9 subtipos) + blocos dinâmicos
// ─────────────────────────────────────────────────────────────
export type CorridaSubtipo =
  | 'BASE'           // Base / Rodagem contínua
  | 'RECOVERY'       // Recovery Run
  | 'LONG'           // Longão (Long Run)
  | 'PROGRESSION'    // Progression Run
  | 'INTERVALOS'     // Intervalado (Intervals)
  | 'TEMPO'          // Tempo Run
  | 'THRESHOLD'      // Limiar
  | 'FARTLEK'        // Fartlek
  | 'HILL_REPEATS';  // Hill Repeats

export type CorridaBlocoTipo =
  | 'aquecimento'
  | 'tiro'
  | 'recuperacao'
  | 'volta_calma'
  | 'continuo'
  | 'progressao'
  | 'subida';

export type CorridaBloco = {
  tipo: CorridaBlocoTipo;
  // duração: distância OU tempo (um dos dois)
  distanciaM?: number;
  duracaoSeg?: number;
  // intensidade: ritmo OR FC OR percepção
  ritmoAlvoMinKm?: string; // "5:30"
  fcAlvoMin?: number;
  fcAlvoMax?: number;
  zonaFC?: 1 | 2 | 3 | 4 | 5;
  rpeAlvo?: number; // 1-10
  // repetições do bloco (ex: 8x400m → distancia=400, repeticoes=8)
  repeticoes?: number;
  // descanso entre repetições internas (RI)
  recuperacaoSeg?: number;
  recuperacaoTipo?: 'trote' | 'caminhada' | 'parado';
  observacao?: string;
};

export type DetalhesCorrida = {
  tipo: 'corrida';
  subtipo?: CorridaSubtipo;
  // formato simples (compat com legado)
  distanciaKm?: number;
  ritmoAlvoMinKm?: string;
  fcAlvoMin?: number;
  fcAlvoMax?: number;
  // formato avançado: blocos sequenciais (aquecimento + tiros + recuperação)
  blocos?: CorridaBloco[];
  realizado?: {
    distanciaKm?: number;
    duracaoSeg?: number;
    ritmoMedioMinKm?: string;
    fcMedia?: number;
    stravaActivityId?: string;
  } | null;
  observacao?: string;
};

// ─────────────────────────────────────────────────────────────
// CICLISMO — zonas baseadas em FTP (1-7)
// ─────────────────────────────────────────────────────────────
export type ZonaFTP = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ZONA_FTP_DESCR: Record<ZonaFTP, { nome: string; pct: string; desc: string }> = {
  1: { nome: 'Active Recovery', pct: '<55% FTP',     desc: 'Recuperação ativa' },
  2: { nome: 'Endurance',       pct: '55–75% FTP',   desc: 'Resistência aeróbica' },
  3: { nome: 'Tempo',           pct: '76–90% FTP',   desc: 'Esforço sustentado' },
  4: { nome: 'Threshold',       pct: '91–105% FTP',  desc: 'Limiar de lactato' },
  5: { nome: 'VO2 Max',         pct: '106–120% FTP', desc: 'Potência aeróbica máxima' },
  6: { nome: 'Anaerobic',       pct: '121–150% FTP', desc: 'Capacidade anaeróbica' },
  7: { nome: 'Neuromuscular',   pct: '>150% FTP',    desc: 'Sprint / pico' },
};

export type CiclismoBloco = {
  tipo: 'aquecimento' | 'intervalo' | 'recuperacao' | 'continuo' | 'volta_calma' | 'sprint';
  zonaFTP?: ZonaFTP;
  potenciaAlvoW?: number;
  potenciaAlvoPctFTP?: number; // alvo bruto em % FTP
  cadenciaRpm?: number;
  duracaoSeg?: number;
  distanciaKm?: number;
  repeticoes?: number;
  recuperacaoSeg?: number;
  observacao?: string;
};

export type DetalhesCiclismo = {
  tipo: 'ciclismo';
  ftpW?: number; // FTP do aluno na hora da prescrição
  // Formato simples (legado)
  distanciaKm?: number;
  duracaoMin?: number;
  potenciaAlvoW?: number;
  // Formato avançado
  blocos?: CiclismoBloco[];
  realizado?: {
    distanciaKm?: number;
    duracaoSeg?: number;
    potenciaMediaW?: number;
    potenciaNormalizadaW?: number;
    stravaActivityId?: string;
  } | null;
  observacao?: string;
};

// ─────────────────────────────────────────────────────────────
// NATAÇÃO — CSS (Critical Swim Speed) + séries por bloco
// ─────────────────────────────────────────────────────────────
export type EstiloNado = 'LIVRE' | 'COSTAS' | 'PEITO' | 'BORBOLETA' | 'MEDLEY';

export type NatacaoBloco = {
  tipo: 'aquecimento' | 'principal' | 'tecnica' | 'volta_calma';
  repeticoes: number;
  distanciaM: number;
  estilo?: EstiloNado;
  // Pace: pode ser absoluto OU relativo ao CSS
  paceAlvoSegPor100m?: number;
  paceCssOffsetSeg?: number; // ex: -2 (CSS-2s = mais rápido), +5
  // Descanso: RI fixo OU intervalo total (send-off)
  descansoSeg?: number;
  sendOffSeg?: number; // tempo total por rep (CSS pace + RI)
  equipamento?: ('palmar' | 'pull_buoy' | 'pe_de_pato' | 'snorkel' | 'prancha')[];
  observacao?: string;
};

export type DetalhesNatacao = {
  tipo: 'natacao';
  cssBaseSegPor100m?: number; // CSS base do aluno (segundos por 100m)
  // Formato simples (legado)
  series?: {
    repeticoes: number;
    distanciaM: number;
    estilo?: EstiloNado;
    descansoSeg?: number;
  }[];
  // Formato avançado
  blocos?: NatacaoBloco[];
  realizado?: {
    distanciaTotalM?: number;
    duracaoSeg?: number;
    observacao?: string;
  } | null;
};

export type DetalhesTriathlon = {
  tipo: 'triathlon';
  blocos: (DetalhesNatacao | DetalhesCiclismo | DetalhesCorrida)[];
  observacao?: string;
};

// ─────────────────────────────────────────────────────────────
// HYROX / Híbrido — AMRAP, EMOM, FOR_TIME, estações
// ─────────────────────────────────────────────────────────────
export type HyroxFormato =
  | 'AMRAP'      // As Many Reps As Possible
  | 'EMOM'       // Every Minute On the Minute
  | 'FOR_TIME'   // Tempo total para completar
  | 'TABATA'     // 8 rounds 20s on / 10s off
  | 'INTERVAL'   // Tempo on / off custom
  | 'RUN'        // Bloco de corrida ("compromised running")
  | 'STATION';   // Estação isolada (Sled, Burpee, etc.)

export type HyroxExercicioMov =
  | 'SKI_ERG'
  | 'SLED_PUSH'
  | 'SLED_PULL'
  | 'BURPEE_BROAD_JUMP'
  | 'ROWING'
  | 'FARMERS_CARRY'
  | 'SANDBAG_LUNGES'
  | 'WALL_BALLS'
  | 'RUN'
  | 'BIKE_ERG'
  | 'AIR_SQUAT'
  | 'KETTLEBELL_SWING'
  | 'BOX_JUMP'
  | 'OUTRO';

export type HyroxCarga = {
  // Hyrox classifica cargas em Open / Pro
  open?: number;   // kg para Open
  pro?: number;    // kg para Pro
  unidade?: 'kg' | 'lb';
};

export type HyroxExercicio = {
  movimento: HyroxExercicioMov;
  nome?: string; // override para movimento OUTRO
  // Meta: distância (sled, run) OU repetições (burpee, wall ball)
  distanciaM?: number;
  repeticoes?: number;
  duracaoSeg?: number;
  carga?: HyroxCarga;
  observacao?: string;
};

export type HyroxBloco = {
  formato: HyroxFormato;
  duracaoSeg?: number;          // AMRAP/FOR_TIME/RUN: cap total
  rounds?: number;              // EMOM/TABATA/INTERVAL: rounds
  intervaloOnSeg?: number;      // INTERVAL on
  intervaloOffSeg?: number;     // INTERVAL off / EMOM rest
  distanciaM?: number;          // RUN: distância de corrida
  ritmoAlvoMinKm?: string;      // RUN: pace
  exercicios?: HyroxExercicio[]; // STATION/AMRAP/EMOM/etc
  descansoEntreSeg?: number;    // descanso pós-bloco
  observacao?: string;
};

export type DetalhesHyrox = {
  tipo: 'hyrox';
  blocos: HyroxBloco[];
  observacao?: string;
};

export type DetalhesOutro = {
  tipo: 'outro';
  descricao: string;
  realizado?: string | null;
};

// PR #23 — Jiu-Jitsu.
export type JiuJitsuAquecimento = {
  nome: string;
  duracaoSeg?: number;
  observacao?: string;
};

export type JiuJitsuDrill = {
  movimento: string;
  reps?: number;
  duracaoSeg?: number;
  observacao?: string;
};

export type JiuJitsuRolas = {
  rounds: number;
  tempoRoundSeg: number;
  descansoSeg?: number;
  observacao?: string;
};

export type DetalhesJiuJitsuRealizado = {
  matTimeSegundos?: number;
  roundsCompletos?: number;
  finalizacoesFeitas?: number;
  finalizacoesSofridas?: number;
  /** 1..10 (inteiro). Slider único cobre sono + fadiga + humor. */
  readinessRating?: number;
  observacao?: string;
};

export type DetalhesJiuJitsu = {
  tipo: 'jiu_jitsu';
  aquecimento?: JiuJitsuAquecimento[];
  drills?: JiuJitsuDrill[];
  rolas?: JiuJitsuRolas;
  observacao?: string;
  realizado?: DetalhesJiuJitsuRealizado | null;
};

export type TreinoDetalhes =
  | DetalhesMusculacao
  | DetalhesCorrida
  | DetalhesCiclismo
  | DetalhesNatacao
  | DetalhesTriathlon
  | DetalhesHyrox
  | DetalhesJiuJitsu
  | DetalhesOutro;

// ── Entidade ───────────────────────────────────────────────────
export type Treino = {
  id: string;
  alunoId: string;
  professorId: string | null;
  modalidade: Modalidade;
  titulo: string;
  dataAlvo: string;
  status: StatusTreino;
  detalhes: TreinoDetalhes;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type Prova = {
  id: string;
  alunoId: string;
  modalidade: Modalidade;
  nome: string;
  data: string;
  detalhes: Record<string, unknown>;
  criadoEm: string;
};

// ── Helpers ────────────────────────────────────────────────────
export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  MUSCULACAO: 'Musculação',
  CORRIDA: 'Corrida',
  CICLISMO: 'Ciclismo',
  NATACAO: 'Natação',
  TRIATHLON: 'Triathlon',
  HYROX: 'Hyrox',
  JIU_JITSU: 'Jiu-Jitsu',
  OUTRO: 'Outro',
};

export const STATUS_LABEL: Record<StatusTreino, string> = {
  PENDENTE: 'Pendente',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
  PULADO: 'Pulado',
};

export const CORRIDA_SUBTIPO_LABEL: Record<CorridaSubtipo, string> = {
  BASE: 'Base / Rodagem',
  RECOVERY: 'Recovery Run',
  LONG: 'Longão',
  PROGRESSION: 'Progression',
  INTERVALOS: 'Intervalado',
  TEMPO: 'Tempo Run',
  THRESHOLD: 'Threshold',
  FARTLEK: 'Fartlek',
  HILL_REPEATS: 'Hill Repeats',
};

export const HYROX_MOV_LABEL: Record<HyroxExercicioMov, string> = {
  SKI_ERG: 'SkiErg',
  SLED_PUSH: 'Sled Push',
  SLED_PULL: 'Sled Pull',
  BURPEE_BROAD_JUMP: 'Burpee Broad Jump',
  ROWING: 'Rowing',
  FARMERS_CARRY: "Farmer's Carry",
  SANDBAG_LUNGES: 'Sandbag Lunges',
  WALL_BALLS: 'Wall Balls',
  RUN: 'Run',
  BIKE_ERG: 'BikeErg',
  AIR_SQUAT: 'Air Squat',
  KETTLEBELL_SWING: 'Kettlebell Swing',
  BOX_JUMP: 'Box Jump',
  OUTRO: 'Outro',
};
