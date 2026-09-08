// Testa a lógica client-side de public/disc.html num DOM real via jsdom —
// cobre especificamente os achados de auditoria-avaliacao-disc.md que
// foram corrigidos (D-01, D-03 a D-06, D-08, D-09, D-12), a estrutura
// fieldset/legend usada pra resolver D-01/D-03, e o item 01 do
// reteste-e-plataforma-ideal.md (Parte A vira passo a passo, Parte B de
// situações foi aposentada — ver CLAUDE.md/CHANGELOG).
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

// Completa a Parte A (passo a passo: Mais entre as 4, Menos entre as 3 que
// sobraram) e clica "Continuar para Parte B". Em todos os 28 blocos marca
// a palavra I (índice 1) como Mais e a palavra D (índice 0) como Menos —
// resultado 100% previsível sob o modelo novo (item 01 do reteste:
// MENOS forma o natural, MAIS forma o adaptado):
//   natural : D +28 (dominante, sem empate), I 0, S 0, C 0
//   adaptado: I +28, D 0, S 0, C 0
function completarParteA(win) {
  const doc = win.document;
  doc.querySelectorAll('#blocksA fieldset').forEach((fs, bIdx) => {
    const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
    const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
    mais[1].checked = true; change(win, mais[1]); // I vira adaptado
    menos[0].checked = true; change(win, menos[0]); // D vira natural
  });
  click(win, doc.getElementById('btnAtoB'));
}

// Completa a Parte B (intensidade — sempre nota 3) e finaliza.
//   intensidade: D=I=S=C=3.0 (spread 0 -> dispara o aviso do D-05)
function completarIntensidade(win) {
  const doc = win.document;
  doc.querySelectorAll('#intensityC fieldset').forEach((fs, aIdx) => {
    const opts = [...fs.querySelectorAll(`input[name="c${aIdx}"]`)];
    const nota3 = opts.find((o) => o.value === '3');
    nota3.checked = true; change(win, nota3);
  });
  click(win, doc.getElementById('btnFinish'));
}

function completarAvaliacao(win) {
  completarParteA(win);
  completarIntensidade(win);
}

describe('estrutura de foco/marcação (D-01, D-03)', () => {
  test('D-01: os radios não são mais display:none e ficam focáveis', () => {
    const { window: win } = criarPagina();
    const radio = win.document.querySelector('input[name="a0_mais"]');
    assert.notEqual(win.getComputedStyle(radio).display, 'none');
    radio.focus();
    assert.equal(win.document.activeElement, radio);
  });

  test('D-01: cada bloco/afirmação vira <fieldset> com <legend> como 1º filho', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    assert.equal(doc.querySelectorAll('#blocksA fieldset').length, 28);
    assert.equal(doc.querySelectorAll('#intensityC fieldset').length, 12);
    assert.equal(doc.querySelector('#blocksA fieldset').firstElementChild.tagName, 'LEGEND');
    assert.equal(doc.querySelector('#intensityC fieldset').firstElementChild.tagName, 'LEGEND');
  });

  test('D-03: cada opção da Parte A é um <label> que embrulha o radio + a frase — nome acessível vem do próprio conteúdo, sem precisar de aria-labelledby', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const radioMais = doc.querySelector('input[name="a0_mais"]');
    const label = radioMais.closest('label.choice-card');
    assert.ok(label, 'o radio deveria estar dentro de um <label class="choice-card">');
    assert.match(label.textContent, /Decidido/);
  });
});

