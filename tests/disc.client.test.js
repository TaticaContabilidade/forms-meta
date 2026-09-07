// Testa a lógica client-side de public/disc.html num DOM real via jsdom —
// cobre especificamente os achados de auditoria-avaliacao-disc.md que
// foram corrigidos (D-01, D-03 a D-06, D-08, D-09, D-12) e a estrutura
// fieldset/legend usada pra resolver D-01/D-03.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'public', 'disc.html');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

// showPart() chama window.scrollTo(), que o jsdom não implementa de verdade
// — funciona (não lança erro), só avisa no console a cada chamada. Um
// virtualConsole próprio (sem .sendTo(console)) evita esse ruído nos testes.
const virtualConsole = new VirtualConsole();

function criarPagina(estadoSalvo) {
  return new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/disc.html',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      if (estadoSalvo) window.localStorage.setItem('disc_state', estadoSalvo);
    },
  });
}

function change(win, el) {
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}
function input(win, el) {
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}
function click(win, el) {
  el.dispatchEvent(new win.Event('click', { bubbles: true }));
}

// Preenche a avaliação inteira de forma determinística: em cada bloco da
// Parte A marca MAIS na 1ª palavra e MENOS na 2ª (ordem sempre D,I,S,C —
// ver disc_avaliacao_opcoes.md), na Parte B escolhe sempre a 1ª opção, e
// na Parte C responde sempre 3. Resultado 100% previsível:
//   natural : D +28, I -28, S 0, C 0   (dominante = D, sem empate)
//   adaptado: D +16, I 0,  S 0, C 0
//   intensidade: D=I=S=C=3.0 (spread 0 -> dispara o aviso do D-05)
// Completa Parte B (sempre a 1ª opção) e Parte C (sempre nota 3) e finaliza.
function completarParteBC(win) {
  const doc = win.document;

  doc.querySelectorAll('#situationsB fieldset').forEach((fs, sIdx) => {
    const opts = fs.querySelectorAll(`input[name="b${sIdx}"]`);
    opts[0].checked = true; change(win, opts[0]);
  });
  click(win, doc.getElementById('btnBtoC'));

  doc.querySelectorAll('#intensityC fieldset').forEach((fs, aIdx) => {
    const opts = [...fs.querySelectorAll(`input[name="c${aIdx}"]`)];
    const nota3 = opts.find((o) => o.value === '3');
    nota3.checked = true; change(win, nota3);
  });
  click(win, doc.getElementById('btnFinish'));
}

function completarAvaliacao(win) {
  const doc = win.document;

  doc.querySelectorAll('#blocksA fieldset').forEach((fs, bIdx) => {
    const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
    const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
    mais[0].checked = true; change(win, mais[0]);
    menos[1].checked = true; change(win, menos[1]);
  });
  click(win, doc.getElementById('btnAtoB'));

  completarParteBC(win);
}

describe('estrutura de foco/marcação (D-01, D-03)', () => {
  test('D-01: os 348 radios não são mais display:none e ficam focáveis', () => {
    const { window: win } = criarPagina();
    const radio = win.document.querySelector('input[name="a0_mais"]');
    assert.notEqual(win.getComputedStyle(radio).display, 'none');
    radio.focus();
    assert.equal(win.document.activeElement, radio);
  });

  test('D-01: cada bloco/situação/afirmação vira <fieldset> com <legend> como 1º filho', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    assert.equal(doc.querySelectorAll('#blocksA fieldset').length, 28);
    assert.equal(doc.querySelectorAll('#situationsB fieldset').length, 16);
    assert.equal(doc.querySelectorAll('#intensityC fieldset').length, 12);
    assert.equal(doc.querySelector('#blocksA fieldset').firstElementChild.tagName, 'LEGEND');
    assert.equal(doc.querySelector('#situationsB fieldset').firstElementChild.tagName, 'LEGEND');
    assert.equal(doc.querySelector('#intensityC fieldset').firstElementChild.tagName, 'LEGEND');
  });

  test('D-03: o radio da Parte A tem aria-labelledby ligando a frase da opção ao chip MAIS/MENOS', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const radioMais = doc.querySelector('input[name="a0_mais"]');
    const labelledby = radioMais.getAttribute('aria-labelledby');
    assert.ok(labelledby, 'esperava aria-labelledby no radio');
    const [textId] = labelledby.split(' ');
    const textoEl = doc.getElementById(textId);
    assert.ok(textoEl, 'id da frase referenciado não existe');
    assert.match(textoEl.textContent, /Decidido/);
  });
});

