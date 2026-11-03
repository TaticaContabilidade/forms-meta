import { Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import CadastroColaborador from './pages/CadastroColaborador';
import CalculadoraMeta from './pages/CalculadoraMeta';
import Disc from './pages/Disc';
import Login from './pages/Login';
import MeuPorque from './pages/MeuPorque';
import Perfil from './pages/Perfil';
import Index from "./pages/landing_page.jsx";
import Gestao from "./pages/gestao.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<CadastroColaborador />} />
      <Route
        path="/meu-porque"
        element={
          <RequireAuth>
            <MeuPorque />
          </RequireAuth>
        }
      />
      <Route
        path="/calculadora-meta"
        element={
          <RequireAuth>
            <CalculadoraMeta />
          </RequireAuth>
        }
      />
      <Route
        path="/disc"
        element={
          <RequireAuth>
            <Disc />
          </RequireAuth>
        }
      />
      <Route
        path="/gestao"
        element={
          <RequireAuth>
            <Gestao />
          </RequireAuth>
        }
      />
      <Route
        path="/perfil"
        element={
          <RequireAuth>
            <Perfil />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
