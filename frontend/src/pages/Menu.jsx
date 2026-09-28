import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Menu() {
  const { usuario, logout } = useAuth();

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Menu</p>
        <h1>Olá, {usuario.nome}</h1>
        <p className="hero-sub">
          {usuario.empresa.nome} · {usuario.setor.nome} · {usuario.papel === 'GERENTE' ? 'Gerente' : 'Colaborador'}
        </p>
      </header>

      <ul className="item-list">
        <li>
          <Link to="/meu-porque">Meu Porquê</Link>
          <span>4 perguntas de reflexão</span>
        </li>
        <li aria-disabled="true">
          <span>Calculadora de Meta Comercial</span>
          <span>em breve</span>
        </li>
        <li aria-disabled="true">
          <span>Avaliação DISC</span>
          <span>em breve</span>
        </li>
      </ul>

      <div className="footer-actions">
        <button type="button" className="btn-secondary" onClick={logout}>
          Sair
        </button>
      </div>
    </div>
  );
}
