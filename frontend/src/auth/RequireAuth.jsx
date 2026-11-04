import {Navigate, useLocation} from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth({ children }) {
  const { usuario, carregando } = useAuth();
  const location = useLocation()
  if (carregando) return <p>Carregando…</p>;
  if (!usuario) return <Navigate to="/login" state={{from: location}} replace />;

  return children;
}
