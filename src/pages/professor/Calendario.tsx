import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiErrorMessage } from '@/lib/api';
import {
  getCalendarioProfessor,
  type CalendarioProva,
  type CalendarioTreino,
} from '@/lib/api/professor';
import { cn } from '@/lib/utils';
import { MODALIDADE_LABEL, STATUS_LABEL } from '@/types/treino';

const DAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Paleta de cores por aluno (cycle quando passa de 6)
const ALUNO_COLORS = [
  'bg-accent text-accent-ink',
  'bg-success text-bg',
  'bg-pr text-bg',
  'bg-warn text-bg',
  'bg-blue-500 text-white',
  'bg-fuchsia-500 text-white',
];

export default function ProfCalendario() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [treinos, setTreinos] = useState<CalendarioTreino[]>([]);
  const [provas, setProvas] = useState<CalendarioProva[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  useEffect(() => {
    const desde = new Date(cursor);
    const ate = new Date(cursor);
    ate.setMonth(ate.getMonth() + 1);
    let cancelled = false;
    setError(null);
    getCalendarioProfessor(desde.toISOString(), ate.toISOString())
      .then((d) => {
        if (cancelled) return;
        setTreinos(d.treinos);
        setProvas(d.provas);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => { cancelled = true; };
  }, [cursor]);

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const todayKey = dayKey(today);

  // Cor consistente por alunoId
  const alunoColorMap = useMemo(() => {
    const ids = Array.from(new Set(treinos.map((t) => t.alunoId).concat(provas.map((p) => p.alunoId))));
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, ALUNO_COLORS[i % ALUNO_COLORS.length]));
    return m;
  }, [treinos, provas]);

  const treinosByDay = useMemo(() => groupBy(treinos, (t) => dayKey(new Date(t.dataAlvo))), [treinos]);
  const provasByDay = useMemo(() => groupBy(provas, (p) => dayKey(new Date(p.data))), [provas]);

  const detailsForDay = (key: string) => ({
    treinos: treinosByDay.get(key) ?? [],
    provas: provasByDay.get(key) ?? [],
  });

  const totalTreinos = treinos.length;
  const totalConcluidos = treinos.filter((t) => t.status === 'CONCLUIDO').length;

  return (
    // Mesma estratégia do calendário do aluno: viewport-locked no desktop, scroll global no mobile.
    <div className="min-h-screen bg-bg text-ink pb-24 lg:pb-0 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between lg:flex-shrink-0">
        <Link to="/professor/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
      </header>

      <div className="px-5 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:grid lg:grid-cols-[minmax(360px,420px)_1fr] lg:gap-6 lg:px-6 lg:pb-6">
        <div className="lg:flex lg:flex-col lg:min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-[26px] font-bold tracking-tight lg:text-2xl">
              {MONTHS[cursor.getMonth()]} <span className="text-ink-muted text-mono text-[18px] tabular lg:text-base">{cursor.getFullYear()}</span>
            </h1>
            <div className="flex gap-1.5">
              <button onClick={() => setCursor(addMonths(cursor, -1))} className="size-8 rounded-full bg-surface border border-app-strong text-ink font-bold">‹</button>
              <button onClick={() => setCursor(addMonths(cursor, 1))} className="size-8 rounded-full bg-surface border border-app-strong text-ink font-bold">›</button>
            </div>
          </div>

          <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-5 lg:mb-3">
            {totalTreinos} treinos · {totalConcluidos} concluídos
          </div>

          {error && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
          )}

          <div className="grid grid-cols-7 gap-1 mb-2 lg:gap-0.5">
            {DAYS_SHORT.map((d, i) => (
              <div key={i} className="text-center text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 lg:gap-0.5">
            {days.map((d, i) => {
              const key = dayKey(d.date);
              const isCurrentMonth = d.date.getMonth() === cursor.getMonth();
              const isToday = key === todayKey;
              const isSel = diaSel === key;
              const dets = detailsForDay(key);
              const distinctAlunos = Array.from(
                new Set(dets.treinos.map((t) => t.alunoId).concat(dets.provas.map((p) => p.alunoId))),
              );

              return (
                <button
                  key={i}
                  onClick={() => setDiaSel(isSel ? null : key)}
                  className={cn(
                    'aspect-square min-h-[40px] rounded-md flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-colors',
                    'lg:aspect-auto lg:h-9 lg:min-h-0 lg:gap-0.5 lg:text-[13px]',
                    !isCurrentMonth && 'opacity-30',
                    isSel ? 'bg-ink text-bg' : isToday ? 'bg-accent text-accent-ink' : 'bg-surface text-ink',
                    !isSel && !isToday && 'border border-app',
                  )}
                >
                  <span className="text-mono tabular">{d.date.getDate()}</span>
                  <div className="flex gap-0.5 h-1 max-w-[28px] flex-wrap justify-center">
                    {distinctAlunos.slice(0, 5).map((aId) => {
                      const cls = alunoColorMap.get(aId) ?? 'bg-ink-subtle';
                      const colorClass = cls.split(' ')[0]; // pega só o bg-*
                      return (
                        <span
                          key={aId}
                          className={cn(
                            'size-1 rounded-full',
                            isSel ? 'bg-current' : isToday ? 'bg-current' : colorClass,
                          )}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legenda alunos */}
          {alunoColorMap.size > 0 && (
            <div className="mt-3 mb-5 flex flex-wrap gap-1.5 lg:mb-0">
              {Array.from(alunoColorMap.entries()).map(([alunoId, colorCls]) => {
                const t = treinos.find((tt) => tt.alunoId === alunoId) ?? provas.find((pp) => pp.alunoId === alunoId);
                if (!t) return null;
                const nome = (t as { alunoNome?: string }).alunoNome ?? 'Aluno';
                return (
                  <span key={alunoId} className={cn('text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', colorCls)}>
                    {nome.split(' ')[0]}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna direita: lista do dia. Scroll isolado no desktop. */}
        <div className="lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          {diaSel ? (
            <DiaDetails diaKey={diaSel} dets={detailsForDay(diaSel)} alunoColorMap={alunoColorMap} />
          ) : (
            <div className="hidden lg:block px-4 py-8 text-ink-subtle text-[13px] bg-surface rounded-[14px] border border-app text-center">
              Selecione um dia no calendário ao lado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiaDetails({
  diaKey,
  dets,
  alunoColorMap,
}: {
  diaKey: string;
  dets: { treinos: CalendarioTreino[]; provas: CalendarioProva[] };
  alunoColorMap: Map<string, string>;
}) {
  const date = new Date(diaKey + 'T00:00:00');
  const empty = dets.treinos.length === 0 && dets.provas.length === 0;
  return (
    <div className="rounded-[14px] bg-surface border border-app overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-muted">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">
          {date.getDate().toString().padStart(2, '0')} · {MONTHS[date.getMonth()]}
        </div>
      </div>
      {empty ? (
        <div className="px-4 py-4 text-ink-subtle text-[13px]">Sem agendas neste dia.</div>
      ) : (
        <>
          {dets.treinos.map((t) => (
            <Link
              key={t.id}
              to={`/professor/aluno/${t.alunoId}`}
              className="flex items-center justify-between gap-3 px-4 py-3 border-t border-app first:border-t-0 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      'text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
                      alunoColorMap.get(t.alunoId) ?? 'bg-ink-subtle text-bg',
                    )}
                  >
                    {t.alunoNome.split(' ')[0]}
                  </span>
                  <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
                    {MODALIDADE_LABEL[t.modalidade]}
                  </span>
                </div>
                <div className="text-[13.5px] font-semibold truncate">{t.titulo}</div>
              </div>
              <span
                className={cn(
                  'text-mono text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                  t.status === 'CONCLUIDO' ? 'bg-success-bg text-success-ink' :
                  t.status === 'PENDENTE' ? 'bg-warn-bg text-warn' :
                  'bg-surface-muted text-ink-muted',
                )}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </Link>
          ))}
          {dets.provas.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3 border-t border-app first:border-t-0 bg-pr-bg"
            >
              <div className="min-w-0 flex-1">
                <div className="text-mono text-[10px] uppercase tracking-wider text-pr font-bold mb-0.5">
                  Prova · {p.alunoNome.split(' ')[0]} · {MODALIDADE_LABEL[p.modalidade]}
                </div>
                <div className="text-[13.5px] font-semibold truncate">{p.nome}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// helpers
function buildMonthGrid(cursor: Date) {
  const first = new Date(cursor);
  first.setDate(1);
  const startOffset = first.getDay();
  const grid: { date: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(1 - startOffset + i);
    grid.push({ date: d });
  }
  return grid;
}

function addMonths(d: Date, n: number) {
  const next = new Date(d);
  next.setMonth(next.getMonth() + n);
  return next;
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}
