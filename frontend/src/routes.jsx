import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import CadastroColaborador from './pages/CadastroColaborador';
import Login from './pages/Login';
import MeuPorque from './pages/MeuPorque';
import Menu from './pages/Menu';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<CadastroColaborador />} />
      <Route
        path="/menu"
        element={
          <RequireAuth>
            <Menu />
          </RequireAuth>
        }
      />
      <Route
        path="/meu-porque"
        element={
          <RequireAuth>
            <MeuPorque />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
