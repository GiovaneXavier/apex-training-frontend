import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from 'recharts';

import { AlunoTabs } from '@/components/AlunoTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ImageComparisonSlider,
  FotosUploader,
  type FotosProgresso,
} from '@/components/ImageComparisonSlider';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { listEvolucoes, type Evolucao } from '@/lib/api/evolucoes';
import { getDesempenho, type Desempenho, type EstimativaProva } from '@/lib/api/desempenho';
import { GraficoVolume } from '@/components/aluno/GraficoVolume';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Cor de destaque do tema "Strava-like" — coral
// ─────────────────────────────────────────────────────────────
const CORAL = '#fc4c02';
const CORAL_DARK = '#0a0a0b';


// ─────────────────────────────────────────────────────────────
// Tela principal
// ─────────────────────────────────────────────────────────────
export default function AlunoProgresso() {
  const { user } = useAuth();
  const [desempenho, setDesempenho] = useState<Desempenho | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    getDesempenho()
      .then((d) => !cancelled && setDesempenho(d))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
      </header>

      <div className="px-5 max-w-2xl mx-auto">
        <h1 className="text-[28px] font-bold tracking-tight mb-1">Progresso</h1>
        <p className="text-ink-muted text-sm mb-5">Sua jornada · desempenho atlético e evolução física.</p>

        <Tabs defaultValue="desempenho" className="w-full">
          <TabsList>
            <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução física</TabsTrigger>
          </TabsList>

          <TabsContent value="desempenho">
            <SecaoDesempenho data={desempenho} loading={loading} error={error} />
          </TabsContent>

          <TabsContent value="evolucao">
            <SecaoEvolucao />
          </TabsContent>
        </Tabs>
      </div>

      <AlunoTabs />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECÇÃO 1 — Desempenho atlético (consome /api/aluno/desempenho)
// ─────────────────────────────────────────────────────────────
function SecaoDesempenho({
  data, loading, error,
}: {
  data: Desempenho | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <Card className="mt-2">
        <CardContent className="p-6 text-center text-ink-muted text-[13px]">
          Carregando desempenho…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-2">
        <CardContent className="p-6 text-center">
          <div className="text-danger text-[13px] font-medium">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      <CardStreak semanas={data.streak} />
      {/* PR #20 — Matriz de Volume Semanal. Posicionado logo após o
          streak por dar continuidade visual: streak = consistência,
          volume = magnitude. Cada modalidade num tab pra escala Y
          limpa. */}
      <GraficoVolume />
      <CardCiclo ciclo={data.ciclo} />
      <CardEstimativas estimativas={data.estimativasProva} />
      <CardResumoMes resumo={data.resumoMes} />
    </div>
  );
}

function CardStreak({ semanas }: { semanas: number }) {
  return (
    <Card
      className="border-0 text-white relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${CORAL_DARK} 0%, #161618 60%, ${CORAL_DARK} 100%)` }}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <span
            className="size-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${CORAL}1f` }}
          >
            <FlameIcon color={CORAL} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.7px] font-bold text-white/60 mb-0.5">
              Streak
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-mono tabular text-[44px] font-bold leading-none" style={{ color: CORAL }}>
                {semanas}
              </span>
              <span className="text-[13px] font-semibold text-white/80">semanas</span>
            </div>
            <p className="text-[12.5px] text-white/70 leading-snug">
              <span className="font-bold text-white">Sem falhar.</span>{' '}
              Sua disciplina nos enche de orgulho.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardCiclo({ ciclo }: { ciclo: Desempenho['ciclo'] }) {
  const dadosDonut = [
    { name: 'feito', value: ciclo.pct },
    { name: 'falta', value: Math.max(0, 100 - ciclo.pct) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciclo atual</CardTitle>
        <CardDescription>
          {ciclo.metaTitulo} · {ciclo.concluidos} de {ciclo.total} {ciclo.total === 1 ? 'treino concluído' : 'treinos concluídos'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          {/* Donut */}
          <div className="relative size-[140px] mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosDonut}
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={66}
                  startAngle={90} endAngle={-270}
                  paddingAngle={ciclo.pct === 0 || ciclo.pct === 100 ? 0 : 2}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={CORAL} />
                  <Cell fill="rgba(0,0,0,0.06)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-mono tabular text-[26px] font-bold leading-none" style={{ color: CORAL }}>
                {ciclo.pct}%
              </span>
              <span className="text-[9.5px] uppercase tracking-wider font-bold text-ink-subtle mt-0.5">
                do ciclo
              </span>
            </div>
          </div>

          {/* Lista lateral — métricas do mês corrente */}
          <ul className="space-y-2.5">
            <ItemMetrica label="Distância acumulada" valor={`${ciclo.distanciaKm} km`} />
            <ItemMetrica label="Treinos concluídos" valor={String(ciclo.concluidos)} />
            <ItemMetrica label="Pendentes" valor={String(Math.max(0, ciclo.total - ciclo.concluidos))} />
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemMetrica({ label, valor }: { label: string; valor: string }) {
  return (
    <li className="flex items-center justify-between border-b border-app last:border-0 pb-2 last:pb-0">
      <span className="text-[11px] text-ink-muted">{label}</span>
      <span className="text-mono text-[14px] font-bold tabular text-ink">{valor}</span>
    </li>
  );
}

function CardEstimativas({
  estimativas,
}: { estimativas: EstimativaProva[] | null }) {
  // Empty state: aluno sem RPs de corrida
  if (!estimativas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estimativas de prova</CardTitle>
          <CardDescription>Registre seu primeiro RP de corrida (5K, 10K…) para vermos a previsão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl bg-surface-muted p-6 text-center">
            <div className="text-[12px] text-ink-muted mb-2">Nenhum RP de corrida ainda.</div>
            <Link
              to="/aluno/rps"
              className="inline-flex items-center justify-center h-10 px-4 rounded-2xl bg-accent text-accent-ink font-bold text-[12px]"
            >
              + Registrar RP
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimativas de prova</CardTitle>
        <CardDescription>Previsão baseada nos seus RPs registrados</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {estimativas.map((e) => (
            <div key={e.prova} className="rounded-2xl bg-surface-muted p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1">
                {e.prova}
              </div>
              <div className="text-mono tabular text-[22px] font-bold text-ink leading-none">
                {e.tempo ?? '—'}
              </div>
              <div className="text-[11px] text-ink-muted mt-1.5">
                {e.pace ?? 'sem RP'}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CardResumoMes({ resumo }: { resumo: Desempenho['resumoMes'] }) {
  const cargaFmt = resumo.cargaTotalKg >= 1000
    ? `${(resumo.cargaTotalKg / 1000).toFixed(1)}t`
    : `${resumo.cargaTotalKg}kg`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo do mês</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {/* Card destaque coral — tempo total */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: CORAL }}
          >
            <div className="text-[10px] uppercase tracking-[0.6px] font-bold opacity-80 mb-1.5">
              tempo total
            </div>
            <div className="text-mono tabular text-[22px] font-bold leading-none">
              {resumo.tempoFmt}
            </div>
          </div>
          <ResumoCardSimples titulo="distância" valor={`${resumo.distanciaKm} km`} />
          <ResumoCardSimples titulo="treinos" valor={String(resumo.treinos)} />
          <ResumoCardSimples titulo="carga total" valor={cargaFmt} />
        </div>
      </CardContent>
    </Card>
  );
}

function ResumoCardSimples({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1.5">
        {titulo}
      </div>
      <div className="text-mono tabular text-[22px] font-bold text-ink leading-none">{valor}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECÇÃO 2 — Evolução física (consome /api/evolucoes)
// ─────────────────────────────────────────────────────────────
function SecaoEvolucao() {
  const { user } = useAuth();
  const [items, setItems] = useState<Evolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fotosForm, setFotosForm] = useState<FotosProgresso>({});

  useEffect(() => {
    if (!user?.aluno?.id) return;
    let cancelled = false;
    setLoading(true);
    listEvolucoes({ alunoId: user.aluno.id, limit: 200 })
      .then((data) => !cancelled && setItems(data))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user?.aluno?.id]);

  // Pares ordenados pra gráfico (cronológico crescente)
  const linhaData = useMemo(() => {
    return [...items]
      .sort((a, b) => new Date(a.dataAvaliacao).getTime() - new Date(b.dataAvaliacao).getTime())
      .map((a) => ({
        data: fmtDataCurta(a.dataAvaliacao),
        peso: a.pesoKg ?? null,
        bf: a.percentualGordura ?? null,
      }))
      .filter((p) => p.peso !== null || p.bf !== null);
  }, [items]);

  // Fotos pra slider antes/depois (mais antiga vs mais recente com foto frente)
  const fotosComparacao = useMemo(() => {
    const comFoto = items
      .filter((a) => a.fotos?.frente)
      .sort((a, b) => new Date(a.dataAvaliacao).getTime() - new Date(b.dataAvaliacao).getTime());
    if (comFoto.length < 2) return null;
    return {
      before: { url: comFoto[0].fotos!.frente!, data: comFoto[0].dataAvaliacao },
      after: { url: comFoto[comFoto.length - 1].fotos!.frente!, data: comFoto[comFoto.length - 1].dataAvaliacao },
    };
  }, [items]);

  if (loading) {
    return (
      <Card className="mt-2">
        <CardContent className="p-6 text-center text-ink-muted text-[13px]">
          Carregando avaliações…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-2">
        <CardContent className="p-6 text-center">
          <div className="text-danger text-[13px] font-medium mb-3">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return <EmptyEvolucao />;
  }

  const ultimo = items[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Cards resumo do último registro */}
      <div className="grid grid-cols-3 gap-2">
        <ResumoCardSimples titulo="Peso" valor={ultimo.pesoKg ? `${ultimo.pesoKg.toFixed(1)} kg` : '—'} />
        <ResumoCardSimples titulo="IMC" valor={ultimo.imc ? ultimo.imc.toFixed(1) : '—'} />
        <ResumoCardSimples titulo="% Gordura" valor={ultimo.percentualGordura ? `${ultimo.percentualGordura.toFixed(1)}%` : '—'} />
      </div>

      {/* Gráfico de linha %BF + Peso */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência</CardTitle>
          <CardDescription>Peso e percentual de gordura ao longo das avaliações</CardDescription>
        </CardHeader>
        <CardContent>
          {linhaData.length < 2 ? (
            <div className="text-ink-subtle text-[12px] py-6 text-center">
              Pelo menos 2 medições para mostrar tendência.
            </div>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={linhaData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="peso" orientation="left" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} width={36} />
                  <YAxis yAxisId="bf" orientation="right" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg, white)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 12,
                      fontSize: 11,
                    }}
                    labelStyle={{ fontWeight: 700 }}
                  />
                  <Line yAxisId="peso" type="monotone" dataKey="peso" name="Peso (kg)" stroke={CORAL_DARK} strokeWidth={2.5} dot={{ r: 3, fill: CORAL_DARK }} activeDot={{ r: 5 }} />
                  <Line yAxisId="bf" type="monotone" dataKey="bf" name="% Gordura" stroke={CORAL} strokeWidth={2.5} dot={{ r: 3, fill: CORAL }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slider antes/depois — só se houver 2+ fotos frente */}
      {fotosComparacao && (
        <Card>
          <CardHeader>
            <CardTitle>Antes vs Depois</CardTitle>
            <CardDescription>
              {fmtDataCurta(fotosComparacao.before.data)} → {fmtDataCurta(fotosComparacao.after.data)} · arraste a barra
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageComparisonSlider
              beforeUrl={fotosComparacao.before.url}
              afterUrl={fotosComparacao.after.url}
              beforeLabel={fmtDataCurta(fotosComparacao.before.data)}
              afterLabel={fmtDataCurta(fotosComparacao.after.data)}
            />
          </CardContent>
        </Card>
      )}

      {/* Uploader pra próxima avaliação rápida */}
      <FotosUploader value={fotosForm} onChange={setFotosForm} />
      {(fotosForm.frente || fotosForm.lado || fotosForm.costas) && (
        <Link
          to="/aluno/evolucao/nova"
          className="text-center w-full h-12 rounded-2xl bg-accent text-accent-ink font-bold text-[13px] flex items-center justify-center"
        >
          Continuar para avaliação completa →
        </Link>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>{items.length} {items.length === 1 ? 'avaliação registrada' : 'avaliações registradas'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative pl-5">
            <span className="absolute left-1.5 top-1 bottom-1 w-px bg-app" aria-hidden />
            {items.map((a) => <TimelineItem key={a.id} avaliacao={a} />)}
          </ol>
        </CardContent>
      </Card>

      {/* Progresso visual em direção ao último IMC saudável (24.9) */}
      {ultimo.imc !== null && ultimo.imc !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>IMC atual</CardTitle>
            <CardDescription>Faixa saudável: 18.5 a 24.9</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-mono tabular text-[28px] font-bold" style={{ color: CORAL }}>
                {ultimo.imc.toFixed(1)}
              </span>
              <span className="text-[11px] text-ink-muted">{interpretarIMC(ultimo.imc)}</span>
            </div>
            <Progress value={Math.min(100, (ultimo.imc / 30) * 100)} indicatorClassName="bg-[--coral]" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyEvolucao() {
  return (
    <Card className="mt-2">
      <CardContent className="p-8 text-center">
        <div className="size-14 rounded-2xl bg-surface-muted mx-auto mb-3 flex items-center justify-center text-ink-subtle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
          </svg>
        </div>
        <h3 className="text-[15px] font-bold mb-1">Nenhuma avaliação ainda</h3>
        <p className="text-[12px] text-ink-muted mb-4">
          Comece registrando sua primeira medição. Em poucos minutos você vê tudo aqui.
        </p>
        <Link
          to="/aluno/evolucao/nova"
          className="inline-flex items-center justify-center h-11 px-5 rounded-2xl bg-accent text-accent-ink font-bold text-[13px]"
        >
          + Nova auto-avaliação
        </Link>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ avaliacao }: { avaliacao: Evolucao }) {
  return (
    <li className="relative mb-4 last:mb-0">
      <span
        className="absolute -left-[14px] top-1.5 size-3 rounded-full border-2 border-bg"
        style={{ background: CORAL }}
        aria-hidden
      />
      <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
        {fmtDataLonga(avaliacao.dataAvaliacao)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[12.5px]">
        {avaliacao.pesoKg !== null && <span className="font-semibold">{avaliacao.pesoKg!.toFixed(1)}kg</span>}
        {avaliacao.imc !== null && <span className="text-ink-muted">IMC {avaliacao.imc!.toFixed(1)}</span>}
        {avaliacao.percentualGordura !== null && <span className="text-ink-muted">{avaliacao.percentualGordura!.toFixed(1)}% gord.</span>}
        {avaliacao.protocolo && <span className="text-ink-subtle text-[11px]">· {avaliacao.protocolo}</span>}
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function fmtDataLonga(iso: string): string {
  const d = new Date(iso);
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${d.getDate().toString().padStart(2, '0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function interpretarIMC(imc: number): string {
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Saudável';
  if (imc < 30) return 'Sobrepeso';
  return 'Acima da faixa';
}

function FlameIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="0.5">
      <path d="M13 .5C13 4 10 6 10 9c0 1.5.5 2.5 1 3.5-1-.5-2-1-2.5-2.5-1 1.5-1.5 3-1.5 4.5C7 18.5 9.7 22 13 22s6-3.5 6-7.5C19 8 13 6 13 .5Z" />
    </svg>
  );
}

// Padding helper para a página interna do dashboard caber com tabs no rodapé
// (já garantido via pb-24 no wrapper principal).
// `cn` exportado caso precise externamente.
export { cn };
