import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const linkInvalido = !uid || !token;

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não são iguais.');
      return;
    }
    setEnviando(true);
    try {
      await client.post('/api/auth/redefinir-senha/', { uid, token, nova_senha: novaSenha });
      setSucesso(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Não foi possível redefinir a senha agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Acesso</p>
        <h1>Redefinir senha</h1>
        <p className="hero-sub">Escolha a nova senha da sua conta.</p>
      </header>

      {linkInvalido ? (
        <p className="callout state-alert" role="alert">
          Link inválido. Peça um novo link em <Link to="/esqueci-senha">esqueci minha senha</Link>.
        </p>
      ) : sucesso ? (
        <p className="callout state-ok" role="status">
          Senha redefinida com sucesso. Te levando pro login…
        </p>
      ) : (
        <form className="form-block" onSubmit={handleSubmit}>
          <div className="form-fields">
            <label>
              Nova senha
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                minLength={8}
                required
              />
            </label>
          </div>
          {erro && <p className="callout state-alert" role="alert">{erro}</p>}
          <div className="footer-actions">
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Redefinir senha'}
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
