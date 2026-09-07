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

function blur(win, id) {
  win.document.getElementById(id).dispatchEvent(new win.Event('blur', { bubbles: true }));
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

  test('auditoria 2: crescimento pode passar de 100% (meta agressiva legítima), até 500%', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '100000');
    setVal(win, 'crescimentoPct', '200'); // sem travar em 100%: 200.000 de crescimento
    setVal(win, 'churnPct', '0');
    assert.match(texto(win, 'calc6'), /200\.000/);

    setVal(win, 'crescimentoPct', '999'); // acima do teto de 500% -> trava em 500%
    assert.match(texto(win, 'calc6'), /500\.000/);
  });

  test('auditoria 2: churn e conversão continuam travados em 100% (diferente de crescimento)', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', '100000');
    setVal(win, 'crescimentoPct', '0');
    setVal(win, 'churnPct', '999');
    assert.match(texto(win, 'calc6'), /100\.000/); // travado em 100%, não 999%
  });

  test('auditoria 2: filtro de digitação bloqueia letras nos campos numéricos', () => {
    const { window: win } = criarPagina();
    setVal(win, 'faturamento', 'abc200000xyz');
    assert.equal(win.document.getElementById('faturamento').value, '200000');
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

  test('auditoria 2: campos de texto têm limite de tamanho (nome, empresa)', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    assert.equal(doc.getElementById('nomeParticipante').maxLength, 80);
    assert.equal(doc.getElementById('empresaParticipante').maxLength, 80);
  });
});

describe('auditoria 3: validação inline por campo (não só nos botões)', () => {
  test('percentual acima do teto mostra alerta no próprio campo, ao vivo (não só ao enviar)', () => {
    const { window: win } = criarPagina();
    setVal(win, 'crescimentoPct', '999');
    assert.equal(texto(win, 'crescimentoPct-alert'), 'Máximo é 500% — usamos esse limite no cálculo.');
    assert.equal(win.document.getElementById('crescimentoPct-alert').style.display, 'block');
    assert.ok(win.document.getElementById('crescimentoPct').closest('.field').classList.contains('tem-alerta'));
  });

  test('valor negativo mostra alerta no campo, e ele some ao corrigir', () => {
    const { window: win } = criarPagina();
    setVal(win, 'churnPct', '-50');
    assert.match(texto(win, 'churnPct-alert'), /Não aceita valor negativo/);

    setVal(win, 'churnPct', '10');
    assert.equal(texto(win, 'churnPct-alert'), '');
    assert.equal(win.document.getElementById('churnPct-alert').style.display, 'none');
    assert.ok(!win.document.getElementById('churnPct').closest('.field').classList.contains('tem-alerta'));
  });

  test('campo que só aceita >0 (ticket) avisa quando preenchido com zero', () => {
    const { window: win } = criarPagina();
    setVal(win, 'ticket', '0');
    assert.match(texto(win, 'ticket-alert'), /maior que zero/);
  });

  test('campo obrigatório vazio só avisa no blur, não a cada tecla', () => {
    const { window: win } = criarPagina();
    setVal(win, 'ticket', '5');
    setVal(win, 'ticket', ''); // apagou tudo, ainda digitando (sem blur)
    assert.equal(win.document.getElementById('ticket-alert').style.display, 'none');

    blur(win, 'ticket');
    assert.match(texto(win, 'ticket-alert'), /Obrigatório/);
  });

  test('enviar com campo obrigatório vazio acende o alerta de todos os pendentes de uma vez', () => {
    const { window: win } = criarPagina();
    setVal(win, 'nomeParticipante', 'Fulano');
    win.document.getElementById('sendBtn').dispatchEvent(new win.Event('click', { bubbles: true }));
    // nenhum dos 5 campos obrigatórios foi preenchido
    assert.match(texto(win, 'faturamento-alert'), /Obrigatório/);
    assert.match(texto(win, 'ticket-alert'), /Obrigatório/);
    assert.match(texto(win, 'conversaoPct-alert'), /Obrigatório/);
  });
});

describe('validação de obrigatórios (F-03)', () => {
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

  test('recarregar a página restaura nome e campos salvos', () => {
    const dom1 = criarPagina();
    setVal(dom1.window, 'nomeParticipante', 'Ciclana');
    setVal(dom1.window, 'faturamento', '30000');
    const saved = dom1.window.localStorage.getItem('calculadora_meta_state');
    assert.ok(saved);

    // simula fechar e reabrir a página com o localStorage já preenchido
    const dom2 = criarPagina(saved);
    assert.equal(dom2.window.document.getElementById('nomeParticipante').value, 'Ciclana');
    assert.equal(dom2.window.document.getElementById('faturamento').value, '30000');
  });
});