describe('Parte A permite marcar mais de uma palavra por grupo (Mais/Menos)', () => {
  test('marcar 2 opções como Mais (e 2 como Menos) no mesmo bloco não é bloqueado, e o bloco conta como respondido', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');
    const menos = fieldset.querySelectorAll('input[name="a0_menos"]');

    mais[0].checked = true; change(win, mais[0]);
    mais[3].checked = true; change(win, mais[3]);
    menos[1].checked = true; change(win, menos[1]);
    menos[2].checked = true; change(win, menos[2]);

    assert.ok(mais[0].checked && mais[3].checked, 'as duas opções marcadas como Mais deveriam continuar marcadas');
    assert.ok(menos[1].checked && menos[2].checked, 'as duas opções marcadas como Menos deveriam continuar marcadas');
    assert.ok(!fieldset.classList.contains('conflict'), 'marcar 2 opções distintas em cada grupo não é conflito');
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);
  });

  test('marcar a mesma palavra como Mais e Menos continua sendo bloqueado (conflito) e não conta como respondido', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');
    const menos = fieldset.querySelectorAll('input[name="a0_menos"]');

    mais[0].checked = true; change(win, mais[0]);
    menos[1].checked = true; change(win, menos[1]);
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);

    menos[0].checked = true; change(win, menos[0]);
    assert.ok(fieldset.classList.contains('conflict'), 'marcar a mesma opção nos 2 grupos deveria sinalizar conflito');
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28/);
  });

  test('o cálculo do perfil natural soma/subtrai o traço de cada palavra marcada, mesmo com múltiplas por grupo', () => {
    const { window: win } = criarPagina();
    const doc = win.document;

    doc.querySelectorAll('#blocksA fieldset').forEach((fs, bIdx) => {
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
      if (bIdx === 0) {
        // Bloco 0: Mais em D (idx0) e C (idx3); Menos em I (idx1) e S (idx2).
        mais[0].checked = true; change(win, mais[0]);
        mais[3].checked = true; change(win, mais[3]);
        menos[1].checked = true; change(win, menos[1]);
        menos[2].checked = true; change(win, menos[2]);
      } else {
        mais[0].checked = true; change(win, mais[0]);
        menos[1].checked = true; change(win, menos[1]);
      }
    });
    click(win, doc.getElementById('btnAtoB'));
    completarParteBC(win);

    // Baseline dos outros 27 blocos: D +27, I -27. Bloco 0 soma D+1, C+1, I-1, S-1.
    const barras = [...doc.querySelectorAll('#barsNatural .bar-value')].map((el) => el.textContent);
    assert.deepEqual(barras, ['+28', '-28', '-1', '+1']);
  });
});

