import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Menu() {
  const { usuario, logout } = useAuth();

  return (
    <main>
      <h1>Olá, {usuario.nome}</h1>
      <p>
        {usuario.empresa.nome} · {usuario.setor.nome} · {usuario.papel === 'GERENTE' ? 'Gerente' : 'Colaborador'}
      </p>
      <nav>
        <ul>
          <li>
            <Link to="/meu-porque">Meu Porquê</Link>
          </li>
          <li aria-disabled="true">Calculadora de Meta Comercial (em breve)</li>
          <li aria-disabled="true">Avaliação DISC (em breve)</li>
        </ul>
      </nav>
      <button type="button" onClick={logout}>
        Sair
      </button>
    </main>
  );
}
