// Testa a lógica client-side de public/disc.html num DOM real via jsdom —
// cobre especificamente os achados de auditoria-avaliacao-disc.md que
// foram corrigidos (D-01, D-03 a D-06, D-08, D-09, D-12), a estrutura
// fieldset/legend usada pra resolver D-01/D-03, e o item 01 do
// reteste-e-plataforma-ideal.md (Parte A vira 2 rodadas pelos mesmos 28
// blocos — Mais primeiro, Menos depois —, Parte B de situações foi
// aposentada — ver CLAUDE.md/CHANGELOG).
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

// Completa a Parte A (Rodada 1: Mais em todos os 28; Rodada 2: Menos em
// todos os 28) e clica "Continuar para Parte B". Em todos os 28 blocos
// marca a palavra I (índice 1) como Mais e a palavra D (índice 0) como
// Menos — resultado 100% previsível sob o modelo novo (item 01 do reteste:
// MENOS forma o natural, MAIS forma o adaptado):
//   natural : D +28 (dominante, sem empate), I 0, S 0, C 0
//   adaptado: I +28, D 0, S 0, C 0
function completarParteA(win) {
  const doc = win.document;
  doc.querySelectorAll('#blocksAMais fieldset').forEach((fs, bIdx) => {
    const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
    mais[1].checked = true; change(win, mais[1]); // I vira adaptado
  });
  click(win, doc.getElementById('btnMaisToMenos'));

  doc.querySelectorAll('#blocksAMenos fieldset').forEach((fs, bIdx) => {
    const menos = fs.querySelectorAll(`input[name="a${bIdx}_menos"]`);
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
    assert.equal(doc.querySelectorAll('#blocksAMais fieldset').length, 28);
    assert.equal(doc.querySelectorAll('#intensityC fieldset').length, 12);
    assert.equal(doc.querySelector('#blocksAMais fieldset').firstElementChild.tagName, 'LEGEND');
    assert.equal(doc.querySelector('#intensityC fieldset').firstElementChild.tagName, 'LEGEND');
  });

  test('D-03: cada opção é um <label> que embrulha o radio + a frase — nome acessível vem do próprio conteúdo, sem precisar de aria-labelledby', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const radioMais = doc.querySelector('input[name="a0_mais"]');
    const label = radioMais.closest('label.choice-card');
    assert.ok(label, 'o radio deveria estar dentro de um <label class="choice-card">');
    assert.match(label.textContent, /Decidido/);
  });
});

