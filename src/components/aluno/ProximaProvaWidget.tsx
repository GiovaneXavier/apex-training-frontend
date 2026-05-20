import { FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { criarProva, type CriarProvaInput } from '@/lib/api/provas';
import { MODALIDADE_LABEL, type Modalidade, type Prova } from '@/types/treino';

// PR #21 — widget de contagem regressiva pra prova alvo.
// PR #38 (Sprint 14) — atualizado pra macro-ciclo Race A/B/C.
//
// Filosofia de produto: o que mantém o atleta no ritmo é ver o alvo
// caminhando em direção a ele. Widget é o elemento herói do Dashboard,
// posicionado acima do StreakCard e WeeklyCheckinCard. Sem alvo
// cadastrado, mostra CTA discreto pra incentivar configurar.
//
// Escalada de 5 fases (não binário taper/normal) — atleta processa
// proximidade em curvas, não em saltos. Cada fase reflete o vocabulário
// de coaching de endurance e dá marcadores psicológicos progressivos:
//
//   base      (> 30d)   → countdown neutro, sem destaque
//   peak      (15–30d)  → borda accent sutil
//   taper     (8–14d)   → borda + badge "TAPER" + bg tingido
//   race-week (1–7d)    → bg accent sólido + badge "RACE WEEK" + 🏁
//   race-day  (0d)      → 🏆 "Hoje é o dia!"
//   post      (data < hoje, não arquivada) → CTA "Registrar resultado"

type Props = {
  /** Race A ativa do aluno (consumida via getProvaAlvo). Null = sem alvo. */
  prova: Prova | null;
  /** Callback após cadastro inline pra o pai recarregar. */
  onCriada: (p: Prova) => void;
};

const MODALIDADES_PROVA: Modalidade[] = ['CORRIDA', 'CICLISMO', 'NATACAO', 'TRIATHLON'];

export type FaseMacrociclo = 'base' | 'peak' | 'taper' | 'race-week' | 'race-day' | 'post';

// Função pura — testável em isolamento. Não vira hook (sem estado/efeito).
export function faseMacrociclo(dias: number): FaseMacrociclo {
  if (dias < 0) return 'post';
  if (dias === 0) return 'race-day';
  if (dias <= 7) return 'race-week';
  if (dias <= 14) return 'taper';
  if (dias <= 30) return 'peak';
  return 'base';
}

export function ProximaProvaWidget({ prova, onCriada }: Props) {
  if (prova) return <ProvaAtivo prova={prova} />;
  return <ProvaVazio onCriada={onCriada} />;
}

function ProvaAtivo({ prova }: { prova: Prova }) {
  const dias = diasAteIso(prova.data);
  const fase = faseMacrociclo(dias);
  const skin = visualPorFase(fase);
  const display = displayCountdown(dias);

  return (
    <div
      data-testid="prova-alvo-countdown"
      data-fase={fase}
      className={'mx-5 mb-4 p-4 rounded-[16px] transition-colors ' + skin.bg}
    >
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <div className={'text-mono text-[10px] uppercase tracking-[0.6px] font-bold ' + skin.label}>
          {MODALIDADE_LABEL[prova.modalidade]} · alvo
        </div>
        <div className="flex items-center gap-2">
          {skin.badge && (
            <span
              data-testid="prova-alvo-badge"
              className={'text-mono text-[9px] uppercase tracking-[0.8px] font-bold px-1.5 py-0.5 rounded ' + skin.badgeClass + (fase === 'race-week' ? ' animate-pulse' : '')}
            >
              {skin.badge}
            </span>
          )}
          <div className={'text-mono text-[10px] uppercase tracking-[0.6px] font-bold ' + skin.label}>
            {fmtDataCurta(prova.data)}
          </div>
        </div>
      </div>

      <div className={'text-[18px] font-bold tracking-tight truncate ' + skin.titulo}>
        {skin.icone && <span className="mr-1.5">{skin.icone}</span>}
        {prova.nome}
      </div>

      {prova.local && (
        <div className={'text-[11px] mt-0.5 truncate ' + skin.label}>
          {prova.local}
        </div>
      )}

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          data-testid="prova-alvo-numero"
          className={'text-mono text-[34px] font-bold tabular leading-none ' + skin.numero}
        >
          {display.numero}
        </span>
        <span className={'text-[12px] font-bold uppercase tracking-wider ' + skin.unidade}>
          {display.unidade}
        </span>
        {prova.alvoTempo && fase !== 'post' && fase !== 'race-day' && (
          <span className={'ml-auto text-mono text-[11px] uppercase tracking-wider ' + skin.label}>
            alvo {prova.alvoTempo}
          </span>
        )}
      </div>
    </div>
  );
}

function ProvaVazio({ onCriada }: { onCriada: (p: Prova) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [local, setLocal] = useState('');
  const [modalidade, setModalidade] = useState<Modalidade>('CORRIDA');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !data) return;
    setSubmitting(true);
    try {
      const input: CriarProvaInput = {
        modalidade,
        nome: nome.trim(),
        // 09:00 local — provas costumam ser de manhã. Backend usa só pra ordenação.
        data: new Date(data + 'T09:00:00').toISOString(),
        // PR #38 — cadastrar pelo Dashboard já marca como Race A (alvo principal).
        // Se atleta quiser secundárias, edita depois ou cria via /provas direto.
        prioridade: 'A',
        local: local.trim() || undefined,
      };
      const p = await criarProva(input);
      toast.success('Alvo definido — vamos pra cima');
      onCriada(p);
      setAberto(false);
      setNome('');
      setData('');
      setLocal('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        data-testid="prova-alvo-cta-vazio"
        onClick={() => setAberto(true)}
        className="mx-5 mb-4 w-[calc(100%-2.5rem)] p-3 rounded-[14px] bg-surface border border-dashed border-app-strong text-ink-muted text-[12px] font-medium text-left flex items-center justify-between gap-3"
      >
        <span>
          <span className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle block mb-0.5">
            Sem alvo definido
          </span>
          Defina sua Race A pra acompanhar o countdown.
        </span>
        <span className="text-[18px] text-accent">+</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="prova-alvo-form"
      className="mx-5 mb-4 p-3 rounded-[14px] bg-surface border border-app"
    >
      <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2.5">
        Race A · alvo principal
      </div>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex: Meia de Floripa"
        maxLength={120}
        required
        className="w-full h-10 px-3 mb-2 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
      />
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Local (ex: Florianópolis, SC)"
        maxLength={200}
        className="w-full h-10 px-3 mb-2 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
      />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
          className="h-10 px-3 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
        />
        <select
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value as Modalidade)}
          className="h-10 px-3 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
        >
          {MODALIDADES_PROVA.map((m) => (
            <option key={m} value={m}>{MODALIDADE_LABEL[m]}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={submitting}
          className="flex-1 h-10 rounded-[10px] bg-surface border border-app-strong text-ink-muted text-[12px] font-bold uppercase tracking-wider"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-10 rounded-[10px] bg-accent text-accent-ink text-[12px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {submitting ? 'Salvando…' : 'Definir alvo'}
        </button>
      </div>
    </form>
  );
}

// ─── Helpers de tempo ─────────────────────────────────────────────────

function diasAteIso(iso: string): number {
  // Mede DIAS-CIVIS de hoje até o dia da prova (não horas). Garante
  // que "hoje" mostre 0 mesmo se a prova for às 23h, e que "amanhã"
  // mostre 1 mesmo se for às 01h.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

// Decide o número exibido + sua unidade. Garante coerência: nunca
// exibe "30" com label "semanas" (bug pego no teste do PR #21).
function displayCountdown(dias: number): { numero: string; unidade: string } {
  if (dias < 0) return { numero: '—', unidade: 'passou' };
  if (dias === 0) return { numero: '0', unidade: 'é hoje' };
  if (dias <= 14) {
    return {
      numero: String(dias),
      unidade: dias === 1 ? 'dia restante' : 'dias restantes',
    };
  }
  const semanas = Math.round(dias / 7);
  return {
    numero: String(semanas),
    unidade: semanas === 1 ? 'semana restante' : 'semanas restantes',
  };
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${MESES_CURTO[d.getMonth()]}`;
}

// Skin = bundle de Tailwind classes + badge + ícone por fase do macrociclo.
type Skin = {
  bg: string;
  titulo: string;
  label: string;
  numero: string;
  unidade: string;
  badge: string | null;
  badgeClass: string;
  icone: string | null;
};

function visualPorFase(fase: FaseMacrociclo): Skin {
  switch (fase) {
    case 'post':
      return {
        bg: 'bg-surface-muted',
        titulo: 'text-ink-muted',
        label: 'text-ink-subtle',
        numero: 'text-ink-subtle',
        unidade: 'text-ink-subtle',
        badge: 'CONCLUÍDA',
        badgeClass: 'text-ink-subtle bg-app',
        icone: null,
      };
    case 'race-day':
      return {
        bg: 'bg-accent text-accent-ink',
        titulo: '',
        label: 'opacity-80',
        numero: '',
        unidade: 'opacity-90',
        badge: 'É HOJE',
        badgeClass: 'bg-accent-ink/15 text-accent-ink',
        icone: '🏆',
      };
    case 'race-week':
      return {
        bg: 'bg-accent text-accent-ink',
        titulo: '',
        label: 'opacity-80',
        numero: '',
        unidade: 'opacity-90',
        badge: 'RACE WEEK',
        badgeClass: 'bg-accent-ink/15 text-accent-ink',
        icone: '🏁',
      };
    case 'taper':
      return {
        bg: 'bg-accent/15 border border-accent/40',
        titulo: 'text-ink',
        label: 'text-accent',
        numero: 'text-accent',
        unidade: 'text-accent',
        badge: 'TAPER',
        badgeClass: 'bg-accent/20 text-accent',
        icone: null,
      };
    case 'peak':
      return {
        bg: 'bg-surface border border-accent/30',
        titulo: 'text-ink',
        label: 'text-accent',
        numero: 'text-ink',
        unidade: 'text-ink-muted',
        badge: null,
        badgeClass: '',
        icone: null,
      };
    case 'base':
    default:
      return {
        bg: 'bg-surface border border-app',
        titulo: 'text-ink',
        label: 'text-ink-subtle',
        numero: 'text-ink',
        unidade: 'text-ink-muted',
        badge: null,
        badgeClass: '',
        icone: null,
      };
  }
}
