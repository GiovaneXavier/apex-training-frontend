import { Navigate, Route, Routes } from 'react-router-dom';

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
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      <Route path="/aluno/dashboard" element={<AlunoDashboard />} />
      <Route path="/aluno/treino/:id" element={<AlunoTreino />} />
      <Route path="/aluno/calendario" element={<AlunoCalendario />} />
      <Route path="/aluno/rps" element={<AlunoRPs />} />
      <Route path="/aluno/perfil" element={<AlunoPerfil />} />

      <Route path="/professor/dashboard" element={<ProfDashboard />} />
      <Route path="/professor/alunos" element={<ProfAlunos />} />
      <Route path="/professor/aluno/:id" element={<ProfAlunoDetalhe />} />
      <Route path="/professor/prescrever" element={<ProfPrescrever />} />

      <Route path="/nutri/dashboard" element={<NutriDashboard />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
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
