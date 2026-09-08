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

// Completa a Parte A (escolha forçada: 1 Mais + 1 Menos por bloco) e clica
// "Continuar para Parte B". D sempre Mais, I sempre Menos, em todos os 28
// blocos — natural determinístico D+28, I-28, S0, C0.
function completarParteA(win) {
  const doc = win.document;
  doc.querySelectorAll('#blocksA fieldset').forEach((fs, bIdx) => {
    const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
    const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
    mais[0].checked = true; change(win, mais[0]); // D
    menos[1].checked = true; change(win, menos[1]); // I
  });
  click(win, doc.getElementById('btnAtoB'));
}

function completarAvaliacao(win) {
  completarParteA(win);
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

describe('N-05 do reteste: Parte A volta a ser escolha forçada (radio, 1 Mais + 1 Menos por bloco)', () => {
  test('marcar uma 2ª palavra como Mais desmarca a 1ª automaticamente — exclusividade nativa do radio', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');

    mais[0].checked = true; change(win, mais[0]);
    assert.ok(mais[0].checked);

    mais[3].checked = true; change(win, mais[3]);
    assert.ok(mais[3].checked, 'a nova marcação deveria ficar marcada');
    assert.ok(!mais[0].checked, 'o radio nativo deveria ter desmarcado a marcação anterior — não dá pra ter 2 Mais no mesmo bloco');
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

    // marca a palavra 0 (já em Mais) também em Menos -> conflito
    menos[0].checked = true; change(win, menos[0]);
    assert.ok(fieldset.classList.contains('conflict'), 'marcar a mesma opção nos 2 grupos deveria sinalizar conflito');
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28/);
  });

  test('bloco com só Mais ou só Menos marcado (não os dois) não conta como respondido e mostra o alerta de pendente', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');

    mais[0].checked = true; change(win, mais[0]); // só o Mais, falta o Menos

    assert.ok(!fieldset.classList.contains('conflict'), 'não há conflito, só falta o Menos');
    assert.ok(fieldset.classList.contains('pending'), 'deveria sinalizar como pendente por faltar o Menos');
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28/);
  });

  test('o total de pontos do perfil natural é sempre o mesmo (28 blocos x ±1), não varia por padrão de preenchimento — propriedade ipsativa', () => {
    const { window: win } = criarPagina();
    const doc = win.document;

    // Preenchimento diferente do completarParteA (D sempre Mais, mas Menos
    // varia entre I e S de bloco pra bloco) — o que importa é que CADA
    // bloco continua contribuindo exatamente +1 e -1 (nunca mais que isso),
    // então a soma dos 4 traços continua sempre 0.
    doc.querySelectorAll('#blocksA fieldset').forEach((fs, bIdx) => {
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
      mais[0].checked = true; change(win, mais[0]); // D
      const menosIdx = bIdx % 2 === 0 ? 1 : 2; // alterna I/S
      menos[menosIdx].checked = true; change(win, menos[menosIdx]);
    });
    click(win, doc.getElementById('btnAtoB'));
    completarParteBC(win);

    const barras = [...doc.querySelectorAll('#barsNatural .bar-value')].map((el) => parseInt(el.textContent, 10));
    const soma = barras.reduce((acc, v) => acc + v, 0);
    assert.equal(soma, 0, 'a soma dos 4 traços deveria ser sempre 0 (28 blocos, +1 e -1 cada) — é isso que torna o escore ipsativo e os perfis comparáveis entre pessoas');
    assert.equal(barras[0], 28, 'D deveria ser +28 (Mais em todos os 28 blocos)');
  });
});

