# Changelog

Registro das mudanças feitas com o Claude (Claudius) neste repositório,
organizado por branch para servir de referência temporal — sempre que uma
mudança passa a ser feita numa branch diferente da anterior, um novo
cabeçalho `## Alterações branch <nome>` é aberto antes dela. Dentro de cada
branch, as entradas ficam em ordem cronológica (mais recente por último).

Este arquivo existe a partir de 2026-09-05; mudanças anteriores a essa data
seguem só no histórico do `git log`.

## Alterações branch main

### 2026-09-05

- **Auditoria da calculadora de meta comercial aplicada.** Verifiquei os 19
  achados de `auditoria_calculadora_meta.md` contra o código real (inclusive
  recalculando manualmente 2 dos contrastes WCAG reportados, que bateram
  exatos) e apliquei os 18 que eram correções válidas em
  `public/calculadora.html`, `public/style/index.css` e
  `src/reports/metaComercialReport.js`:
  - Campos numéricos eram `type="number"`: digitar "200.000" virava 200
    (F-01) e rolar a página com o campo em foco alterava o valor (F-02).
    Viraram `type="text" inputmode="decimal"` com parsing pt-BR
    (`.` = milhar, `,` = decimal).
  - Formulário vazio era aceito e gravado zerado (F-03) — agora exige os 5
    campos que sustentam a conta antes do envio.
  - Contatos/contratos arredondados só na tela; o payload levava o valor
    cru com 15 casas decimais (F-04) — arredonda uma vez só, no cálculo.
  - Percentuais sem teto (F-05) e negativos sem clamp (F-06) produziam
    metas impossíveis — clamp em [0, 100] e [0, ∞) na leitura dos campos.
  - Linha 12/13 (hunter/farmer) não conferia com os papéis da tabela de
    equipe (F-07) — novo alerta comparando os dois.
  - Pessoa sem nome entrava na soma e era enviada ao banco (F-08) — agora
    é ignorada na soma e marcada visualmente como incompleta.
  - Nenhum campo tinha rótulo programático, sem `<form>`, sem regiões
    vivas para os resultados calculados, contraste abaixo de 4,5:1 em 4
    estilos de texto, e outras pendências de marcação semântica (F-09,
    F-10, F-11, F-16) — `<form>`/`<label for>`/`name` em todos os campos,
    `<output aria-live="polite">` nos calculados, `role="status"` nos
    callouts, `--fg-faint` mais claro (`#5A6480` → `#808AA6`), landmarks
    `<main>`/`<nav>`, `scope="col"` na tabela, `<meta name="description">`.
  - Formatação de contratos em inglês e plural fixo (F-12) — locale pt-BR
    e plural condicional.
  - PDF quebrava a tabela de equipe no meio da página, deixando uma folha
    quase vazia (F-13) — mede a altura da tabela inteira (+ o aviso de
    fechamento) antes de desenhar e empurra o bloco inteiro pra página
    seguinte quando não cabe no que resta da atual.
  - Dava pra apagar todas as linhas da equipe (F-14) — bloqueado.
  - "Recomeçar" usava `confirm()` nativo (F-15) — confirmação inline.
  - O reset regravava o estado vazio no `localStorage` logo depois de
    limpá-lo (F-17) — corrigido com uma flag de supressão.
  - Rótulo da linha 6/7/8 sugeria faturamento total do ano, quando na
    verdade é receita recorrente nova a conquistar (F-18) — reescrito.
  - F-19 (churn incide só sobre a base de hoje) é uma simplificação
    legítima do exercício, sem correção necessária — mantido como está.
  - Achado extra não listado na auditoria: `var(--ink-faint)` e
    `var(--ink-soft)` eram usados em `calculadora.html` mas nunca
    definidos em nenhum CSS — corrigido para os tokens reais
    (`--fg-faint`/`--fg-soft`).
  - Adiciona `tests/calculadora.client.test.js` (novo, com `jsdom`): a
    lógica client-side da calculadora nunca tinha teste automatizado antes
    disso — cobre especificamente os cenários acima (F-01, F-03, F-05 a
    F-08, F-12, F-14, F-17).
