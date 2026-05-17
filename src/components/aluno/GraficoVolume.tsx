import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  getVolumeSeries,
  type VolumeSemana,
  type VolumeSeries,
} from '@/lib/api/desempenho';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// PR #20 — Matriz de Volume Semanal.
//
// Por que BarChart e não LineChart: volume semanal é grandeza discreta
// (cada semana é um bucket fechado). Barra reflete melhor "esforço
// daquela semana" e facilita comparar picos vs vales no tapering.
//
// Por que filtro de modalidade (tabs) e não overlay: colocar tonelagem
// (5000–25000kg) e quilometragem (10–80km) no mesmo eixo Y deixa o eixo
// de km invisível. Eixos secundários funcionam mas a leitura mobile
// vira ruim. Tabs entrega 1 número por vez, claro e legível.
//
// Cor: coral nos picos (Strava-like). Sem comparação aluno-vs-aluno
// nem badges — só o atleta vendo o próprio gráfico.

type Modo = 'corrida' | 'ciclismo' | 'natacao' | 'musculacao';

const TABS: Array<{ id: Modo; label: string }> = [
  { id: 'corrida', label: 'Corrida' },
  { id: 'ciclismo', label: 'Ciclismo' },
  { id: 'natacao', label: 'Natação' },
  { id: 'musculacao', label: 'Musculação' },
];

const CONFIG: Record<
  Modo,
  { campo: keyof VolumeSemana; unidade: string; label: string; cor: string }
> = {
  corrida:    { campo: 'corridaKm',    unidade: 'km',     label: 'distância',  cor: '#fc4c02' },
  ciclismo:   { campo: 'ciclismoKm',   unidade: 'km',     label: 'distância',  cor: '#fc4c02' },
  natacao:    { campo: 'natacaoM',     unidade: 'm',      label: 'distância',  cor: '#fc4c02' },
  musculacao: { campo: 'musculacaoKg', unidade: 'kg',     label: 'tonelagem',  cor: '#fc4c02' },
};

const CORAL = '#fc4c02';

export function GraficoVolume() {
  const [modo, setModo] = useState<Modo>('corrida');
  const [data, setData] = useState<VolumeSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1 fetch só (12 semanas, todas as modalidades vêm juntas). Trocar
  // de tab é apenas re-render local — não bate no backend de novo.
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    getVolumeSeries(undefined, { weeks: 12, signal: ctrl.signal })
      .then((d) => setData(d))
      .catch((err) => { if (!isCancelError(err)) setError(apiErrorMessage(err)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardTitle className="text-[14px]">Volume semanal</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Tabs custom (sem Radix) — visual mais compacto e sem chunk extra */}
        <div className="flex gap-1 mb-3" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={modo === t.id}
              onClick={() => setModo(t.id)}
              className={
                'flex-1 py-1.5 rounded-[10px] text-[11px] font-bold uppercase tracking-wider ' +
                (modo === t.id
                  ? 'bg-ink text-bg'
                  : 'bg-surface border border-app-strong text-ink-muted')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center text-ink-muted text-[12px] py-10">
            Carregando série…
          </div>
        )}
        {error && (
          <div className="px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <ConteudoGrafico data={data} modo={modo} />
        )}
      </CardContent>
    </Card>
  );
}

function ConteudoGrafico({ data, modo }: { data: VolumeSeries; modo: Modo }) {
  const cfg = CONFIG[modo];
  const dataset = data.series.map((s) => ({
    semana: rotuloSemana(s.semana),
    valor: Number(s[cfg.campo]) || 0,
  }));
  const total = dataset.reduce((acc, d) => acc + d.valor, 0);
  const melhor = dataset.reduce((acc, d) => Math.max(acc, d.valor), 0);
  const semVolume = total === 0;

  if (semVolume) {
    return (
      <div className="text-center py-8 text-ink-subtle">
        <div className="text-[28px] mb-1">📊</div>
        <div className="text-[13px] font-semibold">Sem registros nas últimas {data.weeks} semanas</div>
        <div className="text-[11.5px] text-ink-muted mt-1">
          Conclua um treino de {TABS.find((t) => t.id === modo)?.label.toLowerCase()} pra começar a série.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">
            Total · {data.weeks} semanas
          </div>
          <div className="text-mono text-[22px] font-bold tabular text-ink leading-none">
            {fmtNumero(total)} <span className="text-[12px] text-ink-muted">{cfg.unidade}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">
            Pico semanal
          </div>
          <div className="text-mono text-[16px] font-bold tabular text-accent leading-none">
            {fmtNumero(melhor)} {cfg.unidade}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={dataset} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            <XAxis
              dataKey="semana"
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v) => fmtCurto(v as number)}
            />
            <Tooltip
              cursor={{ fill: 'currentColor', opacity: 0.06 }}
              contentStyle={{
                background: 'rgb(var(--surface))',
                border: '1px solid rgba(var(--border), 0.2)',
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value) => [`${fmtNumero(Number(value))} ${cfg.unidade}`, cfg.label]}
              labelFormatter={(l) => `Semana ${l}`}
            />
            <Bar dataKey="valor" fill={CORAL} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────────────────────────────────

function rotuloSemana(iso: string): string {
  // "2026-05-11" → "11/05". Mês curto seria redundante na fita.
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

function fmtNumero(v: number): string {
  if (v >= 10000) return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
  if (v >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

function fmtCurto(v: number): string {
  // Eixo Y compacto: 12000 → "12k", 1500 → "1.5k", 45 → "45"
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}
