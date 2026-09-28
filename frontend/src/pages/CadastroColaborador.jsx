import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function CadastroColaborador() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', empresa_id: '', setor_id: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    client.get('/api/contas/empresas/').then((resp) => setEmpresas(resp.data));
  }, []);

  useEffect(() => {
    if (!form.empresa_id) {
      setSetores([]);
      return;
    }
    client
      .get('/api/contas/setores/', { params: { empresa_id: form.empresa_id } })
      .then((resp) => setSetores(resp.data));
  }, [form.empresa_id]);

  function handleEmpresaChange(e) {
    setForm((f) => ({ ...f, empresa_id: e.target.value, setor_id: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await client.post('/api/auth/cadastro/colaborador/', form);
      navigate('/login');
    } catch (err) {
      const detalhe = err.response?.data;
      setErro(detalhe ? Object.values(detalhe).flat().join(' ') : 'Não foi possível concluir o cadastro.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Cadastro</p>
        <h1>Cadastro de colaborador</h1>
        <p className="hero-sub">Escolha sua empresa e o setor que você faz parte pra ter acesso às ferramentas.</p>
      </header>

      <form className="form-block" onSubmit={handleSubmit}>
        <div className="form-fields">
          <label>
            Nome
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              minLength={8}
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              required
            />
          </label>
          <div className="form-fields two-col">
            <label>
              Empresa
              <select value={form.empresa_id} onChange={handleEmpresaChange} required>
                <option value="">Selecione…</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Setor
              <select
                value={form.setor_id}
                onChange={(e) => setForm((f) => ({ ...f, setor_id: e.target.value }))}
                disabled={!form.empresa_id}
                required
              >
                <option value="">Selecione…</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {erro && <p className="callout state-alert" role="alert">{erro}</p>}
        <div className="footer-actions">
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </div>
      </form>

      <p className="footer-note">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
