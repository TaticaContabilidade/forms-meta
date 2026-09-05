// Testa a lógica client-side de public/calculadora.html num DOM real via
// jsdom — sem isso, os 19 achados da auditoria (auditoria_calculadora_meta.md)
// nunca teriam sido pegos por um teste automatizado.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'public', 'calculadora.html');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

function criarPagina(estadoSalvo) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/calculadora.html',
    pretendToBeVisual: true,
    // roda antes do <script> da página ser parseado/executado — é aqui
    // que dá pra simular "reabrir a página com localStorage preenchido".
    beforeParse(window) {
      if (estadoSalvo) window.localStorage.setItem('calculadora_meta_state', estadoSalvo);
    },
  });
  return dom;
}

function setVal(win, id, value) {
  const el = win.document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}

function texto(win, id) {
  return win.document.getElementById(id).textContent;
}

function teamRows(win) {
  return [...win.document.querySelectorAll('#teamBody tr')];
}

function preencherLinhaEquipe(win, tr, { nome, tipo, meta }) {
  if (nome !== undefined) {
    const el = tr.querySelector('.t-name');
    el.value = nome;
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
  }
  if (tipo !== undefined) {
    const el = tr.querySelector('.t-type');
    el.value = tipo;
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  if (meta !== undefined) {
    const el = tr.querySelector('.t-meta');
    el.value = meta;
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
  }
}

describe('calculadora.html — cadeia de cálculo e parsing pt-BR (F-01, F-05, F-06)', () => {
  test('F-01: "200.000" (separador de milhar) é lido como 200000, não 200', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '200.000');
    setVal(win, 'crescimentoPct', '30');
    setVal(win, 'churnPct', '10');
    // linha 6 = fat*30% + fat*10% = fat*40% = 80.000 se fat=200.000; seria "R$ 80" se o bug (fat=200) continuasse
    assert.match(texto(win, 'calc6'), /80\.000/);
  });

  test('F-01: "1.234,00" (milhar + decimal) é lido como 1234, não 1.23400 nem NaN', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '1.234,00');
    setVal(win, 'crescimentoPct', '100');
    setVal(win, 'churnPct', '0');
    assert.match(texto(win, 'calc6'), /1\.234\b/);
  });

  test('F-05: percentual acima de 100% é travado em 100%, não produz meta impossível', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '100000');
    setVal(win, 'crescimentoPct', '0');
    setVal(win, 'churnPct', '200'); // sem clamp: perda de 200.000 sobre base de 100.000
    assert.match(texto(win, 'calc6'), /100\.000/); // com clamp em 100%: perda de só 100.000
  });

  test('F-06: valor negativo é tratado como zero, não atravessa a conta', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '200000');
    setVal(win, 'crescimentoPct', '-30');
    setVal(win, 'churnPct', '0');
    assert.match(texto(win, 'calc6'), /R\$\s*0\b/);
  });

  test('F-12: contrato no singular e formatação decimal pt-BR (vírgula, não ponto)', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '12000');
    setVal(win, 'crescimentoPct', '100');
    setVal(win, 'churnPct', '0'); // linha 8 = 1.000
    setVal(win, 'ticket', '1000'); // linha 10 = 1.000/1.000 = 1 contrato exato
    assert.equal(texto(win, 'calc10'), '1 contrato');

    setVal(win, 'ticket', '135'); // 1000/135 = 7,407... -> "7,4 contratos"
    assert.equal(texto(win, 'calc10'), '7,4 contratos');
    assert.ok(!texto(win, 'calc10').includes('.'), 'não deve usar ponto como separador decimal');
  });
});

