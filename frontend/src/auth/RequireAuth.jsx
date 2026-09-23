import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth({ children }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <p>Carregando…</p>;
  if (!usuario) return <Navigate to="/login" replace />;

  return children;
}
