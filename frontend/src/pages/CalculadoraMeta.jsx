import { useEffect, useMemo, useRef, useState } from 'react';
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

// Mesmas regras de public/calculadora.html (REGRAS_CAMPO) — obrigatório,
// teto de percentual e "precisa ser maior que zero" por campo.
const REGRAS_CAMPO = {
  faturamento: { obrigatorio: true, maiorQueZero: true },
  crescimento_pct: { obrigatorio: true, max: 500, percentual: true },
  churn_pct: { obrigatorio: true, max: 100, percentual: true },
  ticket: { obrigatorio: true, maiorQueZero: true },
  conversao_pct: { obrigatorio: true, max: 100, percentual: true, maiorQueZero: true },
  contatos_mes_passado: { obrigatorio: false },
  hunter_valor: { obrigatorio: false },
};

// Mesma ordem/rótulos do CAMPOS_OBRIGATORIOS do Node — validarObrigatorios()
// exige > 0 nos 5, mesmo em crescimento_pct/churn_pct (onde 0 é um valor
// válido pro cálculo, mas o Node nunca deixou enviar com eles zerados).
const CAMPOS_OBRIGATORIOS = [
  { campo: 'faturamento', rotulo: 'Faturamento mensal atual' },
  { campo: 'crescimento_pct', rotulo: 'Crescimento desejado no ano' },
  { campo: 'churn_pct', rotulo: 'Perda estimada por churn no ano' },
  { campo: 'ticket', rotulo: 'Ticket médio mensal' },
  { campo: 'conversao_pct', rotulo: 'Taxa de conversão' },
];

const CAMPOS_PREVIEW_MOEDA = ['faturamento', 'ticket', 'hunter_valor'];

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

function fmtBRLComCentavos(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Mesmo filtro de digitação de public/calculadora.html — restringe o que
// pode ir pro campo a dígitos/"."/","/"-" (não valida, só limpa o que a
// pessoa digitou antes de guardar no estado).
function filtrarDigitacaoNumerica(valor) {
  return valor.replace(/[^0-9.,-]/g, '');
}

// Mesma lógica/mensagens de validarCampo() em public/calculadora.html.
function validarCampo(campo, valorStr, { mostrarObrigatorio }) {
  const regra = REGRAS_CAMPO[campo];
  if (!regra) return '';
  const bruto = (valorStr ?? '').trim();
  const unidade = regra.percentual ? '%' : '';
  if (!bruto) {
    if (regra.obrigatorio && mostrarObrigatorio) return 'Obrigatório para calcular a meta.';
    return '';
  }
  const valor = parseBRNumber(valorStr);
  if (valor < 0) return 'Não aceita valor negativo — usamos 0 no cálculo.';
  if (regra.max !== undefined && valor > regra.max) {
    return `Máximo é ${regra.max}${unidade} — usamos esse limite no cálculo.`;
  }
  if (regra.maiorQueZero && valor === 0) return 'Precisa ser maior que zero para calcular a meta.';
  return '';
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
  const [avisos, setAvisos] = useState({});
  const [equipe, setEquipe] = useState([{ nome: '', tipo: 'Hunter', meta: '' }]);
  const [respostas, setRespostas] = useState([]);
  const [erros, setErros] = useState({});
  const [status, setStatus] = useState({ texto: '', tipo: null });
  const [enviando, setEnviando] = useState(false);
  const inputRefs = useRef({});

  const preview = useMemo(() => calcularPreview(form), [form]);

  function carregarRespostas() {
    client.get('/api/metas/respostas/').then((resp) => setRespostas(resp.data));
  }

  useEffect(carregarRespostas, []);

  function atualizarCampo(campo, valorBruto, { mostrarObrigatorio }) {
    const valor = REGRAS_CAMPO[campo] ? filtrarDigitacaoNumerica(valorBruto) : valorBruto;
    setForm((f) => ({ ...f, [campo]: valor }));
    if (REGRAS_CAMPO[campo]) {
      setAvisos((a) => ({ ...a, [campo]: validarCampo(campo, valor, { mostrarObrigatorio }) }));
    }
  }

  function atualizarEquipe(idx, campo, valor) {
    const valorFiltrado = campo === 'meta' ? filtrarDigitacaoNumerica(valor) : valor;
    setEquipe((e) => e.map((p, i) => (i === idx ? { ...p, [campo]: valorFiltrado } : p)));
  }

  function adicionarLinha() {
    setEquipe((e) => [...e, { nome: '', tipo: 'Hunter', meta: '' }]);
  }

  function removerLinha(idx) {
    setEquipe((e) => (e.length <= 1 ? e : e.filter((_, i) => i !== idx)));
  }

  // Mesma lógica de validarObrigatorios() do Node: acende o aviso de "faltando"
  // nos 5 campos de uma vez (não só no primeiro) e devolve o primeiro que
  // ainda está <= 0, pra focar e mostrar a mensagem de bloqueio do envio.
  function validarObrigatorios() {
    const novosAvisos = {};
    CAMPOS_OBRIGATORIOS.forEach(({ campo }) => {
      novosAvisos[campo] = validarCampo(campo, form[campo], { mostrarObrigatorio: true });
    });
    setAvisos((a) => ({ ...a, ...novosAvisos }));
    for (const item of CAMPOS_OBRIGATORIOS) {
      if (parseBRNumber(form[item.campo]) <= 0) return item;
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErros({});
    setStatus({ texto: '', tipo: null });

    const faltando = validarObrigatorios();
    if (faltando) {
      setStatus({
        texto: `Preencha "${faltando.rotulo}" antes de enviar — sem esse número a meta não fecha.`,
        tipo: 'alert',
      });
      inputRefs.current[faltando.campo]?.focus();
      return;
    }

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
      setAvisos({});
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

  function campo(id, rotulo, { opcional = false } = {}) {
    const mensagem = avisos[id] || erros[id];
    return (
      <label className={mensagem ? 'tem-alerta' : undefined}>
        {rotulo}
        {opcional && ' (opcional)'}
        <input
          ref={(el) => {
            inputRefs.current[id] = el;
          }}
          inputMode="decimal"
          value={form[id]}
          onChange={(e) => atualizarCampo(id, e.target.value, { mostrarObrigatorio: false })}
          onBlur={(e) => atualizarCampo(id, e.target.value, { mostrarObrigatorio: true })}
        />
        {CAMPOS_PREVIEW_MOEDA.includes(id) && (
          <p className="field-preview">{form[id].trim() ? `= ${fmtBRLComCentavos(parseBRNumber(form[id]))}` : ''}</p>
        )}
        {mensagem && <span className="question-pending-msg">{mensagem}</span>}
      </label>
    );
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
            {campo('faturamento', 'Faturamento mensal atual (R$)')}
            {campo('crescimento_pct', 'Crescimento desejado no ano (%)')}
            {campo('churn_pct', 'Perda estimada por churn no ano (%)')}
            {campo('ticket', 'Ticket médio mensal (R$)')}
            {campo('conversao_pct', 'Taxa de conversão (%)')}
            {campo('contatos_mes_passado', 'Contatos feitos no mês passado', { opcional: true })}
            {campo('hunter_valor', 'Meta de clientes novos — hunter (R$)', { opcional: true })}
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
              <tr key={idx} className={!pessoa.nome.trim() && parseBRNumber(pessoa.meta) > 0 ? 'incompleta' : undefined}>
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
