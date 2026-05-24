import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

import { ProtectedRoute } from './components/ProtectedRoute';
import { ReloadPrompt } from './components/ReloadPrompt';
import { useAuth, dashboardPathFor } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { useOfflineSync } from './hooks/useOfflineSync';

// PR #15 (audit 5.16) — code-splitting por rota.
//
// Estratégia: TODA página vira chunk separado. O bundle inicial passa a
// conter só o shell (App, ProtectedRoute, AuthContext, ReloadPrompt) +
// as duas rotas que abrem antes do login (Login, Cadastro). O resto
// baixa sob demanda, com prioridade pra rota corrente.
//
// Quem ganha mais: chunks com Recharts (Progresso/Evolucao) e os
// componentes Live (CorridaLive importa Strava client, NatacaoLive
// tem matemática de CSS, HyroxLive tem cronômetros complexos). No
// PR pré-#15 tudo ia pro index.js → 954KB / 274KB gzip. Pós-#15 o
// inicial deve cair pra ~150-200KB raw.
//
// O Suspense fallback é uma tela neutra com a cor de marca — evita
// flash de branco que mata percepção em mobile. Tempo de chunk em
// 4G médio (~1-2s) é coberto pelo skeleton da própria página depois.
const Login = lazy(() => import('./pages/auth/Login'));
const Cadastro = lazy(() => import('./pages/auth/Cadastro'));
const StravaCallback = lazy(() => import('./pages/auth/StravaCallback'));

const AlunoDashboard = lazy(() => import('./pages/aluno/Dashboard'));
const AlunoTreino = lazy(() => import('./pages/aluno/Treino'));
const AlunoCalendario = lazy(() => import('./pages/aluno/Calendario'));
const AlunoRPs = lazy(() => import('./pages/aluno/RPs'));
const AlunoPerfil = lazy(() => import('./pages/aluno/Perfil'));
const AlunoEvolucao = lazy(() => import('./pages/aluno/Evolucao'));
const AlunoEvolucaoNova = lazy(() => import('./pages/aluno/EvolucaoNova'));
const AlunoProgresso = lazy(() => import('./pages/aluno/Progresso'));
const AlunoConquistas = lazy(() => import('./pages/aluno/Conquistas'));

const ProfDashboard = lazy(() => import('./pages/professor/Dashboard'));
const ProfAlunos = lazy(() => import('./pages/professor/Alunos'));
const ProfAlunoDetalhe = lazy(() => import('./pages/professor/AlunoDetalhe'));
const ProfPrescrever = lazy(() => import('./pages/professor/Prescrever'));
const ProfCalendario = lazy(() => import('./pages/professor/Calendario'));
const ProfExercicios = lazy(() => import('./pages/professor/Exercicios'));
const ProfRotinaForm = lazy(() => import('./pages/professor/RotinaForm'));

const NutriDashboard = lazy(() => import('./pages/nutricionista/Dashboard'));
const NutriAlunoDetalhe = lazy(() => import('./pages/nutricionista/AlunoDetalhe'));

const AdminCockpit = lazy(() => import('./pages/admin/Cockpit'));
const AdminUsuarios = lazy(() => import('./pages/admin/Usuarios'));

function RouteFallback() {
  // Spinner mínimo. Inline pra não criar mais um chunk só pra fallback.
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-ink-muted/30 border-t-coral"
        role="status"
        aria-label="Carregando"
      />
    </div>
  );
}

export default function App() {
  // Drena fila offline (lib/offline/saveQueue) → backend quando a rede volta.
  // Idempotente; sequencial; toast resumido no final do batch.
  useOfflineSync();
  const { theme } = useTheme();

  return (
    <>
      {/*
        Toaster global — sobrevive a transições de rota (montado fora do
        <Routes>). top-center é o sweet spot mobile: visível com o polegar
        em viewport curto, não conflita com BottomTabs nem WorkoutNavBar.
        richColors usa paleta semântica do Sonner alinhada com light/dark.
      */}
      <Toaster
        theme={theme}
        position="top-center"
        richColors
        closeButton
        duration={4000}
        toastOptions={{ className: 'text-mono text-[13px]' }}
      />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/strava/callback" element={<StravaCallback />} />

        <Route
          path="/aluno/dashboard"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoDashboard /></ProtectedRoute>}
        />
        <Route
          path="/aluno/treino/:id"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoTreino /></ProtectedRoute>}
        />
        <Route
          path="/aluno/calendario"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoCalendario /></ProtectedRoute>}
        />
        <Route
          path="/aluno/rps"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoRPs /></ProtectedRoute>}
        />
        <Route
          path="/aluno/conquistas"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoConquistas /></ProtectedRoute>}
        />
        <Route
          path="/aluno/perfil"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoPerfil /></ProtectedRoute>}
        />
        <Route
          path="/aluno/evolucao"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoEvolucao /></ProtectedRoute>}
        />
        <Route
          path="/aluno/evolucao/nova"
          element={<ProtectedRoute roles={['ALUNO', 'NUTRICIONISTA', 'PROFESSOR']}><AlunoEvolucaoNova /></ProtectedRoute>}
        />
        <Route
          path="/aluno/progresso"
          element={<ProtectedRoute roles={['ALUNO']}><AlunoProgresso /></ProtectedRoute>}
        />

        <Route
          path="/professor/dashboard"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfDashboard /></ProtectedRoute>}
        />
        <Route
          path="/professor/alunos"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfAlunos /></ProtectedRoute>}
        />
        <Route
          path="/professor/aluno/:id"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfAlunoDetalhe /></ProtectedRoute>}
        />
        <Route
          path="/professor/prescrever"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfPrescrever /></ProtectedRoute>}
        />
        <Route
          path="/professor/calendario"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfCalendario /></ProtectedRoute>}
        />
        <Route
          path="/professor/exercicios"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfExercicios /></ProtectedRoute>}
        />
        <Route
          path="/professor/rotina/nova"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfRotinaForm /></ProtectedRoute>}
        />
        <Route
          path="/professor/rotina/:id/editar"
          element={<ProtectedRoute roles={['PROFESSOR']}><ProfRotinaForm /></ProtectedRoute>}
        />

        <Route
          path="/nutri/dashboard"
          element={<ProtectedRoute roles={['NUTRICIONISTA']}><NutriDashboard /></ProtectedRoute>}
        />
        <Route
          path="/nutri/aluno/:id"
          element={<ProtectedRoute roles={['NUTRICIONISTA']}><NutriAlunoDetalhe /></ProtectedRoute>}
        />

        <Route
          path="/admin/cockpit"
          element={<ProtectedRoute roles={['ADMIN']}><AdminCockpit /></ProtectedRoute>}
        />
        <Route
          path="/admin/usuarios"
          element={<ProtectedRoute roles={['ADMIN']}><AdminUsuarios /></ProtectedRoute>}
        />

        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ReloadPrompt />
    </>
  );
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={dashboardPathFor(user.role)} replace />;
  return <Navigate to="/login" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-ink">
      <div className="text-center">
        <div className="text-6xl font-bold tabular text-mono">404</div>
        <div className="text-ink-muted mt-2">Rota não encontrada</div>
      </div>
    </div>
  );
}
