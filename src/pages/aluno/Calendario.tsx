import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { listProvas } from '@/lib/api/provas';
import { listTreinos } from '@/lib/api/treinos';
import { cn } from '@/lib/utils';
import { MODALIDADE_LABEL, type Prova, type Treino } from '@/types/treino';

const DAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function AlunoCalendario() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.aluno?.id) return;
    const desde = new Date(cursor);
    const ate = new Date(cursor);
    ate.setMonth(ate.getMonth() + 1);
    let cancelled = false;
    setError(null);

    Promise.all([
      listTreinos(user.aluno.id, { desde: desde.toISOString(), ate: ate.toISOString(), limit: 200 }),
      listProvas(user.aluno.id, { desde: desde.toISOString(), ate: ate.toISOString(), limit: 50 }),
    ])
      .then(([t, p]) => {
        if (cancelled) return;
        setTreinos(t);
        setProvas(p);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));

    return () => { cancelled = true; };
  }, [user?.aluno?.id, cursor]);

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const treinosByDay = useMemo(() => groupBy(treinos, (t) => new Date(t.dataAlvo).toISOString().slice(0, 10)), [treinos]);
  const provasByDay = useMemo(() => groupBy(provas, (p) => new Date(p.data).toISOString().slice(0, 10)), [provas]);

  const itensDia = (key: string): { kind: 'treino' | 'prova'; id: string; titulo: string; modalidade: string; status?: string }[] => {
    const ts = (treinosByDay.get(key) ?? []).map((t) => ({
      kind: 'treino' as const,
      id: t.id,
      titulo: t.titulo,
      modalidade: MODALIDADE_LABEL[t.modalidade],
      status: t.status,
    }));
    const ps = (provasByDay.get(key) ?? []).map((p) => ({
      kind: 'prova' as const,
      id: p.id,
      titulo: p.nome,
      modalidade: MODALIDADE_LABEL[p.modalidade],
    }));
    return [...ts, ...ps];
  };

  const today = new Date();
  const todayKey = dayKey(today);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
      </header>

      <div className="px-5">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[26px] font-bold tracking-tight">
            {MONTHS[cursor.getMonth()]} <span className="text-ink-muted text-mono text-[18px] tabular">{cursor.getFullYear()}</span>
          </h1>
          <div className="flex gap-1.5">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="size-8 rounded-full bg-surface border border-app-strong text-ink font-bold">‹</button>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="size-8 rounded-full bg-surface border border-app-strong text-ink font-bold">›</button>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold text-mono py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const key = dayKey(d.date);
            const isCurrentMonth = d.date.getMonth() === cursor.getMonth();
            const isToday = key === todayKey;
            const itens = itensDia(key);
            const hasTreino = itens.some((i) => i.kind === 'treino');
            const hasProva = itens.some((i) => i.kind === 'prova');
            const isSel = diaSel === key;

            return (
              <button
                key={i}
                onClick={() => setDiaSel(isSel ? null : key)}
                className={cn(
                  'aspect-square rounded-[10px] flex flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-colors',
                  !isCurrentMonth && 'opacity-30',
                  isSel ? 'bg-ink text-bg' : isToday ? 'bg-accent text-accent-ink' : 'bg-surface text-ink',
                  !isSel && !isToday && 'border border-app',
                )}
              >
                <span className="text-mono tabular">{d.date.getDate()}</span>
                <div className="flex gap-0.5 h-1">
                  {hasTreino && <span className={cn('size-1 rounded-full', isSel || isToday ? 'bg-current' : 'bg-accent')} />}
                  {hasProva && <span className={cn('size-1 rounded-full', isSel || isToday ? 'bg-current' : 'bg-pr')} />}
                </div>
              </button>
            );
          })}
        </div>

        <Legend />

        {diaSel && <DiaDetails key={diaSel} diaKey={diaSel} itens={itensDia(diaSel)} />}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 mt-3 mb-5 text-[11px] text-ink-muted">
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Treino</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-pr" /> Prova</span>
    </div>
  );
}

function DiaDetails({ diaKey, itens }: { diaKey: string; itens: ReturnType<typeof identityArr> }) {
  const date = new Date(diaKey + 'T00:00:00');
  return (
    <div className="rounded-[14px] bg-surface border border-app overflow-hidden">
      <div className="px-4 py-2.5 bg-surface-muted">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">
          {date.getDate().toString().padStart(2, '0')} · {MONTHS[date.getMonth()]}
        </div>
      </div>
      {itens.length === 0 ? (
        <div className="px-4 py-4 text-ink-subtle text-[13px]">Nenhuma agenda neste dia.</div>
      ) : (
        itens.map((it) => (
          <div key={it.kind + it.id} className="flex items-center justify-between px-4 py-3 border-t border-app first:border-t-0">
            <div className="min-w-0">
              <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
                {it.kind === 'treino' ? 'Treino' : 'Prova'} · {it.modalidade}
              </div>
              <div className="text-[13.5px] font-semibold truncate">{it.titulo}</div>
            </div>
            {it.kind === 'treino' && (
              <Link
                to={`/aluno/treino/${it.id}`}
                className="text-[10px] uppercase tracking-wider font-bold text-accent flex-shrink-0 ml-2"
              >
                Abrir →
              </Link>
            )}
          </div>
        ))
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

// Alias usado só pra inferir o tipo de itensDia no DiaDetails
function identityArr(): { kind: 'treino' | 'prova'; id: string; titulo: string; modalidade: string; status?: string }[] {
  return [];
}
