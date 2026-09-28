import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const FERRAMENTAS = [
  {
    variante: 'meta',
    icone: '📊',
    rotulo: 'Dinâmica 1',
    titulo: 'Calculadora de metas',
    descricao:
      'Transforme o faturamento desejado em meta da área, número de contratos e volume de contatos necessários por mês.',
    href: null,
  },
  {
    variante: 'disc',
    icone: '🧠',
    rotulo: 'Dinâmica 2',
    titulo: 'Avaliação DISC',
    descricao: '40 questões em 2 partes que revelam seu perfil natural, adaptado e a intensidade de cada traço.',
    href: null,
  },
  {
    variante: 'porque',
    icone: '💭',
    rotulo: 'Dinâmica 3',
    titulo: 'Meu Porquê',
    descricao:
      '4 perguntas de reflexão sobre objetivo, sonho, mudança e visão de futuro — sem cálculo, sem perfil, só você no papel.',
    href: '/meu-porque',
  },
];

export default function Ferramentas() {
  const { usuario, logout } = useAuth();

  return (
    <div className="wrap wide">
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="footer-note">
          {usuario.nome} · {usuario.empresa.nome} · {usuario.setor.nome}
        </span>
        <button type="button" className="btn-secondary" onClick={logout} style={{ padding: '8px 16px' }}>
          Sair
        </button>
      </nav>

      <header className="hero" style={{ textAlign: 'center' }}>
        <p className="eyebrow">Treinamento comercial</p>
        <h1>Ferramentas do treinamento</h1>
        <p className="hero-sub" style={{ margin: '0 auto' }}>
          Calculadora de metas comerciais, avaliação de perfil comportamental DISC e a reflexão do Meu Porquê.
          Escolha a dinâmica que o facilitador indicar.
        </p>
        <div className="hero-chips" style={{ justifyContent: 'center' }}>
          <span className="chip">📊 Calculadora de metas</span>
          <span className="chip">🧠 Avaliação DISC</span>
          <span className="chip">💭 Meu Porquê</span>
          <span className="chip">⏱ ~5–20 min cada</span>
        </div>
      </header>

      <div className="tools-grid">
        {FERRAMENTAS.map((f) =>
          f.href ? (
            <Link key={f.variante} className={`tool-card ${f.variante}`} to={f.href}>
              <div className="tool-icon">{f.icone}</div>
              <div>
                <p className="tool-label">{f.rotulo}</p>
                <h2 className="tool-title">{f.titulo}</h2>
                <p className="tool-desc">{f.descricao}</p>
              </div>
              <span className="tool-cta">Acessar →</span>
            </Link>
          ) : (
            <div key={f.variante} className={`tool-card ${f.variante} disabled`}>
              <div className="tool-icon">{f.icone}</div>
              <div>
                <p className="tool-label">{f.rotulo}</p>
                <h2 className="tool-title">{f.titulo}</h2>
                <p className="tool-desc">{f.descricao}</p>
              </div>
              <span className="tool-cta">Em breve</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
