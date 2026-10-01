import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

const CAMPOS_INICIAIS = {
  faturamento: '',
  crescimento_pct: '',
  churn_pct: '',
  ticket: '',
  conversao_pct: '',
  contatos_mes_passado: '',
  hunter_valor: '',
};

// pt-BR: "." é sempre separador de milhar, "," é sempre separador decimal
// (mesma convenção de public/calculadora.html) — sem nenhum separador, o
// número é lido como inteiro.
function parseBRNumber(str) {
  if (str === null || str === undefined) return 0;
  const s = String(str).trim();
  if (!s) return 0;
  const normalizado = s.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(normalizado);
  return Number.isNaN(v) ? 0 : v;
}

function fmtBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// Preview só cosmético — mesma matemática de backend/apps/metas/calculo.py,
// mas o valor que de fato é persistido vem da resposta do POST, nunca
// deste cálculo local.
function calcularPreview(form) {
  const faturamento = Math.max(parseBRNumber(form.faturamento), 0);
  const crescimentoPct = Math.min(Math.max(parseBRNumber(form.crescimento_pct), 0), 500);
  const churnPct = Math.min(Math.max(parseBRNumber(form.churn_pct), 0), 100);
  const ticket = Math.max(parseBRNumber(form.ticket), 0);
  const conversaoPct = Math.min(Math.max(parseBRNumber(form.conversao_pct), 0), 100);
  const contatosMesPassado = Math.max(parseBRNumber(form.contatos_mes_passado), 0);
  const hunterValor = Math.max(parseBRNumber(form.hunter_valor), 0);

  const metaAnual = faturamento * (crescimentoPct / 100) + faturamento * (churnPct / 100);
  const metaTrimestral = metaAnual / 4;
  const metaMensal = metaAnual / 12;
  const contratosMesRaw = ticket > 0 ? metaMensal / ticket : 0;
  const contatosNecessariosRaw = conversaoPct > 0 ? contratosMesRaw / (conversaoPct / 100) : 0;
  const contratosMes = Math.round(contratosMesRaw * 10) / 10;
  const contatosNecessarios = Math.ceil(contatosNecessariosRaw);
  const farmerValor = Math.max(metaMensal - hunterValor, 0);

  let calloutContatos = null;
  if (contatosMesPassado > 0 && contatosNecessarios > 0) {
    const razao = contatosMesPassado / contatosNecessarios;
    calloutContatos =
      razao < 0.7
        ? { tipo: 'alert', texto: `O problema não é o vendedor. Você precisa de ${contatosNecessarios} contatos por mês e só entraram ${Math.round(contatosMesPassado)}.` }
        : { tipo: 'ok', texto: `Entraram ${Math.round(contatosMesPassado)} de ${contatosNecessarios} contatos necessários.` };
  }

  let calloutHunter = null;
  if (hunterValor > metaMensal && metaMensal > 0) {
    calloutHunter = { tipo: 'alert', texto: `O valor de hunter (${fmtBRL(hunterValor)}) é maior que a meta mensal da área (${fmtBRL(metaMensal)}).` };
  }

  return { metaAnual, metaTrimestral, metaMensal, contratosMes, contatosNecessarios, farmerValor, calloutContatos, calloutHunter };
}