- **README.md atualizado** para refletir o estado atual do projeto (menu,
  DISC, relatórios em PDF, `npm test`, rotas novas).
- **CLAUDE.md**: nova seção "Fluxo de commit" (testar → commits atômicos →
  merge com a main → push sempre que um commit for pedido) e este próprio
  `CHANGELOG.md` como convenção de relato de mudanças.
- **F-03 também valia pro botão de PDF, não só pro envio.** O usuário
  reproduziu ao vivo no site: dava pra clicar "Salvar meu resultado (PDF)"
  com o formulário vazio e baixar um PDF todo zerado — a validação dos 5
  campos obrigatórios (`validarObrigatorios()`) só estava plugada no
  `sendBtn`. Aplica a mesma checagem no `printBtn`, em
  `public/calculadora.html`.
- **Auditoria da avaliação DISC verificada e aplicada.** Antes de corrigir,
  fui achado por achado contra o código real (recalculei 2 contrastes com
  script — não de cabeça — pra não repetir o erro do PDF vazio). Resultado
  da verificação:
  - **D-02 (empate vira dominância falsa) já estava corrigido** — a
    auditoria testou o site antes do deploy pegar o commit anterior
    (`resolverPerfilDominante`/`LIMIAR_EMPATE_TRACOS`, já existente).
  - **D-07 estava parcialmente errado**: `.progress-label` de fato dava
    3,00:1 (confirmado, corrigido); mas `.block-instruction` usa
    `--fg-soft`, que recalculei em ~6,6:1–7,4:1 — dentro do padrão. Só a
    parte do `.progress-label` foi corrigida.
  - **D-13 (nome de arquivo do PDF inconsistente)**: era decisão explícita
    anterior do usuário (participante no DISC, empresa na calculadora) —
    perguntei antes de mexer. Decisão: padronizar por participante nos
    dois (ver abaixo).
  - Os outros 10 achados (D-01, D-03 a D-06, D-08 a D-12) bateram com o
    código e foram todos corrigidos, em `public/disc.html`,
    `public/style/disc.css` e `src/reports/discReport.js`:
    - Os 348 radios eram `display:none` (D-01), o que os tirava do
      teclado/leitor de tela — viram visualmente ocultos mas focáveis, com
      `outline` de foco em `:has(input:focus-visible)` no `<label>`.
    - Cada bloco/situação/afirmação virou `<fieldset>`+`<legend>` (era
      `<div>`), e a frase da opção na Parte A ganhou `aria-labelledby`
      ligando-a ao chip "+ Mais"/"− Menos" (D-01/D-03).
    - "Natural × adaptado" agora compara os dois perfis de verdade: acha o
      traço com maior distância entre eles e comenta a adaptação (D-04).
    - O laudo de "como você performa" é modulado pela intensidade medida
      na Parte C (alta/moderada/baixa), e um aviso aparece quando as 4
      intensidades saem muito parecidas — sinal de respostas pouco
      diferenciadas (D-05).
    - Os 4 cards de referência usavam a mesma frase "Perfil dominante — X
      acima dos demais" pros 4 traços ao mesmo tempo — viraram descrição
      neutra (`.resumo`), e o card do participante ganhou destaque visual
      ("Seu perfil"), na tela e no PDF (D-06).
    - `disc_state` não guardava nome/empresa — quem recarregava no meio
      recuperava as respostas e perdia a identificação (D-08).
    - O aviso de nome faltando não levava/focava o campo (D-09).
    - PDF dizia "escala de 0 a 5" (era 1 a 5) e usava ponto decimal em vez
      de vírgula (D-10).
    - `<form>`, `<main>`, `<nav>`, meta description, `name` nos campos de
      identidade, `aria-live` no contador de progresso (D-11).
    - `confirm()` nativo no "Refazer avaliação" virou confirmação inline
      (D-12), no mesmo padrão da calculadora.
  - **D-13 aplicado**: `metaComercialFilename()` (calculadora) passou a
    usar `nome_participante` em vez de `empresa`, igual o DISC já fazia —
    `${nome do participante} meta comercial.pdf` nos dois relatórios agora.
  - **Achados extras não listados em nenhuma das duas auditorias**:
    `var(--ink-faint)` era usado em `disc.html` mas nunca definido em
    `disc.css` (mesmo bug já visto na calculadora); e `var(--alert)` /
    `var(--ok)` também eram usados sem nunca terem sido definidos —
    `disc.css` usa `--danger`/`--success`, não `--alert`/`--ok`. Afetava a
    cor do texto de status em 5 pontos (envio, geração de PDF). Todos
    corrigidos pros tokens reais.
  - Adiciona `tests/disc.client.test.js` (novo, com `jsdom`) cobrindo os
    10 achados corrigidos, preenchendo a avaliação inteira de forma
    determinística pra chegar na tela de resultado.