describe('resultado calculado (D-04, D-05, D-06, D-09, D-12)', () => {
  test('D-04: compara natural x adaptado e comenta o traço que mais mudou', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    const delta = win.document.getElementById('adaptacaoDelta');
    assert.equal(delta.style.display, 'block');
    // maior delta entre os 4 traços é Influência: |0 - (-28)| = 28
    assert.match(delta.textContent, /Influência/);
    assert.match(delta.textContent, /28 pontos/);
  });

  test('D-05: intensidades idênticas (3.0 em tudo) disparam o aviso de respostas pouco diferenciadas', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    const aviso = win.document.getElementById('intensidadeAviso');
    assert.equal(aviso.style.display, 'block');
    assert.match(aviso.textContent, /pouco diferenciadas/);
  });

  test('D-05: o texto de "como você performa" é modulado pela intensidade medida (3.0 = moderada)', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    const performa = win.document.getElementById('insightPerforma').textContent;
    assert.match(performa, /intensidade de Dominância é moderada/);
    assert.match(performa, /3,0 de 5/);
  });

  test('D-06: os cards de referência usam texto neutro (não repetem "Perfil dominante" 4x) e destacam o do participante', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    const cardsHtml = win.document.getElementById('discCards').innerHTML;
    assert.doesNotMatch(cardsHtml, /Perfil dominante/);
    const cardD = win.document.querySelector('.disc-card.d');
    assert.ok(cardD.classList.contains('own'), 'card do traço dominante (D) deveria ter a classe own');
    assert.match(cardD.innerHTML, /Seu perfil/);
    const cardI = win.document.querySelector('.disc-card.i');
    assert.ok(!cardI.classList.contains('own'), 'card de um traço não-dominante não deveria ter a classe own');
  });

  test('D-09: aviso de nome faltando foca o campo (não fica só no rodapé)', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    // não preenche nomeDisc
    click(win, win.document.getElementById('btnSend'));
    assert.equal(win.document.activeElement, win.document.getElementById('nomeDisc'));
    assert.match(win.document.getElementById('sendStatus').textContent, /Preencha seu nome/);
  });

  test('D-12: "Refazer avaliação" usa confirmação inline, não confirm() nativo', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    let confirmChamado = false;
    win.confirm = () => { confirmChamado = true; return true; };

    click(win, win.document.getElementById('btnReset'));
    assert.equal(confirmChamado, false, 'não deveria ter chamado window.confirm()');
    assert.equal(win.document.getElementById('confirmReset').style.display, 'block');

    click(win, win.document.getElementById('confirmResetYes'));
    assert.equal(win.document.getElementById('confirmReset').style.display, 'none');
    assert.equal(win.document.getElementById('progressLabelA').textContent, '0 de 28 blocos respondidos');
  });
});

describe('persistência de identidade (D-08)', () => {
  test('nome e empresa sobrevivem a um "reload" (localStorage preenchido antes do script rodar)', () => {
    const dom1 = criarPagina();
    const nomeInput = dom1.window.document.getElementById('nomeDisc');
    nomeInput.value = 'Ciclana';
    input(dom1.window, nomeInput);
    const empresaInput = dom1.window.document.getElementById('empresaDisc');
    empresaInput.value = 'Empresa Y';
    input(dom1.window, empresaInput);

    const saved = dom1.window.localStorage.getItem('disc_state');
    assert.ok(saved);
    assert.match(saved, /Ciclana/);

    const dom2 = criarPagina(saved);
    assert.equal(dom2.window.document.getElementById('nomeDisc').value, 'Ciclana');
    assert.equal(dom2.window.document.getElementById('empresaDisc').value, 'Empresa Y');
  });
});

describe('compatibilidade com disc_state salvo no formato antigo (regressão)', () => {
  // Antes da Parte A permitir múltipla escolha, respostasA[bIdx] guardava
  // { mais: wordIdx, menos: wordIdx } (valor único, não array). Quem tinha
  // uma avaliação em andamento salva nesse formato não pode ficar com a
  // página quebrada ao recarregar depois do deploy da mudança.
  test('disc_state com mais/menos como número único (formato pré-múltipla-escolha) não quebra o carregamento da página', () => {
    const estadoAntigo = JSON.stringify({
      part: 'A',
      nomeDisc: 'Fulano',
      empresaDisc: 'Empresa Z',
      respostasA: { 0: { mais: 2, menos: 1 } },
      respostasB: {},
      respostasC: {},
    });
    const { window: win } = criarPagina(estadoAntigo);
    const doc = win.document;

    assert.equal(doc.getElementById('blocksA').children.length, 28, 'os 28 blocos da Parte A deveriam renderizar');
    assert.equal(doc.getElementById('situationsB').children.length, 16);
    assert.equal(doc.getElementById('intensityC').children.length, 12);
    assert.equal(doc.getElementById('nomeDisc').value, 'Fulano');

    // a marcação antiga (mais=2, menos=1) foi migrada e continua marcada
    assert.ok(doc.querySelector('input[name="a0_mais"][value="2"]').checked);
    assert.ok(doc.querySelector('input[name="a0_menos"][value="1"]').checked);
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);
  });
});
