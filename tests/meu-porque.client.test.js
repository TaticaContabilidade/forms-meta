// Testa a lógica client-side de public/meu-porque.html num DOM real via
// jsdom — validação (nome + as 4 perguntas obrigatórias antes de enviar ou
// gerar PDF) e persistência local (localStorage), mesmos padrões já usados
// em calculadora.client.test.js e disc.client.test.js.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'public', 'meu-porque.html');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

const virtualConsole = new VirtualConsole();

function criarPagina(estadoSalvo) {
  return new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/meu-porque.html',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      if (estadoSalvo) window.localStorage.setItem('meu_porque_state', estadoSalvo);
    },
  });
}

function input(win, el) {
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}
function click(win, el) {
  el.dispatchEvent(new win.Event('click', { bubbles: true }));
}

function preencherTudo(win) {
  const doc = win.document;
  doc.getElementById('nomeParticipante').value = 'Ciclana';
  input(win, doc.getElementById('nomeParticipante'));
  doc.getElementById('empresaParticipante').value = 'Empresa Y';
  input(win, doc.getElementById('empresaParticipante'));
  doc.getElementById('objetivo').value = 'Crescer 30% no ano';
  input(win, doc.getElementById('objetivo'));
  doc.getElementById('sonho').value = 'Ter uma equipe que roda sem mim';
  input(win, doc.getElementById('sonho'));
  doc.getElementById('mudanca').value = 'Delegar de verdade';
  input(win, doc.getElementById('mudanca'));
  doc.getElementById('visaoFuturo').value = 'Uma empresa que funciona sem mim apagando incêndio';
  input(win, doc.getElementById('visaoFuturo'));
}

describe('validação antes de enviar/gerar PDF', () => {
  test('sem nome, foca o campo de nome e não deixa enviar', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    click(win, doc.getElementById('sendBtn'));
    assert.equal(win.document.activeElement, doc.getElementById('nomeParticipante'));
    assert.match(doc.getElementById('sendStatus').textContent, /Preencha seu nome/);
  });

  test('com nome mas sem as perguntas, sinaliza TODOS os blocos pendentes de uma vez', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    doc.getElementById('nomeParticipante').value = 'Ciclana';
    input(win, doc.getElementById('nomeParticipante'));

    click(win, doc.getElementById('sendBtn'));

    assert.match(doc.getElementById('sendStatus').textContent, /Responda todas as perguntas/);
    ['objetivo', 'sonho', 'mudanca', 'visaoFuturo'].forEach((id) => {
      assert.ok(doc.getElementById('bloco-' + id).classList.contains('pending'), `bloco-${id} deveria estar pendente`);
    });
  });

  test('responder uma pergunta pendente remove o alerta dela na hora, sem esperar novo envio', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    doc.getElementById('nomeParticipante').value = 'Ciclana';
    input(win, doc.getElementById('nomeParticipante'));
    click(win, doc.getElementById('sendBtn'));
    assert.ok(doc.getElementById('bloco-objetivo').classList.contains('pending'));

    doc.getElementById('objetivo').value = 'Crescer 30%';
    input(win, doc.getElementById('objetivo'));

    assert.ok(!doc.getElementById('bloco-objetivo').classList.contains('pending'));
  });

  test('o botão "Salvar PDF" usa a mesma validação do "Enviar"', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    click(win, doc.getElementById('btnPdf'));
    assert.equal(win.document.activeElement, doc.getElementById('nomeParticipante'));
    assert.match(doc.getElementById('sendStatus').textContent, /Preencha seu nome antes de gerar o PDF/);
  });
});

describe('persistência local', () => {
  test('as 4 respostas e a identidade sobrevivem a um "reload"', () => {
    const dom1 = criarPagina();
    preencherTudo(dom1.window);

    const saved = dom1.window.localStorage.getItem('meu_porque_state');
    assert.ok(saved);
    assert.match(saved, /Ciclana/);

    const dom2 = criarPagina(saved);
    const doc2 = dom2.window.document;
    assert.equal(doc2.getElementById('nomeParticipante').value, 'Ciclana');
    assert.equal(doc2.getElementById('empresaParticipante').value, 'Empresa Y');
    assert.equal(doc2.getElementById('objetivo').value, 'Crescer 30% no ano');
    assert.equal(doc2.getElementById('sonho').value, 'Ter uma equipe que roda sem mim');
    assert.equal(doc2.getElementById('mudanca').value, 'Delegar de verdade');
    assert.equal(doc2.getElementById('visaoFuturo').value, 'Uma empresa que funciona sem mim apagando incêndio');
  });
});