- **Segunda auditoria da calculadora verificada** (`auditoria-calculadora-
  metas-2.md` — feita por inspeção remota, sem DevTools; o próprio
  documento admite essa limitação). Resultado: 3 achados válidos e
  corrigidos, os outros 5 já estavam corretos (2 desde antes de qualquer
  correção minha) e a auditoria errou por não conseguir executar o
  JavaScript da página:
  - **Campos numéricos aceitam qualquer texto**: real — `type="text"` não
    bloqueia letra como `type="number"` bloqueava (voltar pra
    `type="number"` reintroduziria o F-01/F-02 da 1ª auditoria). Adiciona
    `filtrarDigitacaoNumerica()`: filtro em tempo real que só deixa
    dígito, `.`, `,` e `-` passarem, em todos os campos monetários/
    percentuais, incluindo a meta da equipe.
  - **Percentuais sem limite coerente**: crescimento estava travado em
    100% igual churn/conversão — mas crescer 150%/200% é meta agressiva
    legítima, diferente de churn/conversão (que não fazem sentido acima
    de 100%). Sobe o teto de `crescimentoPct` pra 500%, mantém churn e
    conversão em 100%.
  - **Campos de texto sem limite de tamanho**: real, sem `maxlength`.
    Adiciona 80 caracteres (nome/empresa) e 60 (nome da pessoa na
    equipe).
  - **Divisão por zero**, **soma da equipe vs. meta total** e **hunter/
    farmer sempre com um valor selecionado**: já corretos — os dois
    primeiros desde antes de qualquer correção minha (guard `ticket > 0
    ? ... : 0` e o badge "Fecha/Falta/Sobra", ambos JS que a auditoria
    remota não executa); o terceiro porque o `<select>` só tem as 2
    opções, sem opção em branco possível.
  - "Enviar minha meta" pedir confirmação (parte do achado positivo) é
    impreciso — só "Recomeçar" pede; "Enviar" só valida e envia direto.
  - Sugestão de bloquear hunter > meta mensal como erro obrigatório não
    foi aplicada de propósito: o padrão já estabelecido na página é
    avisar (callout) em vez de bloquear em inconsistências de negócio
    (equipe vs. meta, hunter/farmer vs. papéis) — quem resolve é o
    facilitador, não uma trava de JS. Mantido consistente.
  - 4 testes novos em `tests/calculadora.client.test.js` cobrindo os 3
    achados corrigidos.
- **Validação passa a viver no campo, não só no clique dos botões.** O
  usuário notou o problema de raiz: negativo virava 0 e percentual acima
  do teto travava só dentro do cálculo — o campo continuava mostrando o
  valor errado digitado, sem nenhum aviso ali, e "obrigatório" só era
  checado ao clicar em Enviar/Salvar PDF.
  - Nova `REGRAS_CAMPO` (uma entrada por campo: obrigatório, `max`,
    `maiorQueZero`) e `validarCampo(id, {mostrarObrigatorio})` em
    `public/calculadora.html`: mensagem inline em `#<id>-alert` logo
    abaixo do campo, borda do campo fica vermelha (`.tem-alerta`) — tudo
    em `public/style/index.css`.
  - Roda no `input` (negativo, acima do teto, `=0` em campo que exige
    `>0`) e no `blur` (campo obrigatório vazio) — não fica esperando o
    clique no botão. `validarObrigatorios()` (chamada pelos botões) agora
    também acende o alerta de **todos** os campos obrigatórios pendentes
    de uma vez, não só o primeiro.
  - 5 testes novos cobrindo os cenários acima.