describe('item 01 do reteste: Parte A em 2 rodadas pelos mesmos 28 blocos (Mais primeiro, Menos depois)', () => {
  test('a Rodada 2 (Menos) não existe ainda — só aparece depois de terminar a Rodada 1 e clicar Continuar', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    assert.equal(doc.getElementById('blocksAMenos').children.length, 0);
    assert.ok(doc.getElementById('blocksAMenos').hidden);
    assert.ok(doc.getElementById('navFaseMenos').hidden);
    assert.match(doc.getElementById('progressLabelA').textContent, /\(Mais\)$/);
  });

  test('marcar uma 2ª palavra como Mais desmarca a 1ª automaticamente — exclusividade nativa do radio', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    const fieldset = doc.querySelectorAll('#blocksAMais fieldset')[0];
    const mais = fieldset.querySelectorAll('input[name="a0_mais"]');

    mais[0].checked = true; change(win, mais[0]);
    assert.ok(mais[0].checked);

    mais[3].checked = true; change(win, mais[3]);
    assert.ok(mais[3].checked, 'a nova marcação deveria ficar marcada');
    assert.ok(!mais[0].checked, 'o radio nativo deveria ter desmarcado a marcação anterior — não dá pra ter 2 Mais no mesmo bloco');
  });

  test('clicar "Continuar" com a Rodada 1 incompleta sinaliza os blocos pendentes e não avança pra Rodada 2', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    // responde 27 dos 28, deixa o bloco 27 sem resposta
    doc.querySelectorAll('#blocksAMais fieldset').forEach((fs, bIdx) => {
      if (bIdx === 27) return;
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      mais[0].checked = true; change(win, mais[0]);
    });

    click(win, doc.getElementById('btnMaisToMenos'));

    assert.ok(doc.getElementById('blocksAMenos').hidden, 'não deveria ter avançado pra Rodada 2');
    assert.ok(doc.getElementById('bloco-mais-27').classList.contains('pending'));
    assert.equal(doc.getElementById('validMsgAMais').style.display, 'inline');
  });

  test('terminar a Rodada 1 revela a Rodada 2, com a opção escolhida como Mais desabilitada e marcada "Já é sua Mais"', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    doc.querySelectorAll('#blocksAMais fieldset').forEach((fs, bIdx) => {
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      mais[0].checked = true; change(win, mais[0]); // sempre D
    });
    click(win, doc.getElementById('btnMaisToMenos'));

    assert.ok(!doc.getElementById('blocksAMenos').hidden, 'Rodada 2 deveria ficar visível');
    assert.equal(doc.querySelectorAll('#blocksAMenos fieldset').length, 28);
    assert.match(doc.getElementById('progressLabelA').textContent, /^0 de 28.*\(Menos\)$/);

    const bloco0 = doc.getElementById('bloco-menos-0');
    const menos = bloco0.querySelectorAll('input[name="a0_menos"]');
    assert.ok(menos[0].disabled, 'a opção 0 (igual à escolhida como Mais) deveria ficar desabilitada');
    assert.ok(!menos[1].disabled && !menos[2].disabled && !menos[3].disabled, 'as outras 3 continuam disponíveis');
    assert.match(menos[0].closest('.choice-card').querySelector('.choice-card-tag').textContent, /Já é sua Mais/);

    menos[1].checked = true; change(win, menos[1]);
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);
  });

  test('voltar pra Rodada 1 e trocar uma resposta invalida a Menos daquele bloco na Rodada 2', () => {
    const { window: win } = criarPagina();
    const doc = win.document;
    doc.querySelectorAll('#blocksAMais fieldset').forEach((fs, bIdx) => {
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      mais[0].checked = true; change(win, mais[0]); // sempre D
    });
    click(win, doc.getElementById('btnMaisToMenos'));

    const menos0 = doc.getElementById('bloco-menos-0').querySelectorAll('input[name="a0_menos"]');
    menos0[1].checked = true; change(win, menos0[1]); // I
    assert.match(doc.getElementById('progressLabelA').textContent, /^1 de 28/);

    click(win, doc.getElementById('btnMenosToMais'));
    assert.ok(!doc.getElementById('blocksAMais').hidden, 'deveria voltar pra Rodada 1');

    // troca o Mais do bloco 0 pra palavra 1 (a mesma que já era a Menos)
    const mais0 = doc.getElementById('bloco-mais-0').querySelectorAll('input[name="a0_mais"]');
    mais0[1].checked = true; change(win, mais0[1]);

    click(win, doc.getElementById('btnMaisToMenos'));
    const menos0depois = doc.getElementById('bloco-menos-0').querySelectorAll('input[name="a0_menos"]');
    assert.equal(doc.getElementById('bloco-menos-0').querySelector('input[name="a0_menos"]:checked'), null, 'a Menos do bloco 0 deveria ter sido limpa (word 1 virou a nova Mais)');
    assert.ok(menos0depois[1].disabled, 'agora a opção 1 (nova Mais) que deveria ficar desabilitada');
    assert.ok(!menos0depois[0].disabled, 'a opção 0 (antiga Mais) volta a ficar disponível');
  });

  test('disc_state salvo com mais===menos (rede de segurança, não deveria acontecer via UI) não trava a Rodada 2 — vira só um bloco pendente', () => {
    const estadoComConflito = JSON.stringify({
      part: 'A',
      faseA: 'menos',
      respostasA: { 0: { mais: 2, menos: 2 } },
      respostasC: {},
    });
    const { window: win } = criarPagina(estadoComConflito);
    const doc = win.document;

    assert.equal(doc.querySelectorAll('#blocksAMenos fieldset').length, 28, 'a Rodada 2 deveria renderizar mesmo com esse dado corrompido');
    click(win, doc.getElementById('btnAtoB')); // sinaliza pendentes
    assert.ok(doc.getElementById('bloco-menos-0').classList.contains('pending'), 'bloco 0 deveria contar como pendente (menos===mais não é uma resposta válida)');

    // a pessoa consegue se autocorrigir escolhendo outra opção (a 2 fica disabled)
    const menos0 = doc.getElementById('bloco-menos-0').querySelectorAll('input[name="a0_menos"]');
    assert.ok(menos0[2].disabled);
    menos0[0].checked = true; change(win, menos0[0]);
    assert.ok(!doc.getElementById('bloco-menos-0').classList.contains('pending'));
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
    doc.querySelectorAll('#blocksAMais fieldset').forEach((fs, bIdx) => {
      const maisIdx = bIdx % 2 === 0 ? 0 : 2; // alterna D/S
      const mais = fs.querySelectorAll(`input[name="a${bIdx}_mais"]`);
      mais[maisIdx].checked = true; change(win, mais[maisIdx]);
    });
    click(win, doc.getElementById('btnMaisToMenos'));
    doc.querySelectorAll('#blocksAMenos fieldset').forEach((fs, bIdx) => {
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
    assert.match(win.document.getElementById('progressLabelA').textContent, /^0 de 28.*\(Mais\)$/);
  });

  test('regressão: "Refazer avaliação" reabilita o botão "Enviar meu perfil" (ficava travado depois de um envio bem-sucedido)', () => {
    const { window: win } = criarPagina();
    completarAvaliacao(win);
    // sendResultado() desabilita btnSend permanentemente num envio com
    // sucesso — simula esse estado direto (sem precisar mockar fetch) pra
    // testar só o que o reset deveria desfazer.
    win.document.getElementById('btnSend').disabled = true;

    click(win, win.document.getElementById('btnReset'));
    click(win, win.document.getElementById('confirmResetYes'));

    assert.equal(win.document.getElementById('btnSend').disabled, false);
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
      faseA: 'menos', // força renderizar a Rodada 2 também, pra testar a migração dos 2 lados
      nomeDisc: 'Fulano',
      empresaDisc: 'Empresa Z',
      respostasA: { 0: { mais: [0, 3], menos: [1] } }, // array — normalizarRespostasA() pega a última marcação
      respostasC: {},
    });
    const { window: win } = criarPagina(estadoAntigo);
    const doc = win.document;

    assert.equal(doc.getElementById('blocksAMais').children.length, 28, 'os 28 blocos da Rodada 1 deveriam renderizar');
    assert.equal(doc.getElementById('blocksAMenos').children.length, 28, 'os 28 blocos da Rodada 2 deveriam renderizar (faseA salva era "menos")');
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
