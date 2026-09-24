import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

const PERGUNTAS = [
  { campo: 'objetivo', num: 1, titulo: 'Qual é o seu objetivo?', ajuda: 'O que você quer conquistar — de forma clara e específica.' },
  { campo: 'sonho', num: 2, titulo: 'Qual é o seu sonho?', ajuda: 'Aquilo que você quer de verdade, não o que acham que você deveria querer.' },
  { campo: 'mudanca', num: 3, titulo: 'Qual é a sua mudança?', ajuda: 'O que precisa mudar em você, hoje, pra esse sonho ser possível.' },
  { campo: 'visao_futuro', num: 4, titulo: 'Qual é a sua visão de futuro?', ajuda: 'Como é a sua vida e a sua empresa quando isso acontecer. Escreva como se já fosse real.' },
];

export default function MeuPorque() {
  const [form, setForm] = useState({ objetivo: '', sonho: '', mudanca: '', visao_futuro: '' });
  const [respostas, setRespostas] = useState([]);
  const [erros, setErros] = useState({});
  const [status, setStatus] = useState({ texto: '', tipo: null });
  const [enviando, setEnviando] = useState(false);

  function carregarRespostas() {
    client.get('/api/meu-porque/respostas/').then((resp) => setRespostas(resp.data));
  }

  useEffect(carregarRespostas, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErros({});
    setStatus({ texto: '', tipo: null });
    setEnviando(true);
    try {
      await client.post('/api/meu-porque/respostas/', form);
      setStatus({ texto: 'Respostas enviadas com sucesso. Obrigado por refletir com a gente.', tipo: 'ok' });
      setForm({ objetivo: '', sonho: '', mudanca: '', visao_futuro: '' });
      carregarRespostas();
    } catch (err) {
      if (err.response?.status === 400) setErros(err.response.data);
      else setStatus({ texto: 'Não foi possível enviar agora. Tente de novo.', tipo: 'alert' });
    } finally {
      setEnviando(false);
    }
  }

  async function baixarPdf(id) {
    const resp = await client.get(`/api/meu-porque/respostas/${id}/pdf/`, { responseType: 'blob' });
    const disposition = resp.headers['content-disposition'] || '';
    const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) || /filename="([^"]+)"/.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : 'meu porque.pdf';

    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="wrap">
      <nav>
        <Link to="/ferramentas">← Voltar às ferramentas</Link>
      </nav>

      <header className="hero">
        <p className="eyebrow">Treinamento comercial · Reflexão</p>
        <h1>Meu Porquê</h1>
        <p className="hero-sub">
          4 perguntas simples, sem certo ou errado. Responda com sinceridade — ninguém vai corrigir sua resposta, só
          você mesmo vai ler ela de novo daqui a um tempo.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        {PERGUNTAS.map(({ campo, num, titulo, ajuda }) => (
          <fieldset key={campo} className={`question-block${erros[campo] ? ' pending' : ''}`}>
            <legend className="question-header">
              <span className="question-num">{num}</span>
              <span className="question-text">{titulo}</span>
            </legend>
            <p className="question-help">{ajuda}</p>
            <label className="sr-only" htmlFor={campo}>
              {titulo}
            </label>
            <textarea
              id={campo}
              rows={campo === 'visao_futuro' ? 4 : 3}
              placeholder="Escreva aqui..."
              value={form[campo]}
              onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
            />
            {erros[campo] && <p className="question-pending-msg">{erros[campo]}</p>}
          </fieldset>
        ))}

        <div className="footer-actions">
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar minhas respostas'}
          </button>
        </div>
        {status.texto && (
          <p className={`callout ${status.tipo === 'ok' ? 'state-ok' : 'state-alert'}`} role="status">
            {status.texto}
          </p>
        )}
      </form>

      <h2>Suas respostas</h2>
      {respostas.length === 0 ? (
        <p className="footer-note">Você ainda não enviou nenhuma resposta.</p>
      ) : (
        <ul className="item-list">
          {respostas.map((r) => (
            <li key={r.id}>
              <span>{r.criado_em}</span>
              <button type="button" className="btn-secondary" onClick={() => baixarPdf(r.id)}>
                Baixar PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