- **Favicon adicionado ao site.** A imagem inserida no projeto
  (`Logo Tática - Logo Tática_page-0001.jpg`) era o logo completo em
  resolução de impressão (2084×2084px, 150 DPI) — símbolo + "Tática" +
  "Gestão Contábil" — e ficava ilegível quando reduzido direto pros
  tamanhos de favicon (16/32px), como mostrou uma comparação lado a lado
  gerada pra confirmar antes de aplicar. Em vez de recortar esse raster,
  usei o arquivo vetorial original (`Logo Tática.ai`, Illustrator, 7
  páginas de variações do logo) e extraí em alta resolução (600 DPI, com
  transparência real) só a página com o símbolo isolado — fica nítido em
  todos os tamanhos.
  - Novos `public/favicon.ico` (16/32/48, gerado com Pillow) e
    `public/img/favicon-{16,32,192}.png`, `apple-touch-icon.png` (180px),
    `logo-simbolo-512.png`.
  - `<link rel="icon">`/`apple-touch-icon` no `<head>` dos 4 HTML
    (`index.html`, `calculadora.html`, `disc.html`, `admin.html`).
- **Parte A do DISC passa a permitir marcar mais de uma palavra por grupo
  (Mais/Menos) no mesmo bloco.** Cada opção usava `<input type="radio">`
  compartilhado no grupo (Mais e Menos, 1 grupo cada), então marcar uma 2ª
  palavra como Mais desmarcava a 1ª automaticamente — comportamento nativo
  de radio. Viraram `<input type="checkbox">` (só em `disc.html`, Partes B
  e C continuam `radio`, são escolha única de verdade).
  - `state.respostasA[bIdx]` passa de `{ mais: wordIdx, menos: wordIdx }`
    pra `{ mais: wordIdx[], menos: wordIdx[] }`.
  - Novo `blocoARespondido(r)` centraliza o critério de "bloco respondido":
    pelo menos 1 palavra em cada grupo e nenhuma palavra marcada nos 2
    grupos ao mesmo tempo (isso continua bloqueado como conflito, igual
    antes) — usado por `updateProgressA()`, `validateA()` e `calcNatural()`
    (antes cada um repetia essa checagem de um jeito ligeiramente
    diferente).
  - `calcNatural()` agora soma/subtrai o traço de **cada** palavra marcada
    no grupo, não só da 1ª.
  - CSS: `.choice-radios input[type=radio]` (visualmente oculto mas focável)
    e as regras de destaque do `<label>` viram `[type=checkbox]` — só as
    de Parte A; `.situation-options`/`.intensity-scale` (Partes B/C)
    continuam intactas.
  - 3 testes novos em `tests/disc.client.test.js`: marcar 2 opções em Mais
    e 2 em Menos no mesmo bloco não é bloqueado e conta como respondido;
    marcar a mesma palavra nos 2 grupos continua sendo conflito; o cálculo
    do perfil natural soma/subtrai corretamente quando há múltiplas
    marcações no mesmo bloco.
- **Bug crítico: nenhum bloco da Parte A aparecia ao testar o DISC.**
  Reportado pelo usuário ("os blocos da parte A não estão aparecendo").
  Reproduzi carregando `disc.html` num Chromium headless de verdade (não só
  `jsdom`) — renderizava certo do zero, então a causa não estava no HTML/CSS
  em si. A pista era o `localStorage`: quem tinha uma avaliação em andamento
  salva **antes** da mudança de múltipla escolha (commit anterior) ficou com
  `disc_state.respostasA[bIdx] = { mais: 2, menos: 1 }` (número único) —
  formato que o `renderParteA()` novo não entende mais (espera array).
  `loadState()` carregava esse JSON sem validar nada, `(2 || []).includes(...)`
  lançava `TypeError` não tratado, e como `renderParteA()`/`B()`/`C()` rodam
  em sequência solta no topo do script (sem try/catch entre elas), a
  exceção na primeira travava as três — a página inteira ficava sem
  conteúdo dinâmico, não só a Parte A.
  - Novo `normalizarRespostasA()` em `loadState()`: converte qualquer
    `mais`/`menos` que não seja array pro formato novo (`[valor]` se havia
    um valor, `[]` se vazio) — quem tinha progresso salvo não perde nada.
  - 1 teste de regressão simulando exatamente esse `disc_state` antigo e
    confirmando que as 3 partes renderizam e a marcação antiga é migrada.
