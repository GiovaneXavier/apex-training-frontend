import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AlunoTabs } from '@/components/AlunoTabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage, isCancelError } from '@/lib/api';
import { listRPs, type RPGroup, type RecordePessoal } from '@/lib/api/rps';
import { relativeDay } from '@/lib/format';
import { MODALIDADE_LABEL } from '@/types/treino';

// PR #19 — Sala de Troféus com 2 abas.
//
// Cargas (musculação): formato kg × reps. Mantém a UI antiga.
// Endurance (pace): 4 cards canônicos sempre visíveis (5K/10K/21.1K/42.2K).
//   Pace gravado em s/km no backend; UI formata MM:SS /km.
//   Card "vazio" aparece com placeholder pra dar senso de meta —
//   atleta vê os 4 cartões cinzas e sabe quais distâncias o app
//   detecta.

type AbaId = 'cargas' | 'endurance';

const DISTANCIAS_CANONICAS = ['5K', '10K', '21.1K', '42.2K'] as const;
type DistanciaCanonica = typeof DISTANCIAS_CANONICAS[number];

export default function AlunoRPs() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<RPGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaId>('cargas');

  useEffect(() => {
    if (!user?.aluno?.id) return;
    const ctrl = new AbortController();
    listRPs(user.aluno.id, { limit: 500 }, { signal: ctrl.signal })
      .then((d) => setGrupos(d.grouped))
      .catch((err) => { if (!isCancelError(err)) setError(apiErrorMessage(err)); });
    return () => ctrl.abort();
  }, [user?.aluno?.id]);

  const { gruposCargas, gruposEndurance } = useMemo(() => {
    if (!grupos) return { gruposCargas: [], gruposEndurance: [] };
    return {
      gruposCargas: grupos.filter((g) => g.modalidade === 'MUSCULACAO'),
      gruposEndurance: grupos.filter((g) => g.top.metrica === 'pace'),
    };
  }, [grupos]);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
      </header>

      <div className="px-5">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Recordes Pessoais</h1>
        <p className="text-ink-muted text-sm mb-4">
          {aba === 'cargas'
            ? `${gruposCargas.length} exercícios com registro`
            : `${gruposEndurance.length}/4 distâncias com marca`}
        </p>

        {/* Tabs custom (compactas, sem chunk extra do Radix) */}
        <div className="flex gap-1 mb-4" role="tablist">
          <AbaButton ativo={aba === 'cargas'} onClick={() => setAba('cargas')}>
            Cargas
          </AbaButton>
          <AbaButton ativo={aba === 'endurance'} onClick={() => setAba('endurance')}>
            Endurance
          </AbaButton>
        </div>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        {grupos === null && !error && <div className="text-ink-subtle text-sm">Carregando...</div>}

        {grupos !== null && aba === 'cargas' && (
          <AbaCargas
            grupos={gruposCargas}
            expandido={expandido}
            setExpandido={setExpandido}
          />
        )}

        {grupos !== null && aba === 'endurance' && (
          <AbaEndurance grupos={gruposEndurance} />
        )}
      </div>

      <AlunoTabs />
    </div>
  );
}

function AbaButton({
  ativo, onClick, children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={
        'flex-1 py-2 rounded-[10px] text-[11px] font-bold uppercase tracking-wider ' +
        (ativo
          ? 'bg-ink text-bg'
          : 'bg-surface border border-app-strong text-ink-muted')
      }
    >
      {children}
    </button>
  );
}

// ─── Aba CARGAS — UI original mantida ─────────────────────────────────