describe('Parte B sinaliza situação sem resposta ao tentar continuar para a Parte C', () => {
  test('situação sem opção marcada não bloqueia nada até o clique em "Continuar" — não nageia antes disso', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    completarParteA(win);

    // responde só a situação 0, deixa as outras 15 sem resposta
    const opts0 = doc.querySelectorAll('input[name="b0"]');
    opts0[0].checked = true; change(win, opts0[0]);

    assert.ok(!doc.getElementById('situacao-1').classList.contains('pending'), 'não deveria sinalizar antes de tentar continuar');
  });

  test('clicar "Continuar para Parte C" sem terminar sinaliza TODAS as situações pendentes (mesmo as nunca tocadas) e não avança', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    completarParteA(win);

    // responde todas menos a situação 9
    doc.querySelectorAll('#situationsB fieldset').forEach((fs, sIdx) => {
      if (sIdx === 9) return;
      const opts = fs.querySelectorAll(`input[name="b${sIdx}"]`);
      opts[0].checked = true; change(win, opts[0]);
    });

    click(win, doc.getElementById('btnBtoC'));

    assert.ok(doc.getElementById('partB').classList.contains('active'), 'não deveria ter avançado pra Parte C');
    assert.ok(doc.getElementById('situacao-9').classList.contains('pending'), 'situação 9 deveria estar sinalizada como pendente');
    assert.equal(win.getComputedStyle(doc.getElementById('situacao-9').querySelector('.pending-msg')).display, 'block');
    assert.equal(doc.getElementById('validMsgB').style.display, 'inline');
  });

  test('responder a situação pendente some com o alerta e libera o avanço pra Parte C', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    completarParteA(win);

    doc.querySelectorAll('#situationsB fieldset').forEach((fs, sIdx) => {
      if (sIdx === 9) return;
      const opts = fs.querySelectorAll(`input[name="b${sIdx}"]`);
      opts[0].checked = true; change(win, opts[0]);
    });
    click(win, doc.getElementById('btnBtoC')); // sinaliza a situação 9 como pendente

    const opts9 = doc.querySelectorAll('input[name="b9"]');
    opts9[1].checked = true; change(win, opts9[1]);
    assert.ok(!doc.getElementById('situacao-9').classList.contains('pending'), 'o alerta deveria sumir ao responder');

    click(win, doc.getElementById('btnBtoC'));
    assert.ok(doc.getElementById('partC').classList.contains('active'), 'agora deveria avançar pra Parte C');
  });
});

describe('resultado calculado (D-04, D-05, D-06, D-09, D-12)', () => {
  test('N-06 do reteste: não compara natural x adaptado com uma frase de "sobe/cai X pontos" — as escalas são diferentes (natural -28..+28, adaptado 0..16)', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    const doc = win.document;
    // o elemento #adaptacaoDelta (era a correção do D-04, revertida pelo
    // N-06) não existe mais no HTML
    assert.equal(doc.getElementById('adaptacaoDelta'), null);
    // as duas barras continuam lá, cada uma na sua escala, sem comparação
    // numérica entre elas
    assert.equal(doc.querySelectorAll('#barsNatural .bar-value').length, 4);
    assert.equal(doc.querySelectorAll('#barsAdaptado .bar-value').length, 4);
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
  // Durante o período em que a Parte A permitiu múltipla escolha (revertido
  // pelo N-05 do reteste — ver CHANGELOG), respostasA[bIdx] guardava
  // { mais: wordIdx[], menos: wordIdx[] } (array). Quem tinha uma avaliação
  // em andamento salva nesse formato não pode ficar com a página quebrada
  // ao recarregar depois do revert de volta pro formato escalar (radio).
  test('disc_state com mais/menos como array (formato do período de múltipla escolha) migra pro escalar sem quebrar', () => {
    const estadoAntigo = JSON.stringify({
      part: 'A',
      nomeDisc: 'Fulano',
      empresaDisc: 'Empresa Z',
      respostasA: { 0: { mais: [0, 3], menos: [1] } }, // array — normalizarRespostasA() pega a última marcação
      respostasB: {},
      respostasC: {},
    });
    const { window: win } = criarPagina(estadoAntigo);
    const doc = win.document;

    assert.equal(doc.getElementById('blocksA').children.length, 28, 'os 28 blocos da Parte A deveriam renderizar');
    assert.equal(doc.getElementById('situationsB').children.length, 16);
    assert.equal(doc.getElementById('intensityC').children.length, 12);
    assert.equal(doc.getElementById('nomeDisc').value, 'Fulano');

    // pega a última marcação do array: mais=3 (não a 1ª, que era 0)
    assert.ok(doc.querySelector('input[name="a0_mais"][value="3"]').checked);
    assert.ok(!doc.querySelector('input[name="a0_mais"][value="0"]').checked, 'só a última marcação do array antigo deveria sobreviver');
    assert.ok(doc.querySelector('input[name="a0_menos"][value="1"]').checked);
    // mais e menos definidos e diferentes -> bloco conta como respondido
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);
  });
});