- **Corrige o critério de "bloco respondido" da Parte A — não é mais "pelo
  menos 1 em Mais e 1 em Menos".** O usuário apontou que a contagem estava
  errada: "retire a verificação de que para estar respondido o bloco deve
  conter +mais e -menos" — o critério certo é contar **respostas
  preenchidas**: um bloco é respondido quando as 4 palavras foram
  classificadas (cada uma em Mais ou em Menos, nenhuma de fora), continuando
  bloqueado só o caso de uma palavra marcada nos 2 grupos ao mesmo tempo
  (isso não muda). Antes, um bloco com só 2 das 4 palavras classificadas (1
  Mais + 1 Menos) já contava como respondido; agora precisa das 4.
  - `blocoARespondido(r)` virou `blocoARespondido(bIdx)` (chama
    `avaliarBlocoA(bIdx)` internamente, que sabe o total de palavras do
    bloco via `BLOCOS_A[bIdx].words.length`) — usado por
    `updateProgressA()`, `validateA()` e `calcNatural()`.
  - Novo alerta inline "pendente" (`.pending-msg`/`.pending`, cor
    `--warning`) além do "conflito" já existente (`.conflict-msg`/
    `.conflict`, `--danger`) — cada bloco mostra um ou outro conforme o
    caso. Um `Set` em memória (`blocosAlertaVisivel`) evita mostrar
    "pendente" nos 28 blocos assim que a página carrega: só aparece depois
    que o participante mexe naquele bloco específico.
  - O botão "Continuar para Parte B" agora sinaliza **todos** os blocos
    pendentes de uma vez quando clicado (mesmo os nunca tocados, não só o
    primeiro) e rola a tela até o primeiro deles — mesmo padrão já usado no
    `validarObrigatorios()` da calculadora.
  - Textos de instrução da Parte A atualizados ("classifique as 4 palavras"
    em vez de "marque o MAIS e o MENOS").
  - `completarAvaliacao()` (helper de teste) passou a classificar as 4
    palavras de cada bloco (D sempre Mais, I sempre Menos, S/C alternando
    de grupo a cada bloco pra se cancelarem) — mantém o resultado
    determinístico (D+28, I-28, S=0, C=0) que os testes de resultado já
    verificavam, agora sob a regra nova. 2 testes ajustados (contagem do
    formato antigo migrado passa a ser "0 de 28", já que só tinha 2 das 4
    palavras) e 1 teste novo cobrindo o alerta de pendente.
- **Parte B (situações) ganha o mesmo alerta de pendente ao tentar
  continuar sem responder tudo.** Pedido do usuário: "faça o mesmo quando
  o usuário não marcar uma opção... e volte para o bloco pendente quando o
  usuário clica em Seguir para a Parte C". Mais simples que a Parte A
  porque cada situação é `radio` de escolha única — não existe estado
  parcial nem conflito, só respondida ou não.
  - Novo `<p class="pending-msg">` por situação (reaproveita o CSS já
    criado pra Parte A: `.pending-msg`/`--warning`) e `.situation-card`
    ganha `id="situacao-{sIdx}"` pra poder ser sinalizada/rolada até.
  - `situacoesAlertaVisivel` (mesma ideia do `blocosAlertaVisivel` da Parte
    A) só é preenchido no clique de "Continuar para Parte C" — diferente da
    Parte A, aqui não faz sentido revelar cedo durante a digitação: marcar
    uma opção já resolve a situação inteira de uma vez, não existe "faltou
    só um pouco".
  - O clique em "Continuar para Parte C" sinaliza **todas** as situações
    pendentes de uma vez (mesmo as nunca tocadas) e rola até a primeira —
    mesmo padrão do botão da Parte A.
  - 3 testes novos em `tests/disc.client.test.js`: não sinaliza antes do
    clique; sinaliza todas as pendentes (inclusive as nunca tocadas) e não
    avança; responder a situação sinalizada faz o alerta sumir e libera o
    avanço. Extraído `completarParteA()` de `completarAvaliacao()` pra
    reaproveitar nesses testes (só Parte A + clique, sem completar B/C).
