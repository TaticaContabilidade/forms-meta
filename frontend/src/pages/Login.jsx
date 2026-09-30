import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/ferramentas');
    } catch {
      setErro('E-mail ou senha inválidos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Acesso</p>
        <h1>Entrar</h1>
        <p className="hero-sub">Use o e-mail e a senha do seu cadastro de colaborador.</p>
      </header>

      <form className="form-block" onSubmit={handleSubmit}>
        <div className="form-fields">
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </label>
        </div>
        {erro && <p className="callout state-alert" role="alert">{erro}</p>}
        <div className="footer-actions">
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>

      <p className="footer-note">
        Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
      </p>
    </div>
  );
}
