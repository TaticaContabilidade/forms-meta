import { Link } from 'react-router-dom';

export default function ToolCard({ ferramenta }) {
  const { variante, icone, rotulo, titulo, descricao, href } = ferramenta;

  const conteudo = (
    <>
      <div className="tool-icon">{icone}</div>
      <div>
        {rotulo && <p className="tool-label">{rotulo}</p>}
        <h2 className="tool-title">{titulo}</h2>
        <p className="tool-desc">{descricao}</p>
      </div>
      <span className="tool-cta">{href ? 'Acessar →' : 'Em breve'}</span>
    </>
  );

  if (!href) {
    return <div className={`tool-card ${variante} disabled`}>{conteudo}</div>;
  }

  return (
    <Link to={href} className={`tool-card ${variante}`}>
      {conteudo}
    </Link>
  );
}
