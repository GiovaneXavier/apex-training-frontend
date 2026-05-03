import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth, dashboardPathFor } from './contexts/AuthContext';

import Login from './pages/auth/Login';
import Cadastro from './pages/auth/Cadastro';

import AlunoDashboard from './pages/aluno/Dashboard';
import AlunoTreino from './pages/aluno/Treino';
import AlunoCalendario from './pages/aluno/Calendario';
import AlunoRPs from './pages/aluno/RPs';
import AlunoPerfil from './pages/aluno/Perfil';

import ProfDashboard from './pages/professor/Dashboard';
import ProfAlunos from './pages/professor/Alunos';
import ProfAlunoDetalhe from './pages/professor/AlunoDetalhe';
import ProfPrescrever from './pages/professor/Prescrever';

import NutriDashboard from './pages/nutricionista/Dashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

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
        path="/aluno/perfil"
        element={<ProtectedRoute roles={['ALUNO']}><AlunoPerfil /></ProtectedRoute>}
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
        path="/nutri/dashboard"
        element={<ProtectedRoute roles={['NUTRICIONISTA']}><NutriDashboard /></ProtectedRoute>}
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
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
