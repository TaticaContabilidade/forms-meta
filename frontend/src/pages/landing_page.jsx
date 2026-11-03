import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '/src/style/landing_page.css';
import { useAuth } from "../auth/AuthContext.jsx";
import ToolCard from '../components/ToolCard';

const TEMPO_AVISO_SESSAO_MS = 6 * 1000;

const MENSAGENS_SESSAO = {
  expirada: { texto: 'Sua sessão expirou por inatividade. Faça login novamente.', tipo: 'alert' },
  encerrada: { texto: 'Você saiu da sua conta.', tipo: 'ok' },
};

const CATEGORIAS = [
  {
    variante: 'pessoal',
    icone: '📊',
    titulo: 'Departamento Pessoal',
    descricao: 'Ferramentas pra apoiar a tomada de decisão dos gestores.',
    href: '/gestao',
  },
  {
    variante: 'financeiro',
    icone: '💰',
    titulo: 'Financeiro',
    descricao: 'Ferramentas pra área financeira da empresa.',
    href: null, // ainda não existe página/rota pra /financeiro
  },
];

export default function Index() {
  const {usuario: user, sair} = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [avisoSessao, setAvisoSessao] = useState(() => MENSAGENS_SESSAO[searchParams.get('sessao')] ?? null)

  // Some o ?sessao=... da URL assim que a página carrega — não precisa
  // ficar lá (reload/compartilhar o link não deveria reexibir o aviso).
  useEffect(() => {
    if (searchParams.has('sessao')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!avisoSessao) return
    const id = setTimeout(() => setAvisoSessao(null), TEMPO_AVISO_SESSAO_MS)
    return () => clearTimeout(id)
  }, [avisoSessao])

  return (
    <div className="wrap wide">
      {avisoSessao && (
        <p className={`callout state-${avisoSessao.tipo}`} role={avisoSessao.tipo === 'alert' ? 'alert' : 'status'}>
          {avisoSessao.texto}
        </p>
      )}

      <header className="landing-header">
        <Link to="/" className="landing-brand">
          <img src="/logo-tatica.png" alt="Logo Tática" className="landing-logo" />
          <span className="landing-brand-name">Tática</span>
        </Link>
        <nav className="landing-nav">
          <Link to="/gestao">Gestão</Link>
          <Link to="/financeiro">Financeiro</Link>
          {user && <Link to="/perfil">Perfil</Link>}
          {user ? (
            <button type="button" className="btn-primary" onClick={sair}>
              Sair
            </button>
          ): (
            <Link to="/login" className="btn-primary">
              Login
            </Link>
          )}
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Gestão Tática Contabilidade</p>
        <h1>Seja bem-vindo a Gestão Tática Contabilidade</h1>
        <p className="hero-sub">
          Aqui você irá encontrar ferramentas que iram auxiliar os gestores
          na tomada de decisão, e mais.
        </p>
        <div className="hero-chips">
          <span className="chip">📊 Calculadora de metas</span>
          <span className="chip">🧠 Avaliação DISC</span>
        </div>
      </section>

      <section className="tools-grid">
        {CATEGORIAS.map((c) => (
          <ToolCard key={c.variante} ferramenta={c} />
        ))}
      </section>

      <p className="landing-footer">© 2026 Tática Gestão Contábil. Todos os direitos reservados.</p>
    </div>
  );
}