describe('item 01 do reteste: Parte A vira passo a passo (Mais entre as 4, Menos entre as 3 que sobraram)', () => {
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

  test('Passo 2 (Menos) começa bloqueado — todas as opções desabilitadas até o Passo 1 (Mais) ser respondido', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const menos = fieldset.querySelectorAll('input[name="a0_menos"]');

    assert.ok([...menos].every((m) => m.disabled), 'todas as opções do Passo 2 deveriam estar desabilitadas antes do Passo 1');
    assert.ok(fieldset.querySelector('.choice-step-menos').classList.contains('bloqueado'));
  });

  test('depois do Passo 1, só a opção escolhida como Mais fica indisponível no Passo 2 — impossível marcar a mesma frase nas 2', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');
    const menos = fieldset.querySelectorAll('input[name="a0_menos"]');

    mais[0].checked = true; change(win, mais[0]);

    assert.ok(!fieldset.querySelector('.choice-step-menos').classList.contains('bloqueado'), 'Passo 2 deveria liberar depois do Passo 1');
    assert.ok(menos[0].disabled, 'a opção 0 (igual à escolhida como Mais) deveria ficar desabilitada no Passo 2');
    assert.ok(!menos[1].disabled && !menos[2].disabled && !menos[3].disabled, 'as outras 3 opções do Passo 2 deveriam continuar disponíveis');
    assert.match(menos[0].closest('.choice-card').querySelector('.choice-card-tag').textContent, /Já é sua Mais/);

    menos[1].checked = true; change(win, menos[1]);
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);
  });

  test('trocar a Mais depois de já ter respondido a Menos, pra a mesma palavra: limpa a Menos (rede de segurança)', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');
    const menos = fieldset.querySelectorAll('input[name="a0_menos"]');

    mais[0].checked = true; change(win, mais[0]);
    menos[1].checked = true; change(win, menos[1]);
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);

    // muda a Mais pra palavra 1 (a mesma que já estava marcada como Menos)
    mais[1].checked = true; change(win, mais[1]);

    assert.ok(!fieldset.classList.contains('conflict'), 'não deveria sinalizar conflito — a Menos foi limpa automaticamente');
    assert.equal(fieldset.querySelector('input[name="a0_menos"]:checked'), null, 'a Menos deveria ter sido limpa (word 1 virou a nova Mais)');
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28/, 'bloco volta a ficar incompleto até escolher outra Menos');
  });

  test('um disc_state salvo com mais===menos (rede de segurança, não deveria acontecer via UI) sinaliza conflito e não conta como respondido', () => {
    const estadoComConflito = JSON.stringify({
      part: 'A',
      respostasA: { 0: { mais: 2, menos: 2 } },
      respostasC: {},
    });
    const { window: win } = criarPagina(estadoComConflito);
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];

    // sinaliza o alerta (mesmo padrão de clicar "Continuar" sem terminar)
    click(win, doc.getElementById('btnAtoB'));
    assert.ok(fieldset.classList.contains('conflict'), 'disc_state com mais===menos deveria sinalizar conflito');
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28/);
  });

  test('bloco com só Mais marcado (falta a Menos) não conta como respondido e mostra o alerta de pendente', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksA fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');

    mais[0].checked = true; change(win, mais[0]); // só o Mais, falta o Menos

    assert.ok(!fieldset.classList.contains('conflict'), 'não há conflito, só falta o Menos');
    assert.ok(fieldset.classList.contains('pending'), 'deveria sinalizar como pendente por faltar o Menos');
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28/);
  });

  test('o total de pontos é sempre o mesmo (28 blocos = 28 pontos), não varia por padrão de preenchimento — propriedade ipsativa', () => {
    const { window: win } = criarPagina();
    const doc = win.document;

    // Preenchimento diferente do completarParteA (Menos sempre I, mas Mais
    // varia entre D e S de bloco pra bloco) — o que importa é que CADA
    // bloco continua contribuindo exatamente +1 pro natural (Menos) e +1
    // pro adaptado (Mais), nunca mais que isso — por isso a soma dos 4
    // traços em cada perfil é sempre 28, e os 2 perfis ficam comparáveis
    // entre pessoas diferentes de qualquer padrão de preenchimento.
    doc.querySelectorAll('#blocksA fieldset').forEach((fs, bIdx) => {
      const maisIdx = bIdx % 2 === 0 ? 0 : 2; // alterna D/S
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      mais[maisIdx].checked = true; change(win, mais[maisIdx]);
      const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
      menos[1].checked = true; change(win, menos[1]); // I
    });
    click(win, doc.getElementById('btnAtoB'));
    completarIntensidade(win);

    const barrasNatural = [...doc.querySelectorAll('#barsNatural .bar-value')].map((el) => parseInt(el.textContent, 10));
    const somaNatural = barrasNatural.reduce((acc, v) => acc + v, 0);
    assert.equal(somaNatural, 28, 'a soma dos 4 traços do natural deveria ser sempre 28 (1 Menos por bloco, em 28 blocos)');
    assert.equal(barrasNatural[1], 28, 'I deveria ser 28 (Menos em todos os 28 blocos)');

    const barrasAdaptado = [...doc.querySelectorAll('#barsAdaptado .bar-value')].map((el) => parseInt(el.textContent, 10));
    const somaAdaptado = barrasAdaptado.reduce((acc, v) => acc + v, 0);
    assert.equal(somaAdaptado, 28, 'a soma dos 4 traços do adaptado deveria ser sempre 28 (1 Mais por bloco, em 28 blocos)');
  });
});

describe('resultado calculado (D-04, D-05, D-06, D-09, D-12)', () => {
  test('N-06 do reteste: não compara natural x adaptado com uma frase de "sobe/cai X pontos" — mesmo os 2 estando na mesma escala agora (0..28), o comparativo não foi implementado', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    const doc = win.document;
    // o elemento #adaptacaoDelta (era a correção do D-04, revertida pelo
    // N-06) não existe
    assert.equal(doc.getElementById('adaptacaoDelta'), null);
    // as duas barras continuam lado a lado, sem comparação numérica
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
      respostasC: {},
    });
    const { window: win } = criarPagina(estadoAntigo);
    const doc = win.document;

    assert.equal(doc.getElementById('blocksA').children.length, 28, 'os 28 blocos da Parte A deveriam renderizar');
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
