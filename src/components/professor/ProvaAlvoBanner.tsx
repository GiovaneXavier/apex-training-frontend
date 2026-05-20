import { useEffect, useRef, useState } from 'react';

import { getProvaAlvo } from '@/lib/api/provas';
import { cn } from '@/lib/utils';
import { MODALIDADE_LABEL, type Prova } from '@/types/treino';

import {
  diasAteIso,
  displayCountdown,
  faseMacrociclo,
  fmtDataCurta,
  type FaseMacrociclo,
} from '@/lib/macrociclo';

// PR #39 (Sprint 14) — Contexto do treinador na tela de prescrição.
//
// Espelha a fase do macro-ciclo (Race A do aluno) na visão do coach.
// Simetria de vocabulário entre as duas pontas — atleta vê "TAPER" no
// Dashboard, coach vê "TAPER" no Prescrever. Mesmo idioma, mesma cor,
// mesma fronteira temporal.
//
// DESIGN PASSIVO consciente (decisão do PR #39):
// O banner NÃO bloqueia nem alerta sobre prescrição "fora da fase"
// (ex: long run alto em race-week). Razão: regra simplista cria
// falso positivo ("Long Recovery Run" em race-week é legítimo —
// volume baixo, intensidade baixa) e mina a confiança do coach.
//
// Validação semântica multi-modal fica pra IA do Coach em PR futuro,
// rodando server-side com baseline do atleta. Banner expõe:
//
//   1. `onFaseChange?(fase, dias)` — gancho pro pai assinar e plugar
//      no validator do form quando IA do Coach entrar. Não-quebrante:
//      omitido = banner permanece puramente informativo.
//
//   2. Atributos `data-fase` e `data-dias` no root — selectors estáveis
//      pra QA e telemetria futura.
//
// Sem alunoId selecionado, banner não renderiza nada (null).

type Props = {
  /** AlunoId selecionado no form. Vazio = nada renderiza. */
  alunoId: string;
  /** Hook futuro pra IA do Coach: avisar pai sobre transição de fase. */
  onFaseChange?: (fase: FaseMacrociclo | null, diasRestantes: number | null, alvo: Prova | null) => void;
  className?: string;
};

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; alunoId: string }
  | { kind: 'sem-alvo'; alunoId: string }
  | { kind: 'ready'; alunoId: string; alvo: Prova; dias: number; fase: FaseMacrociclo }
  | { kind: 'erro'; alunoId: string };