export default function CalculadoraMeta() {
  const [form, setForm] = useState(CAMPOS_INICIAIS);
  const [equipe, setEquipe] = useState([{ nome: '', tipo: 'Hunter', meta: '' }]);
  const [respostas, setRespostas] = useState([]);
  const [erros, setErros] = useState({});
  const [status, setStatus] = useState({ texto: '', tipo: null });
  const [enviando, setEnviando] = useState(false);

  const preview = useMemo(() => calcularPreview(form), [form]);

  function carregarRespostas() {
    client.get('/api/metas/respostas/').then((resp) => setRespostas(resp.data));
  }

  useEffect(carregarRespostas, []);

  function atualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function atualizarEquipe(idx, campo, valor) {
    setEquipe((e) => e.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  }

  function adicionarLinha() {
    setEquipe((e) => [...e, { nome: '', tipo: 'Hunter', meta: '' }]);
  }

  function removerLinha(idx) {
    setEquipe((e) => (e.length <= 1 ? e : e.filter((_, i) => i !== idx)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErros({});
    setStatus({ texto: '', tipo: null });
    setEnviando(true);
    try {
      const payload = {
        faturamento: parseBRNumber(form.faturamento),
        crescimento_pct: parseBRNumber(form.crescimento_pct),
        churn_pct: parseBRNumber(form.churn_pct),
        ticket: parseBRNumber(form.ticket),
        conversao_pct: parseBRNumber(form.conversao_pct),
        contatos_mes_passado: parseBRNumber(form.contatos_mes_passado),
        hunter_valor: parseBRNumber(form.hunter_valor),
        equipe: equipe
          .filter((p) => p.nome.trim())
          .map((p) => ({ nome: p.nome.trim(), tipo: p.tipo, meta: parseBRNumber(p.meta) })),
      };
      await client.post('/api/metas/respostas/', payload);
      setStatus({ texto: 'Meta enviada com sucesso.', tipo: 'ok' });
      setForm(CAMPOS_INICIAIS);
      setEquipe([{ nome: '', tipo: 'Hunter', meta: '' }]);
      carregarRespostas();
    } catch (err) {
      if (err.response?.status === 400) setErros(err.response.data);
      else setStatus({ texto: 'Não foi possível enviar agora. Tente de novo.', tipo: 'alert' });
    } finally {
      setEnviando(false);
    }
  }

  async function baixarPdf(id) {
    const resp = await client.get(`/api/metas/respostas/${id}/pdf/`, { responseType: 'blob' });
    const disposition = resp.headers['content-disposition'] || '';
    const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) || /filename="([^"]+)"/.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : 'meta comercial.pdf';

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
        <p className="eyebrow">Treinamento comercial · Calculadora</p>
        <h1>Calculadora de meta comercial</h1>
        <p className="hero-sub">
          Transforme o faturamento desejado em meta da área, número de contratos e volume de contatos necessários por
          mês.
        </p>
      </header>

      <div className="stat-cards">
        <div className="stat-card destaque">
          <p className="stat-label">Meta mensal</p>
          <p className="stat-value">{fmtBRL(preview.metaMensal)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Meta trimestral</p>
          <p className="stat-value">{fmtBRL(preview.metaTrimestral)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Meta anual</p>
          <p className="stat-value">{fmtBRL(preview.metaAnual)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-block">
          <div className="form-fields two-col">
            <label>
              Faturamento mensal atual (R$)
              <input
                inputMode="decimal"
                value={form.faturamento}
                onChange={(e) => atualizarCampo('faturamento', e.target.value)}
              />
              {erros.faturamento && <span className="question-pending-msg">{erros.faturamento}</span>}
            </label>
            <label>
              Crescimento desejado no ano (%)
              <input
                inputMode="decimal"
                value={form.crescimento_pct}
                onChange={(e) => atualizarCampo('crescimento_pct', e.target.value)}
              />
              {erros.crescimento_pct && <span className="question-pending-msg">{erros.crescimento_pct}</span>}
            </label>
            <label>
              Perda estimada por churn no ano (%)
              <input
                inputMode="decimal"
                value={form.churn_pct}
                onChange={(e) => atualizarCampo('churn_pct', e.target.value)}
              />
              {erros.churn_pct && <span className="question-pending-msg">{erros.churn_pct}</span>}
            </label>
            <label>
              Ticket médio mensal (R$)
              <input inputMode="decimal" value={form.ticket} onChange={(e) => atualizarCampo('ticket', e.target.value)} />
              {erros.ticket && <span className="question-pending-msg">{erros.ticket}</span>}
            </label>
            <label>
              Taxa de conversão (%)
              <input
                inputMode="decimal"
                value={form.conversao_pct}
                onChange={(e) => atualizarCampo('conversao_pct', e.target.value)}
              />
              {erros.conversao_pct && <span className="question-pending-msg">{erros.conversao_pct}</span>}
            </label>
            <label>
              Contatos feitos no mês passado (opcional)
              <input
                inputMode="decimal"
                value={form.contatos_mes_passado}
                onChange={(e) => atualizarCampo('contatos_mes_passado', e.target.value)}
              />
            </label>
            <label>
              Meta de clientes novos — hunter (R$, opcional)
              <input
                inputMode="decimal"
                value={form.hunter_valor}
                onChange={(e) => atualizarCampo('hunter_valor', e.target.value)}
              />
            </label>
          </div>

          {preview.calloutContatos && (
            <p className={`callout state-${preview.calloutContatos.tipo}`} role="status">
              {preview.calloutContatos.texto}
            </p>
          )}
          {preview.calloutHunter && (
            <p className={`callout state-${preview.calloutHunter.tipo}`} role="status">
              {preview.calloutHunter.texto}
            </p>
          )}
        </div>

        <h2>Equipe comercial</h2>
        <table className="team-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Papel</th>
              <th>Meta mensal (R$)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {equipe.map((pessoa, idx) => (
              <tr key={idx}>
                <td>
                  <input value={pessoa.nome} onChange={(e) => atualizarEquipe(idx, 'nome', e.target.value)} />
                </td>
                <td>
                  <select value={pessoa.tipo} onChange={(e) => atualizarEquipe(idx, 'tipo', e.target.value)}>
                    <option value="Hunter">Hunter</option>
                    <option value="Farmer">Farmer</option>
                  </select>
                </td>
                <td>
                  <input
                    inputMode="decimal"
                    value={pessoa.meta}
                    onChange={(e) => atualizarEquipe(idx, 'meta', e.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="team-del-btn"
                    disabled={equipe.length <= 1}
                    onClick={() => removerLinha(idx)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="team-actions">
          <button type="button" className="btn-secondary" onClick={adicionarLinha}>
            + Adicionar pessoa
          </button>
        </div>

        <div className="footer-actions">
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar minha meta'}
          </button>
        </div>
        {status.texto && (
          <p className={`callout ${status.tipo === 'ok' ? 'state-ok' : 'state-alert'}`} role="status">
            {status.texto}
          </p>
        )}
      </form>

      <h2>Suas metas enviadas</h2>
      {respostas.length === 0 ? (
        <p className="footer-note">Você ainda não enviou nenhuma meta.</p>
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
