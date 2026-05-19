import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ImageComparisonSlider,
  FotosUploader,
  type FotosProgresso,
} from '@/components/ImageComparisonSlider';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { listEvolucoes, type Evolucao } from '@/lib/api/evolucoes';

import { CORAL, CORAL_DARK, fmtDataCurta, fmtDataLonga, interpretarIMC, ResumoCardSimples } from './shared';

// PR #33 — Secao Evolução extraída pra lazy chunk próprio.
// Usa Recharts (LineChart) — chunk SÓ baixa quando o atleta clica nesta
// tab. Atleta que vive na tab Desempenho não paga este peso.

export function SecaoEvolucao() {
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
      <div className="grid grid-cols-3 gap-2">
        <ResumoCardSimples titulo="Peso" valor={ultimo.pesoKg ? `${ultimo.pesoKg.toFixed(1)} kg` : '—'} />
        <ResumoCardSimples titulo="IMC" valor={ultimo.imc ? ultimo.imc.toFixed(1) : '—'} />
        <ResumoCardSimples titulo="% Gordura" valor={ultimo.percentualGordura ? `${ultimo.percentualGordura.toFixed(1)}%` : '—'} />
      </div>

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

      <FotosUploader value={fotosForm} onChange={setFotosForm} />
      {(fotosForm.frente || fotosForm.lado || fotosForm.costas) && (
        <Link
          to="/aluno/evolucao/nova"
          className="text-center w-full h-12 rounded-2xl bg-accent text-accent-ink font-bold text-[13px] flex items-center justify-center"
        >
          Continuar para avaliação completa →
        </Link>
      )}

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

export default SecaoEvolucao;
