import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

const PERGUNTAS = [
  { campo: 'objetivo', label: 'Qual é o seu objetivo?' },
  { campo: 'sonho', label: 'Qual é o seu sonho?' },
  { campo: 'mudanca', label: 'Qual é a sua mudança?' },
  { campo: 'visao_futuro', label: 'Qual é a sua visão de futuro?' },
];

export default function MeuPorque() {
  const [form, setForm] = useState({ objetivo: '', sonho: '', mudanca: '', visao_futuro: '' });
  const [respostas, setRespostas] = useState([]);
  const [erros, setErros] = useState({});
  const [status, setStatus] = useState('');
  const [enviando, setEnviando] = useState(false);

  function carregarRespostas() {
    client.get('/api/meu-porque/respostas/').then((resp) => setRespostas(resp.data));
  }

  useEffect(carregarRespostas, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErros({});
    setStatus('');
    setEnviando(true);
    try {
      await client.post('/api/meu-porque/respostas/', form);
      setStatus('Respostas enviadas com sucesso. Obrigado por refletir com a gente.');
      setForm({ objetivo: '', sonho: '', mudanca: '', visao_futuro: '' });
      carregarRespostas();
    } catch (err) {
      if (err.response?.status === 400) setErros(err.response.data);
      else setStatus('Não foi possível enviar agora. Tente de novo.');
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
    <main>
      <p>
        <Link to="/menu">← Voltar ao menu</Link>
      </p>
      <h1>Meu Porquê</h1>
      <form onSubmit={handleSubmit}>
        {PERGUNTAS.map(({ campo, label }) => (
          <label key={campo}>
            {label}
            <textarea
              value={form[campo]}
              onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
              required
            />
            {erros[campo] && <span role="alert">{erros[campo]}</span>}
          </label>
        ))}
        {status && <p role="status">{status}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar minhas respostas'}
        </button>
      </form>

      <h2>Suas respostas</h2>
      {respostas.length === 0 ? (
        <p>Você ainda não enviou nenhuma resposta.</p>
      ) : (
        <ul>
          {respostas.map((r) => (
            <li key={r.id}>
              {r.criado_em}{' '}
              <button type="button" onClick={() => baixarPdf(r.id)}>
                Baixar PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