describe('validação e equipe (F-03, F-07, F-08, F-14)', () => {
  test('F-03: envio bloqueado se faltar um dos 5 campos que sustentam a conta', () => {
    const { window: win } = criarPagina();
    setVal(win, 'nomeParticipante', 'Fulano');
    // faturamento, crescimentoPct, churnPct, ticket, conversaoPct ficam vazios
    win.document.getElementById('sendBtn').dispatchEvent(new win.Event('click', { bubbles: true }));
    const status = texto(win, 'sendStatus');
    assert.match(status, /linha 1/);
    assert.doesNotMatch(status, /Enviando|sucesso/);
  });

  test('F-03: geração de PDF também é bloqueada com o formulário vazio (reproduzido ao vivo no site)', () => {
    const { window: win } = criarPagina();
    // nenhum campo preenchido — nem nome é exigido aqui, só os 5 da conta
    win.document.getElementById('printBtn').dispatchEvent(new win.Event('click', { bubbles: true }));
    const status = texto(win, 'sendStatus');
    assert.match(status, /linha 1/);
    assert.doesNotMatch(status, /Gerando/);
    assert.equal(win.document.getElementById('printBtn').disabled, false);
  });

  test('F-07: equipe com papéis que não batem com a linha 12/13 mostra alerta', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '12000');
    setVal(win, 'crescimentoPct', '100');
    setVal(win, 'churnPct', '0'); // linha 8 = 1.000
    setVal(win, 'hunterValor', '1000'); // declara 100% hunter

    const [row1, row2] = teamRows(win);
    preencherLinhaEquipe(win, row1, { nome: 'Ana', tipo: 'Hunter', meta: '400' });
    preencherLinhaEquipe(win, row2, { nome: 'Bruno', tipo: 'Farmer', meta: '600' }); // mas equipe só põe 400 em hunter

    const calloutPapel = win.document.getElementById('calloutPapel');
    assert.equal(calloutPapel.style.display, 'block');
    assert.match(calloutPapel.textContent, /R\$\s*400/);
  });

  test('F-08: linha sem nome não entra na soma nem fecha a meta sozinha', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '12000');
    setVal(win, 'crescimentoPct', '100');
    setVal(win, 'churnPct', '0'); // linha 8 = 1.000

    const [row1, row2] = teamRows(win);
    preencherLinhaEquipe(win, row1, { nome: 'Ana', meta: '1000' }); // fecha sozinha
    preencherLinhaEquipe(win, row2, { meta: '500' }); // sem nome — não deve contar

    assert.match(texto(win, 'teamBadgeText'), /Fecha: R\$\s*1\.000 de R\$\s*1\.000/);
    assert.ok(row2.classList.contains('incompleta'));
  });

  test('F-14: não é possível remover a última linha da equipe', () => {
    const { window: win } = criarPagina();
    const [row1, row2] = teamRows(win);
    row1.querySelector('.del-btn').dispatchEvent(new win.Event('click', { bubbles: true }));
    assert.equal(teamRows(win).length, 1);
    row2.querySelector('.del-btn').dispatchEvent(new win.Event('click', { bubbles: true }));
    assert.equal(teamRows(win).length, 1, 'a última linha nunca deve ser removida');
  });
});

describe('persistência local (F-17)', () => {
  test('F-17: recomeçar remove o estado salvo e não regrava um estado vazio na sequência', () => {
    const { window: win } = criarPagina();
    setVal(win, 'nomeParticipante', 'Alguém');
    setVal(win, 'faturamento', '50000');
    assert.ok(win.localStorage.getItem('calculadora_meta_state'));

    win.document.getElementById('resetBtn').dispatchEvent(new win.Event('click', { bubbles: true }));
    win.document.getElementById('confirmResetYes').dispatchEvent(new win.Event('click', { bubbles: true }));

    assert.equal(win.localStorage.getItem('calculadora_meta_state'), null);
  });

  test('recarregar a página restaura nome, campos e equipe salvos', () => {
    const dom1 = criarPagina();
    setVal(dom1.window, 'nomeParticipante', 'Ciclana');
    setVal(dom1.window, 'faturamento', '30000');
    const [row1] = teamRows(dom1.window);
    preencherLinhaEquipe(dom1.window, row1, { nome: 'Duda', tipo: 'Farmer', meta: '250' });
    const saved = dom1.window.localStorage.getItem('calculadora_meta_state');
    assert.ok(saved);

    // simula fechar e reabrir a página com o localStorage já preenchido
    const dom2 = criarPagina(saved);
    assert.equal(dom2.window.document.getElementById('nomeParticipante').value, 'Ciclana');
    assert.equal(dom2.window.document.getElementById('faturamento').value, '30000');
    const linhasRestauradas = teamRows(dom2.window);
    assert.equal(linhasRestauradas[0].querySelector('.t-name').value, 'Duda');
    assert.equal(linhasRestauradas[0].querySelector('.t-meta').value, '250');
  });
});
