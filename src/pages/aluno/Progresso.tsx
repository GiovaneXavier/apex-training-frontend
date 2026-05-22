import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';

import { AlunoTabs } from '@/components/AlunoTabs';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// PR #33 — Casca leve. Cada secao vira chunk separado via React.lazy.
//
// ANTES: Progresso.tsx = 588 linhas + Recharts top-level → chunk único de
// ~129 KB Gzip que o atleta paga inteiro ao abrir a rota, MESMO que só
// queira ver uma tab.
//
// DEPOIS: Progresso.tsx ~ 50 linhas + 2 lazy chunks separados:
//   - SecaoDesempenho.tsx (PieChart de Recharts + GraficoVolume)
//   - SecaoEvolucao.tsx   (LineChart de Recharts + ImageComparisonSlider)
// Tab clicada = chunk carrega. Tab nunca clicada = nunca baixada.
//
// Recharts ainda existe — substituição completa por lib leve fica pra
// Sprint 14+ em migração GRADUAL (gráfico-a-gráfico, sem big-bang).

const SecaoDesempenho = lazy(() => import('./progresso/SecaoDesempenho'));
const SecaoEvolucao = lazy(() => import('./progresso/SecaoEvolucao'));

function TabFallback() {
  return (
    <Card className="mt-2">
      <CardContent className="p-6 text-center text-ink-muted text-[13px]">
        Carregando…
      </CardContent>
    </Card>
  );
}

export default function AlunoProgresso() {
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
            <Suspense fallback={<TabFallback />}>
              <SecaoDesempenho />
            </Suspense>
          </TabsContent>

          <TabsContent value="evolucao">
            <Suspense fallback={<TabFallback />}>
              <SecaoEvolucao />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      <AlunoTabs />
    </div>
  );
}
