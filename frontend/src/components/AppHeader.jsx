import { useAuth } from '../auth/AuthContext';
import { Link, useNavigate } from "react-router-dom";

export default function AppHeader() {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate()
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
        ← Voltar
      </button>
      <Link to="/perfil" className="footer-note">
        {usuario.nome} · {usuario.empresa.nome} · {usuario.setor.nome}
      </Link>
      <button type="button" className="btn-secondary" onClick={sair} style={{ padding: '8px 16px' }}>
        Sair
      </button>
    </nav>
  );
}