export function ProvaAlvoBanner({ alunoId, onFaseChange, className }: Props) {
  // Lazy init: se já temos alunoId no mount, começa em loading direto
  // (evita 1 render extra em idle/null que confundia react-testing-library
  // waitFor — banner aparecia tarde demais).
  const [state, setState] = useState<State>(() =>
    alunoId ? { kind: 'loading', alunoId } : { kind: 'idle' },
  );

  // PR #39 (Gemini review) — Latest Ref Pattern pro `onFaseChange`.
  // Antes mantíamos fora das deps do useEffect com a convenção
  // "caller usa useCallback se muda". Convenção frágil: se o pai
  // re-renderizar passando uma fn não-memoizada, o useEffect usava
  // a versão do último mount (stale closure). Ref sempre aponta pro
  // último valor → o efeito permanece dependente APENAS de `alunoId`
  // (não refetch ao redefinir o callback).
  const onFaseChangeRef = useRef(onFaseChange);
  onFaseChangeRef.current = onFaseChange;

  useEffect(() => {
    if (!alunoId) {
      setState({ kind: 'idle' });
      onFaseChangeRef.current?.(null, null, null);
      return;
    }

    const ctrl = new AbortController();
    setState({ kind: 'loading', alunoId });

    getProvaAlvo(alunoId, { signal: ctrl.signal })
      .then((alvo) => {
        if (ctrl.signal.aborted) return;
        if (!alvo) {
          setState({ kind: 'sem-alvo', alunoId });
          onFaseChangeRef.current?.(null, null, null);
          return;
        }
        const dias = diasAteIso(alvo.data);
        const fase = faseMacrociclo(dias);
        setState({ kind: 'ready', alunoId, alvo, dias, fase });
        onFaseChangeRef.current?.(fase, dias, alvo);
      })
      .catch((err) => {
        if (ctrl.signal.aborted || (err as { code?: string })?.code === 'ERR_CANCELED') return;
        setState({ kind: 'erro', alunoId });
        onFaseChangeRef.current?.(null, null, null);
      });

    return () => ctrl.abort();
    // Deps intencionalmente só `alunoId` — `onFaseChange` é lido via ref
    // pra evitar stale closure SEM re-disparar fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  // Loading discreto: skeleton fino na mesma altura do banner final
  // pra não pular layout.
  if (state.kind === 'loading') {
    return (
      <div
        data-testid="prova-alvo-banner"
        data-state="loading"
        className={cn(
          'p-3 rounded-[12px] bg-surface border border-app animate-pulse',
          className,
        )}
      >
        <div className="h-3 w-32 bg-app rounded mb-2" />
        <div className="h-4 w-48 bg-app rounded" />
      </div>
    );
  }

  // Sem alvo: mensagem neutra (não é erro). Treinador segue prescrevendo
  // mesmo sem Race A. CTA pra "configurar alvo" não cabe aqui — coach
  // não cria prova; quem cria é o aluno. Apenas informa o estado.
  if (state.kind === 'sem-alvo') {
    return (
      <div
        data-testid="prova-alvo-banner"
        data-state="sem-alvo"
        className={cn(
          'p-3 rounded-[12px] bg-surface border border-dashed border-app-strong',
          className,
        )}
      >
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle mb-0.5">
          Sem prova alvo
        </div>
        <div className="text-[12px] text-ink-muted">
          Aluno ainda não definiu uma Race A. Sugira definir pra ancorar o macro-ciclo.
        </div>
      </div>
    );
  }

  // Erro silencioso: feature secundária; banner some, prescrição segue.
  if (state.kind === 'erro' || state.kind === 'idle') return null;

  // Estado feliz: alvo carregado.
  const { alvo, dias, fase } = state;
  const skin = visualPorFaseProfessor(fase);
  const display = displayCountdown(dias);

  return (
    <div
      data-testid="prova-alvo-banner"
      data-state="ready"
      data-fase={fase}
      data-dias={dias}
      className={cn(
        'p-3 rounded-[12px] transition-colors',
        skin.bg,
        className,
      )}
      role="status"
      aria-label={`Prova alvo: ${alvo.nome} em ${dias} dias, fase ${fase}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className={'text-mono text-[10px] uppercase tracking-[0.7px] font-bold ' + skin.label}>
          Race A · {MODALIDADE_LABEL[alvo.modalidade]}
        </div>
        <div className="flex items-center gap-2">
          {skin.badge && (
            <span
              data-testid="prova-alvo-banner-badge"
              className={cn(
                'text-mono text-[9px] uppercase tracking-[0.8px] font-bold px-1.5 py-0.5 rounded',
                skin.badgeClass,
                fase === 'race-week' && 'animate-pulse',
              )}
            >
              {skin.badge}
            </span>
          )}
          <span className={'text-mono text-[10px] uppercase tracking-[0.7px] font-bold ' + skin.label}>
            {fmtDataCurta(alvo.data)}
          </span>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className={'text-[14px] font-bold tracking-tight truncate ' + skin.titulo}>
          {skin.icone && <span className="mr-1.5">{skin.icone}</span>}
          {alvo.nome}
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span
            data-testid="prova-alvo-banner-dias"
            className={'text-mono text-[18px] font-bold tabular leading-none ' + skin.numero}
          >
            {display.numero}
          </span>
          <span className={'text-[10px] font-bold uppercase tracking-wider ' + skin.unidade}>
            {display.unidade}
          </span>
        </div>
      </div>

      {(alvo.local || alvo.alvoTempo) && (
        <div className={'text-[11px] mt-1 truncate ' + skin.label}>
          {alvo.local && <span>{alvo.local}</span>}
          {alvo.local && alvo.alvoTempo && <span className="mx-1.5">·</span>}
          {alvo.alvoTempo && <span>alvo {alvo.alvoTempo}</span>}
        </div>
      )}
    </div>
  );
}

// Skin do banner (versão compacta, separada da skin do widget herói).
// Coach precisa de informação densa, não impacto visual — paletas mais
// sóbrias que no Dashboard do atleta.
type SkinBanner = {
  bg: string;
  titulo: string;
  label: string;
  numero: string;
  unidade: string;
  badge: string | null;
  badgeClass: string;
  icone: string | null;
};

function visualPorFaseProfessor(fase: FaseMacrociclo): SkinBanner {
  switch (fase) {
    case 'post':
      return {
        bg: 'bg-surface-muted border border-app',
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
        bg: 'bg-accent/20 border border-accent/60',
        titulo: 'text-ink',
        label: 'text-accent',
        numero: 'text-accent',
        unidade: 'text-accent',
        badge: 'É HOJE',
        badgeClass: 'bg-accent text-accent-ink',
        icone: '🏆',
      };
    case 'race-week':
      return {
        bg: 'bg-accent/20 border border-accent/60',
        titulo: 'text-ink',
        label: 'text-accent',
        numero: 'text-accent',
        unidade: 'text-accent',
        badge: 'RACE WEEK',
        badgeClass: 'bg-accent text-accent-ink',
        icone: '🏁',
      };
    case 'taper':
      return {
        bg: 'bg-accent/10 border border-accent/40',
        titulo: 'text-ink',
        label: 'text-accent',
        numero: 'text-accent',
        unidade: 'text-accent',
        badge: 'TAPER',
        badgeClass: 'bg-accent/30 text-accent',
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

// ─────────────────────────────────────────────────────────────────────
// PONTO DE EXTENSÃO — PR futuro (IA do Coach)
//
// Quando a validação semântica de prescrição vs fase entrar, o caller
// do banner pode assinar:
//
//   const [faseAtual, setFaseAtual] = useState<FaseMacrociclo | null>(null);
//   const [diasAlvo, setDiasAlvo] = useState<number | null>(null);
//
//   <ProvaAlvoBanner
//     alunoId={alunoId}
//     onFaseChange={(fase, dias) => {
//       setFaseAtual(fase);
//       setDiasAlvo(dias);
//     }}
//   />
//
// E no submit do form, antes de salvar, fazer:
//
//   const aviso = await validarPrescricaoVsFase({
//     fase: faseAtual,
//     dias: diasAlvo,
//     modalidade,
//     volume: calcVolumePrescrito(detalhes),
//     baselineAluno: ...,
//   });
//   if (aviso?.bloqueante) { ... }
//
// O endpoint POST /api/coach/validar-prescricao roda no backend com
// histórico do aluno + heurísticas multi-modal. Banner permanece puro
// — sem regras de negócio aqui.
// ─────────────────────────────────────────────────────────────────────
