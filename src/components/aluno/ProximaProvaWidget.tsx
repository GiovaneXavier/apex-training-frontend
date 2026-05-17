import { FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { criarProva, type CriarProvaInput } from '@/lib/api/provas';
import { MODALIDADE_LABEL, type Modalidade, type Prova } from '@/types/treino';

// PR #21 — widget de contagem regressiva pra prova alvo.
//
// Filosofia de produto: o que mantém o atleta no ritmo é ver o alvo
// caminhando em direção a ele. O widget fica no topo do Dashboard, é
// a primeira coisa que aparece depois do nome. Sem prova cadastrada,
// mostra CTA discreto pra incentivar configurar o alvo.
//
// Buckets de urgência:
//   <= 3 dias  → "modo final" (coral vibrante, dias contados exatos)
//   <= 14 dias → "modo polimento" (coral, dias)
//   <= 8 semanas → "modo bloco" (surface, semanas)
//   > 8 semanas → "modo longo prazo" (surface-muted, semanas + meses)
//
// Tudo no componente — sem decisão lá no Dashboard.

type Props = {
  /** Próxima prova (passada pelo pai pra evitar fetch duplicado). */
  prova: Prova | null;
  /** Callback quando uma nova prova é cadastrada inline pra o pai recarregar. */
  onCriada: (p: Prova) => void;
};

// HYROX existe no enum Prisma mas o schema Zod do backend ainda não o
// expõe pra Prova/Treino — não incluído aqui pra evitar 400. Quando
// alinharem os enums em outro PR, é só adicionar à lista.
const MODALIDADES_PROVA: Modalidade[] = [
  'CORRIDA', 'CICLISMO', 'NATACAO', 'TRIATHLON',
];

export function ProximaProvaWidget({ prova, onCriada }: Props) {
  if (prova) return <ProvaAtivo prova={prova} />;
  return <ProvaVazio onCriada={onCriada} />;
}

function ProvaAtivo({ prova }: { prova: Prova }) {
  const dias = diasAteIso(prova.data);
  const bucket = bucketUrgencia(dias);
  const display = displayCountdown(dias);

  return (
    <div
      className={
        'mx-5 mb-4 p-4 rounded-[16px] ' +
        (bucket.bg) +
        ' transition-colors'
      }
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <div className={'text-mono text-[10px] uppercase tracking-[0.6px] font-bold ' + bucket.label}>
          {MODALIDADE_LABEL[prova.modalidade]} · alvo
        </div>
        <div className={'text-mono text-[10px] uppercase tracking-[0.6px] font-bold ' + bucket.label}>
          {fmtDataCurta(prova.data)}
        </div>
      </div>
      <div className={'text-[18px] font-bold tracking-tight truncate ' + bucket.titulo}>
        {prova.nome}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={'text-mono text-[34px] font-bold tabular leading-none ' + bucket.numero}>
          {display.numero}
        </span>
        <span className={'text-[12px] font-bold uppercase tracking-wider ' + bucket.unidade}>
          {display.unidade}
        </span>
      </div>
    </div>
  );
}

function ProvaVazio({ onCriada }: { onCriada: (p: Prova) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
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
        // Hora local 09:00 — provas geralmente são de manhã. O backend
        // só usa pra ordenação, então não precisa ser exato.
        data: new Date(data + 'T09:00:00').toISOString(),
      };
      const p = await criarProva(input);
      toast.success('Alvo definido — vamos pra cima');
      onCriada(p);
      setAberto(false);
      setNome('');
      setData('');
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
        onClick={() => setAberto(true)}
        className="mx-5 mb-4 w-[calc(100%-2.5rem)] p-3 rounded-[14px] bg-surface border border-dashed border-app-strong text-ink-muted text-[12px] font-medium text-left flex items-center justify-between gap-3"
      >
        <span>
          <span className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle block mb-0.5">
            Sem alvo definido
          </span>
          Configure sua próxima prova pra acompanhar o countdown.
        </span>
        <span className="text-[18px] text-accent">+</span>
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-5 mb-4 p-3 rounded-[14px] bg-surface border border-app">
      <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2.5">
        Cadastrar prova alvo
      </div>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex: Meia de Floripa"
        maxLength={120}
        required
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
          {submitting ? 'Salvando…' : 'Salvar alvo'}
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
// exibe "30" com label "semanas" (bug pego no teste).
function displayCountdown(dias: number): { numero: string; unidade: string } {
  if (dias < 0) return { numero: '—', unidade: 'passou' };
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

function bucketUrgencia(dias: number) {
  if (dias < 0) {
    return {
      bg: 'bg-surface-muted',
      titulo: 'text-ink-muted line-through',
      label: 'text-ink-subtle',
      numero: 'text-ink-subtle',
      unidade: 'text-ink-subtle',
    };
  }
  if (dias <= 3) {
    return {
      bg: 'bg-accent text-accent-ink',
      titulo: '',
      label: 'opacity-80',
      numero: '',
      unidade: 'opacity-90',
    };
  }
  if (dias <= 14) {
    return {
      bg: 'bg-accent/15 border border-accent/40',
      titulo: 'text-ink',
      label: 'text-accent',
      numero: 'text-accent',
      unidade: 'text-accent',
    };
  }
  if (dias <= 56) {
    return {
      bg: 'bg-surface border border-app',
      titulo: 'text-ink',
      label: 'text-ink-subtle',
      numero: 'text-ink',
      unidade: 'text-ink-muted',
    };
  }
  return {
    bg: 'bg-surface-muted',
    titulo: 'text-ink',
    label: 'text-ink-subtle',
    numero: 'text-ink-muted',
    unidade: 'text-ink-subtle',
  };
}