- **Remove a Parte 2 da calculadora de meta comercial** (distribuir a meta
  entre hunter/farmer e uma tabela de equipe por pessoa) — pedido direto do
  usuário. A calculadora agora tem só uma seção ("A meta da empresa"), do
  faturamento até os contatos necessários por mês (linhas 1-11); a antiga
  "Parte 1" perdeu o rótulo de número já que não há mais uma "Parte 2" pra
  distinguir.
  - `public/calculadora.html`: removidos o HTML da seção (linhas 12/13,
    tabela de equipe, `calloutHunter`/`calloutPapel`) e todo o JS ligado
    (`addRow`, `recalcTeam`, `coletarEquipe`, `linhasValidas`,
    `hunterValor` em `els`/`REGRAS_CAMPO`/`saveState`/`loadState`). O
    `saveState()` que antes rodava só via `recalcTeam()` (cascata
    `recalc()` → `recalcTeam()` → `saveState()`) passou a ser chamado
    direto no fim de `recalc()`, senão nenhum campo persistia mais no
    `localStorage`.
  - Achado à parte enquanto mexia nesses mesmos botões: `sendStatus.style.
    color = 'var(--ink-faint)'` no handler do "Enviando..." — token que
    nunca existiu em `index.css` (só `--fg-faint`), mesma classe de bug já
    corrigida antes em `disc.html`. Corrigido pro token real.
  - `public/style/index.css`: removido todo o CSS só usado pela tabela de
    equipe (`table.team`, `.add-btn`, `.del-btn`, `.badge`, `.team-actions`,
    regras de impressão e responsivo relacionadas) e o `.part-num` (não
    tem mais `<span>` de número de parte no HTML).
  - `src/reports/metaComercialReport.js`: removida a seção "Meta por
    pessoa" (hunter/farmer + `drawTeamTable`) do PDF — sem isso, o relatório
    passaria a mostrar pra sempre "Clientes novos (hunter): R$ 0" (a UI não
    envia mais esse campo), o que é pior que não ter a seção.
  - **Não foi uma migração destrutiva de banco**: `src/server.js` e a
    tabela `metas` continuam com `hunter_valor`/`farmer_valor`/
    `equipe_json` (a API já tratava esses campos como opcionais,
    default 0/`[]`) — só a UI parou de coletar e enviar.
  - `tests/calculadora.client.test.js`: removidos os testes F-07, F-08,
    F-14 (específicos da tabela de equipe) e o helper `teamRows`/
    `preencherLinhaEquipe`; ajustados os testes de "limite de tamanho" e
    "persistência" pra não referenciar mais campos de equipe.
- **Configura banco persistente no `render.yaml`.** O SQLite
  (`db/metas.db`) era apagado a cada deploy e quando a instância dormia
  por inatividade — o plano `free` do Render não suporta Persistent Disk.
  Decisão (perguntei ao usuário, que optou por manter SQLite em vez de
  migrar pra Postgres): sobe o plano pra `starter` (menor plano pago que
  aceita disco), adiciona um `disk` de 1GB montado em `/var/data`, e
  aponta `DB_PATH=/var/data/metas.db` — sem nenhuma mudança em
  `src/server.js`, que já lia `DB_PATH` do ambiente. Localmente continua
  tudo igual (`db/metas.db`, dentro do repo). Bônus: o plano starter também
  não "dorme" por inatividade como o free.