function AbaCargas({
  grupos, expandido, setExpandido,
}: {
  grupos: RPGroup[];
  expandido: string | null;
  setExpandido: (v: string | null) => void;
}) {
  if (grupos.length === 0) {
    return (
      <div className="px-4 py-8 rounded-[16px] bg-surface border border-app text-center">
        <div className="text-3xl mb-2">🏋️</div>
        <div className="text-[14px] font-semibold text-ink">Sem RPs ainda</div>
        <div className="text-[12px] text-ink-muted mt-1">
          Conclua um treino de musculação e seu primeiro RP é registrado.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {grupos.map((g) => {
        const isOpen = expandido === g.exercicio;
        return (
          <div key={g.exercicio} className="rounded-[14px] bg-surface border border-app overflow-hidden">
            <button
              onClick={() => setExpandido(isOpen ? null : g.exercicio)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
                  {MODALIDADE_LABEL[g.modalidade]}
                </div>
                <div className="text-[14px] font-semibold tracking-tight truncate">{g.exercicio}</div>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                <div className="text-mono text-[18px] font-bold tabular text-accent leading-none">
                  {g.top.valor}{g.top.unidade}
                </div>
                {g.top.reps !== null && (
                  <div className="text-mono text-[10px] text-ink-subtle font-bold uppercase tracking-wider mt-0.5">
                    × {g.top.reps} reps
                  </div>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-app">
                <div className="px-4 py-2 bg-surface-muted text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono">
                  Por nº de repetições
                </div>
                {g.porReps.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5 border-t border-app">
                    <div className="text-mono text-[12px] text-ink font-bold tabular">
                      {r.reps ?? '—'} reps
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-mono text-[14px] font-bold tabular text-ink">
                        {r.valor}{r.unidade}
                      </span>
                      <span className="text-mono text-[10px] uppercase text-ink-subtle font-bold tracking-wider">
                        {relativeDay(r.dataRecorde)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Aba ENDURANCE — 4 cards canônicos sempre presentes ──────────────

function AbaEndurance({ grupos }: { grupos: RPGroup[] }) {
  // Indexa por distância pra render fácil
  const byDist = new Map(grupos.map((g) => [g.exercicio, g]));

  return (
    <div className="flex flex-col gap-2">
      {DISTANCIAS_CANONICAS.map((dist) => {
        const grupo = byDist.get(dist);
        return <CardPace key={dist} dist={dist} grupo={grupo} />;
      })}

      <div className="mt-3 px-3 py-2.5 rounded-[10px] bg-surface-muted text-ink-subtle text-[11.5px]">
        Distâncias canônicas detectadas com tolerância de ±200m. Treinos
        fora desses buckets (ex: 7K, 15K) entram no volume mas não viram RP.
      </div>
    </div>
  );
}

function CardPace({ dist, grupo }: { dist: DistanciaCanonica; grupo?: RPGroup }) {
  const [aberto, setAberto] = useState(false);

  if (!grupo) {
    return (
      <div className="rounded-[14px] bg-surface border border-dashed border-app-strong px-4 py-3 flex items-center justify-between opacity-70">
        <div>
          <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
            Corrida · {dist}
          </div>
          <div className="text-[13px] text-ink-muted">Sem marca registrada</div>
        </div>
        <div className="text-[18px] text-ink-subtle">—</div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-surface border border-app overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
            Corrida · {dist}
          </div>
          <div className="text-[13px] text-ink-muted">
            Marcado {relativeDay(grupo.top.dataRecorde)}
          </div>
        </div>
        <div className="text-right ml-3 flex-shrink-0">
          <div className="text-mono text-[18px] font-bold tabular text-accent leading-none">
            {fmtPace(grupo.top.valor)}
          </div>
          <div className="text-mono text-[10px] text-ink-subtle font-bold uppercase tracking-wider mt-0.5">
            min /km
          </div>
        </div>
      </button>

      {aberto && grupo.historico.length > 1 && (
        <div className="border-t border-app">
          <div className="px-4 py-2 bg-surface-muted text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono">
            Histórico
          </div>
          {grupo.historico.map((r) => (
            <HistoricoRow key={r.id} rp={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoricoRow({ rp }: { rp: RecordePessoal }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-app">
      <span className="text-mono text-[10px] uppercase text-ink-subtle font-bold tracking-wider">
        {relativeDay(rp.dataRecorde)}
      </span>
      <span className="text-mono text-[14px] font-bold tabular text-ink">
        {fmtPace(rp.valor)} <span className="text-[10px] text-ink-subtle">/km</span>
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

// Converte segPorKm (decimal) → "MM:SS" no formato pace.
// Ex: 300 s/km → "5:00"; 287.5 → "4:48"; 1500 → "25:00" (raríssimo mas
// possível pra walker).
export function fmtPace(segPorKm: number): string {
  if (!Number.isFinite(segPorKm) || segPorKm <= 0) return '—';
  const totalSeg = Math.round(segPorKm);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}
