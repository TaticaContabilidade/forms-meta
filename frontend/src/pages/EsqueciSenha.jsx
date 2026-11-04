import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      await client.post('/api/auth/esqueci-senha/', { email });
    } finally {
      // Sempre mostra a mesma mensagem, dê certo ou erro — não revela se
      // o e-mail existe ou não (o backend já segue essa mesma regra).
      setEnviando(false);
      setEnviado(true);
    }
  }

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Acesso</p>
        <h1>Esqueci minha senha</h1>
        <p className="hero-sub">
          Informe o e-mail do seu cadastro. Se ele existir, enviamos um link pra você escolher uma senha nova.
        </p>
      </header>

      {enviado ? (
        <p className="callout state-ok" role="status">
          Se esse e-mail existir, enviamos um link de redefinição. Confira sua caixa de entrada (e o spam).
        </p>
      ) : (
        <form className="form-block" onSubmit={handleSubmit}>
          <div className="form-fields">
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          </div>
          <div className="footer-actions">
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar link de redefinição'}
            </button>
          </div>
        </form>
      )}

      <p className="footer-note">
        <Link to="/login">← Voltar pro login</Link>
      </p>
    </div>
  );
}
