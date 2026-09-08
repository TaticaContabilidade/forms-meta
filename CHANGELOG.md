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
- **Reverte a remoção da Parte 2 da calculadora.** O usuário pediu pra
  retroceder o commit que tirava a distribuição hunter/farmer e a tabela
  de equipe (`public/calculadora.html`, `public/style/index.css`,
  `src/reports/metaComercialReport.js`, `tests/calculadora.client.test.js`
  voltam ao estado de antes dessa remoção) — `git revert -m 1` do merge
  commit, histórico preservado (não foi um reset). A correção do token CSS
  inexistente (`--ink-faint` → `--fg-faint`) que tinha sido feita junto
  também voltou com o revert; se ela ainda for válida, precisa ser
  reaplicada separadamente.
- **Alerta de divergência hunter/farmer (`calloutPapel`) fica específico
  sobre qual campo mudar e por quê.** Verifiquei `reteste-e-plataforma-
  ideal.md` (documento de reteste externo) contra o código atual antes de
  mexer: 2 dos 5 achados da calculadora (F-03, N-01) já estavam corrigidos
  e o documento estava desatualizado; os outros 3 (N-02, N-03, N-04) são
  válidos mas não foram pedidos nesta mudança. O pedido do usuário foi
  específico: a mensagem antiga ("A equipe tem X em metas de hunter e Y de
  farmer, mas a linha 12/13 declara... Ajuste um dos dois.") não dizia
  qual dos dois campos alterar.
  - A linha 12 (hunter) é o único campo editável dessa divisão — a linha
    13 (farmer) é sempre calculada a partir dela (`meta mensal - hunter`).
    Por isso a mensagem agora prioriza esse diagnóstico: quando o hunter
    declarado diverge da soma da equipe marcada como "Hunter", diz
    exatamente para qual valor mudar a linha 12 ("a linha 13 se ajusta
    sozinha").
  - Só quando o hunter já bate é que o desvio pode estar do lado farmer —
    nesse caso não há campo próprio pra apontar (a linha 13 não é
    editável), então a mensagem orienta a revisar as metas das pessoas
    marcadas como Farmer na tabela ou o total da equipe vs. a meta mensal
    (o badge logo acima já cobre esse segundo caso).
  - 2 testes em `tests/calculadora.client.test.js` cobrindo as duas
    situações (hunter desalinhado vs. farmer desalinhado com hunter
    batendo) — o teste antigo (`F-07`) só checava que "R$ 400" aparecia em
    algum lugar do texto, não testava a especificidade da orientação.
- **N-02 do reteste — 9 regiões `aria-live` disparando junto viram 1.**
  Cada tecla digitada recalculava até 9 `<output aria-live="polite">`
  (linha 3, 5, 6, 7, 8, 10, contatos necessários, farmer, hero) de uma vez
  — um leitor de tela recebia até 9 anúncios por dígito.
  - Os 9 `aria-live="polite"` saíram dos `<output>` (continuam
    `<output for="...">` comuns, só não anunciam mais sozinhos).
  - Novo `<p id="resumoAoVivo" class="sr-only" role="status"
    aria-live="polite">` — visualmente oculto (mesma técnica já usada nos
    rótulos da tabela de equipe), só existe pra leitor de tela.
  - `agendarResumoAoVivo(mensagem)` em `public/calculadora.html`: debounce
    de 600ms — só escreve no `#resumoAoVivo` depois que `recalc()` para de
    ser chamado (ou seja, depois que a pessoa para de digitar), texto
    combinando os dois números que importam: "Meta mensal R$ 6.667, 38
    contatos necessários por mês."
  - 2 testes novos: confirma que os 9 outputs perderam `aria-live` e que
    o resumo não aparece imediatamente após digitar (só depois da pausa).
- **N-03 do reteste — contraste do `R$`/`%` abaixo do mínimo.**
  `.field-prefix`/`.field-suffix` usavam `--fg-faint`, calibrado em
  auditorias anteriores contra `--card`/`--bg` — mas esses prefixos ficam
  sobre `--input-bg` (um overlay translúcido), fundo diferente. Recalculei:
  4,12:1 contra o fundo real do campo, abaixo dos 4,5:1 exigidos (bate com
  os 4,12:1 que o documento reporta). Trocado para `--fg-soft`, que já
  existe e é usado em outros textos secundários da página — 5,93:1 no
  mesmo fundo. Confirmado ao vivo via `getComputedStyle` num Chromium
  real: `rgb(157, 168, 192)` (= `#9DA8C0` = `--fg-soft`).
- **N-04 do reteste — botão de remover a última linha continuava
  clicável, sem fazer nada.** O guard (`if (...) return;`) já impedia a
  remoção, mas o botão não tinha `disabled`, então parecia ativo — clicar
  e nada acontecer lê como bug. Novo `atualizarBotoesRemover()` em
  `public/calculadora.html`, chamado toda vez que uma linha é adicionada
  ou removida: desabilita o(s) botão(ões) quando só resta 1 linha,
  reativa quando volta a ter 2+. CSS novo (`.del-btn:disabled`) deixa o
  estado visualmente óbvio (opacidade reduzida, cursor `not-allowed`).
  1 teste novo confirmando desabilita/reativa; testado também ao vivo
  num Chromium real (`disabled: true`, `opacity: 0.35`, `cursor:
  not-allowed` via `getComputedStyle`).
- **N-05 do reteste — CRÍTICO: reverte a Parte A do DISC de volta pra
  escolha forçada (radio), abandonando a múltipla escolha (checkbox).**
  A mudança que permitiu marcar mais de uma palavra por grupo (commit
  `081debd`, branch `feat/disc-parte-a-multipla-escolha`) quebrou a
  propriedade **ipsativa** do instrumento: com `checkbox`, o total de
  pontos por pessoa deixava de ser constante — a soma dos 4 traços podia
  ser 0 (2 Mais + 2 Menos por bloco) ou -56 (1 Mais + 3 Menos), dependendo
  de quantas palavras cada um marcava por bloco. Duas pessoas respondendo
  com a mesma sinceridade saíam em réguas diferentes, invalidando qualquer
  comparação entre perfis — exatamente o problema que a escolha forçada
  clássica (1 Mais + 1 Menos, nunca mais que isso) existe pra evitar.
  Verifiquei isso rodando os dois cenários de preenchimento e confirmando
  a diferença de soma antes de decidir reverter.
  - `public/disc.html`: `<input type="checkbox">` volta a ser
    `type="radio"` nos 2 grupos (Mais/Menos) de cada bloco — o radio
    nativo garante no máximo 1 marcação por grupo sozinho, sem precisar de
    JS extra. `state.respostasA[bIdx]` volta de
    `{ mais: wordIdx[], menos: wordIdx[] }` pra `{ mais: wordIdx, menos:
    wordIdx }` (escalar). `avaliarBlocoA()`/`blocoARespondido()`,
    `updateBlocoA()` e `calcNatural()` reescritos pra escalar — bloco
    respondido volta a ser "1 Mais + 1 Menos, diferentes" (não mais "as 4
    classificadas"). Textos de instrução voltam à forma clássica ("Marque
    o MAIS e o MENOS parecido com você").
  - Os alertas inline de conflito/pendente (introduzidos durante o período
    de múltipla escolha) foram mantidos — são uma melhoria de UX
    independente do radio vs. checkbox. "Pendente" agora significa "falta
    o Mais ou o Menos" (não mais "faltam palavras a classificar").
  - `normalizarRespostasA()` inverte de sentido: migra array (formato do
    período de múltipla escolha) → escalar, pegando a última marcação de
    cada array — antes fazia o caminho contrário.
  - `public/style/disc.css`: `.choice-radios input[type=checkbox]` e os
    seletores `label:has(input[type=checkbox]:...)` voltam a
    `[type=radio]`.
  - Efeito colateral positivo confirmado no documento de reteste: menos
    paradas de tabulação na Parte A (224 → 56) — um grupo de radios nativo
    conta como 1 parada de Tab só (as setas navegam dentro do grupo),
    enquanto 8 checkboxes por bloco contavam 8 cada.
  - `tests/disc.client.test.js`: os 4 testes específicos de múltipla
    escolha foram trocados por 4 novos testes de escolha forçada (inclusive
    um confirmando que a soma dos 4 traços é sempre 0, testado com 2
    padrões de preenchimento diferentes — a propriedade ipsativa que
    justificou o revert). O teste de regressão do `disc_state` antigo
    inverteu de sentido (agora testa array→escalar).
  - Testado também ao vivo num Chromium real com clique de verdade
    (`.click()`, não só `dispatchEvent` sintético): confirma que marcar
    uma 2ª palavra como Mais desmarca a 1ª automaticamente.
- **N-06 do reteste — remove a frase que comparava natural × adaptado em
  "pontos".** O bloco (era a correção do D-04 da auditoria anterior)
  subtraía o escore adaptado do natural pra achar "o traço que mais muda
  sob pressão", mas os dois perfis não estão na mesma escala: natural vem
  de 28 blocos com +1/-1 (varia -28 a +28), adaptado vem de 16 situações
  só com +1 (varia 0 a 16, nunca negativo). Confirmei rodando um cenário
  realista: o traço natural mais negativo sempre "vencia" essa conta, não
  importa qual — não é uma leitura real de adaptação, só um artefato da
  subtração entre réguas diferentes. O documento oferecia 2 correções (uma
  reformulação completa do instrumento, fundindo Partes A e B, ou remover
  a frase e manter só os 2 gráficos lado a lado); perguntei ao usuário, que
  escolheu a segunda — a reformulação fica pra uma decisão futura, não é
  um achado pontual.
  - `public/disc.html`: removido o cálculo do delta e o container
    `#adaptacaoDelta` do resultado — sobram as 2 seções de barra (natural
    e adaptado) lado a lado, cada uma na sua própria escala, sem frase
    comparando as duas.
  - `src/reports/discReport.js`: mesma lógica duplicada no PDF
    (`drawAdaptacaoDelta()`) — removida também, pelo mesmo motivo.
    Confirmei gerando um PDF de teste antes e depois da mudança.
  - 1 teste atualizado em `tests/disc.client.test.js` (era o teste do D-04,
    que checava a frase de delta) — agora confirma que `#adaptacaoDelta`
    não existe mais e que as 2 barras continuam renderizando.
  - Testado também ao vivo num Chromium real, preenchendo a avaliação
    inteira: confirma que a frase "pontos em relação" não aparece em
    nenhum lugar da tela de resultado.
- **Registra as 7 features novas da seção 05 do reteste como backlog no
  `CLAUDE.md`**, ordenadas por barateamento — usuário decidiu fechar a
  entrega atual (todos os achados de bug do reteste corrigidos) antes de
  entrar na fase de refinamento/features. Da mais barata pra mais cara:
  (08) frase de rodapé sobre o instrumento não ser de seleção, (05)
  selo de confiabilidade expandido, (07) painel de turma pro instrutor,
  (04) norma da própria base, (03) escore no servidor — a "robustez" já
  adiada antes —, (06) cadastro único com relatório combinado, (01)
  aposentar a Parte B e derivar os 2 perfis da Parte A (a reformulação
  grande que foi recusada como correção do N-06). Nenhum código mudou
  nesta entrada — só documentação.
- **Remove o item 01 (aposentar a Parte B) do backlog** — decisão
  explícita do usuário: "não iremos seguir por esse caminho". O backlog
  no `CLAUDE.md` fica com 6 itens em vez de 7; o item 01 não é mais
  reconsiderado sem pedido novo (nota deixada no próprio `CLAUDE.md`).
  Nenhum código mudou — só documentação.
- **Adiciona landing page institucional em `index.html`, pra fechar a
  entrega.** `index.html` (o menu com as 2 dinâmicas + QR code) virou
  `ferramentas.html` — conteúdo idêntico, só mudou de rota — e o
  `index.html` novo conta a história da Tática pela voz da fundadora
  Priscila Galindo, com um botão logo abaixo do header ("Acessar as
  ferramentas do treinamento") levando pra `ferramentas.html`.
  - Texto adaptado de `texto_auxiliar.md` (não versionado): a trajetória
    de Priscila, por que a empresa saiu de "a dona vende tudo" pra um
    setor comercial estruturado, e 2 citações dela em destaque
    ("as pessoas precisam comprar a empresa, não a dona" / "documento
    comercial não é burocracia").
  - 2 trechos extraídos de `politica_comercial.docx` (não versionado —
    é o protocolo interno da área comercial, com informação sensível
    demais pra publicar inteiro) ilustram a fala dela com artefato real:
    os 3 níveis de meta (Mínima/Esperada/Excelência) e os 5 rituais da
    área comercial (Daily/Semanal/Feedback/Fechamento/Revisão de ciclo)
    — não a tabela de comissionamento nem os limites de desconto, que
    ficam fora por serem informação comercial sensível.
  - Foto de Priscila (`public/img/priscila-galindo.jpg`, redimensionada
    de 1320×1292 pra 900×881, ~103KB) — veio de
    `public/img/WhatsApp Image 2026-09-07 at 14.55.17.jpeg`, renomeada.
  - `public/calculadora.html`/`disc.html`: o link "← Voltar ao menu"
    (antes `href="/"`) passa a apontar pra `/ferramentas.html`, já que
    `/` não é mais o menu.
  - `tests/server.test.js`: `GET /` agora confirma o conteúdo da landing
    (nome da Priscila + link pro botão), e novo teste cobre
    `GET /ferramentas.html`.
  - Testado ao vivo num Chromium real: as 3 rotas (`/`, `/ferramentas.html`,
    e os 2 "Voltar ao menu") navegam pro lugar certo; screenshot da
    landing inteira conferida visualmente.
- **Remove o link do painel do facilitador (`/admin.html`) do rodapé da
  landing page** — pedido do usuário: uma página institucional pública
  não deveria anunciar o link de login do painel administrativo, mesmo
  autenticado por token. Vira um aviso de direitos autorais ("© 2026
  Tática Gestão Contábil. Todos os direitos reservados."). O link pro
  admin continua existindo normalmente no rodapé de `ferramentas.html`
  (a página que só o facilitador/time usa, não o público). CSS órfão
  (`footer a`, sem mais nenhum link no rodapé desta página) removido
  junto.
- **Instrução visual de preenchimento na Parte A do DISC** — pedido do
  usuário: participantes se confundiam na hora de preencher (marcando
  mais de uma palavra por grupo, ou achando que precisavam marcar as 4).
  Reescrevi o texto de instrução (agora explícito: "só uma de cada,
  nunca a mesma frase nos dois grupos... as outras 2 ficam sem
  marcação") e adicionei um bloco de exemplo já preenchido logo abaixo,
  antes do Bloco 1 de verdade.
  - O exemplo reaproveita a mesma marcação HTML de um bloco real
    (`.choice-block`, `.choice-options`, `.choice-radios`) com
    `<input disabled>` — garante que o "+ Mais"/"− Menos" verde apareça
    visualmente idêntico ao de uma resposta de verdade, sem duplicar CSS.
    `disabled` tira os inputs do tab order e, sem `name`, não colidem
    com nenhum seletor/teste dos blocos reais.
  - CSS novo: `.example-wrap`/`.example-tag` (badge "Exemplo de
    preenchimento") e `.choice-block.example` (borda tracejada,
    diferencia visualmente de um bloco real).
  - Confirmado que os 28 blocos reais continuam 28 (`#blocksA fieldset`)
    e que nenhum input do exemplo tem `name` ou fica focável — testado
    via jsdom e visualmente num Chromium real.

### 2026-09-08

- **Escore do DISC calculado no servidor, não confia mais no cliente**
  (item 03 do backlog de robustez, ver `CLAUDE.md`) — antes, `POST
  /api/disc` e `POST /api/disc/pdf` recebiam `d_natural`/`i_natural`/...
  já prontos do `disc.html` e só recalculavam `perfil_dominante`/
  `arquetipo` em cima disso; dava pra abrir o console do navegador e
  fabricar qualquer perfil direto no POST. Escolhido como o item "menos
  custoso" da lista de robustez (puramente mudança de código, sem
  infraestrutura nova) em vez da robustez de carga (2k participantes
  simultâneos, adiada por enquanto).
  - `src/discScoring.js` (novo): duplica `BLOCOS_A`/`SITUACOES_B`/
    `INTENSIDADE_C` e `calcNatural()`/`calcAdaptado()`/
    `calcIntensidade()` de `disc.html` (mesma ideia do `ARQUETIPO_MAP`
    duplicado em `discReport.js`) — se o conteúdo das partes A/B/C mudar
    em `disc.html`, tem que espelhar aqui também. `SITUACOES_B`/
    `INTENSIDADE_C` guardam só `{trait}` (ordem mecanicamente uniforme,
    conferida antes de simplificar); `BLOCOS_A` guarda o `text` inteiro
    porque a ordem das palavras não é uniforme o bastante pra confiar sem
    poder auditar contra `disc.html`.
  - `src/server.js`: as duas rotas agora recebem `respostas.{a,b,c}`
    (respostas cruas por bloco/situação/item) e recalculam tudo
    (`d_natural`, ..., `perfil_dominante`, `arquetipo`) a partir disso —
    qualquer `d_natural`/etc. que o cliente ainda mande é ignorado.
  - `public/disc.html`: `montarPayloadBase()` parou de calcular e enviar
    os escores prontos (só manda `nome_participante`/`empresa` — o resto
    o servidor deriva de `respostas`).
  - **Bug crítico encontrado e corrigido antes de rodar teste nenhum**:
    `baixarPdf()` (botão "Salvar PDF") nunca enviava `payload.respostas`
    — só `sendResultado()` (botão "Enviar meu perfil") enviava. Sem essa
    correção, todo PDF baixado passaria a sair com todos os traços
    zerados, silenciosamente, assim que o servidor parasse de confiar nos
    escores prontos. Adicionada a mesma linha (`payload.respostas = {...
    }`) em `baixarPdf()`.
  - `tests/server.test.js`: os testes de `/api/disc` e `/api/disc/pdf`
    que mandavam `d_natural`/`i_natural`/etc. prontos foram reescritos
    pra montar `respostas.a` de verdade (blocos com `mais`/`menos`
    reais) — do jeito que estavam antes, ou quebravam, ou "passavam" por
    coincidência (ex.: todos os campos ignorados dando zero, empatando
    por acaso com o resultado esperado). Casos cobertos: traço dominante
    de verdade, empate técnico D+I (mesmo cenário do bug D-02), e um
    teste específico provando que `i_natural`/`d_natural` enviados
    "errados" de propósito no body são ignorados na geração do PDF.
  - `npm test`: 75/75 passando.
- **Conflito Mais/Menos na Parte A do DISC se resolve sozinho, em vez de
  travar o bloco** — testador relatou conseguir marcar a mesma frase como
  MAIS e MENOS (Mais e Menos são 2 `radio` de grupos independentes; o
  radio nativo só impede 2 marcações dentro do mesmo grupo, não entre os
  2). Antes disso virava um alerta de conflito (`.conflict`) que exigia o
  participante corrigir manualmente. Agora `updateBlocoA(bIdx,
  grupoAlterado)` recebe qual grupo o participante acabou de mexer, e ao
  detectar `mais === menos` mantém essa marcação e sorteia
  aleatoriamente outra palavra (excluindo a que empatou) pro outro grupo,
  marcando o `checked` do radio sorteado direto no DOM — o bloco nunca
  fica visivelmente em conflito nem exige correção manual.
  - `public/disc.html`: os 2 listeners de cada bloco (antes um único
    `querySelectorAll` combinando `_mais, _menos`) foram separados, cada
    um passando `'mais'`/`'menos'` pra `updateBlocoA` saber qual dos 2 foi
    a ação mais recente do participante (pra não desfazê-la ao sortear).
  - `avaliarBlocoA`/`.conflict-msg`/classe `.conflict` continuam no
    código como rede de segurança (um `disc_state` salvo antes dessa
    correção existir poderia, em teoria, carregar um overlap já salvo),
    mas não deveriam mais aparecer durante o preenchimento normal.
  - `tests/disc.client.test.js`: o teste que verificava o bloqueio por
    conflito foi reescrito pra verificar a resolução automática (Menos
    marcado por último permanece, Mais sorteado fica diferente de Menos,
    sem classe `.conflict`, bloco continua contando como respondido).
    Testado também manualmente via jsdom no sentido inverso (Mais
    alterado por último) pra confirmar que os dois sentidos funcionam.
  - `npm test`: 75/75 passando.
- **Preview do valor interpretado no ticket médio da calculadora** —
  testador digitou "2000663" (sem vírgula) no campo "Qual o seu ticket
  médio mensal?" e a linha 10 (contratos/mês) saiu "0 contratos" sem
  aviso nenhum. Diagnóstico: não é bug de cálculo — `parseBRNumber()` lê
  exatamente o que está documentado (`.` = milhar, `,` = decimal; sem
  nenhum dos dois, o valor vira um inteiro literal), então "2000663" virou
  R$ 2.000.663,00, um ticket ~1000x maior que o pretendido, fazendo
  meta mensal ÷ ticket arredondar pra menos de 1 contrato.
  - Avaliada e descartada a opção de por um teto/validação de valor
    máximo no campo (decisão do usuário: ticket médio real varia demais
    entre empresas clientes — uma pode legitimamente ter ticket de
    R$ 100.000 — travar um limite rejeitaria gente de verdade).
  - Implementado em vez disso: `atualizarPreviewTicket()` em
    `calculadora.html` mostra ao vivo, abaixo do campo, o valor que o
    sistema está lendo (`= R$ 2.000.663,00`, sempre com centavos via
    `fmtBRLComCentavos()`, diferente do `fmtBRL()` usado nos resultados
    calculados, que arredonda) — sem bloquear nem limitar nada, só
    deixando visível o que foi interpretado, pra quem esqueceu a vírgula
    perceber e corrigir sozinho.
  - Novo elemento `#ticket-preview` (`.field-preview` no CSS,
    `public/style/index.css`) entre o campo e a mensagem de alerta;
    ligado no `input` do ticket, na carga inicial (depois de
    `loadState()`, que popula o campo direto sem passar pelo listener) e
    no reset do formulário.
  - Testado via jsdom (preview aparece/some conforme o campo é
    preenchido/limpo) e visualmente num Chromium real, confirmando o
    cenário relatado ("2000663" → preview "= R$ 2.000.663,00" ao lado de
    "0 contratos").
  - `npm test`: 75/75 passando.
- **Preview do valor interpretado estendido pros outros 2 campos em
  reais** (faturamento, linha 1; meta de clientes novos/hunter, linha 12)
  — pedido do usuário depois de aprovar o preview do ticket: o mesmo risco
  de ambiguidade (sem separador = inteiro literal) existe em qualquer
  campo em reais, não só no ticket.
  - `atualizarPreviewTicket()` generalizada pra `atualizarPreviewMoeda(id)`
    + `atualizarPreviewsMoeda()`, dirigida por `CAMPOS_PREVIEW_MOEDA =
    ['faturamento', 'ticket', 'hunterValor']` — um único lugar pra
    adicionar um campo em reais novo no futuro (mais o `<p
    class="field-preview" id="<id>-preview">` correspondente no HTML).
  - Continua sem teto/validação de valor em nenhum dos 3 (mesma decisão
    do ticket: valor real varia demais entre empresas clientes).
  - Não estendido à tabela de equipe (`t-meta-<idx>`, meta mensal por
    pessoa) — layout de tabela compacta, sem espaço óbvio pra um preview
    por linha; fica pra reavaliar se surgir relato de confusão ali também.
  - Testado via jsdom nos 3 campos (aparece/some corretamente).
  - `npm test`: 75/75 passando.
- **Análise (sem código ainda): repensar a Parte A do DISC e aposentar a
  Parte B** — vários testadores relataram confusão na Parte A mesmo com o
  texto de instrução e o exemplo de preenchimento (ver entrada anterior no
  CHANGELOG). O usuário trouxe de volta o item 01 do
  `reteste-e-plataforma-ideal.md` (antes descartado, ver CLAUDE.md): os
  dois gráficos (natural e adaptado) viriam das mesmas 28 marcações da
  Parte A — MENOS forma o natural, MAIS forma o adaptado —, aposentando a
  Parte B (16 situações) inteira. A sugestão de UI ("cards" de MAIS/MENOS)
  ficou sem mecanismo de seleção definido; proposta feita em conversa (não
  implementada): fluxo sequencial de 2 passos por bloco — "qual é MAIS
  parecida?" (escolhe 1 de 4) e depois "qual é MENOS parecida?" (escolhe 1
  das 3 restantes, a já escolhida como Mais some da lista) — elimina o
  estado de conflito por construção (não dá pra marcar a mesma frase 2x
  porque ela não aparece mais na 2ª pergunta), diferente do modelo atual
  (2 grupos de radio simultâneos + resolução automática de conflito).
  - Quebra de PDF identificada: `drawSignedBarSection(doc, adaptado, 16)`
    em `src/reports/discReport.js` assume adaptado numa escala 0–16 (Parte
    B); no modelo novo adaptado vira uma contagem 0–28 (mesma escala do
    natural) — barra teria que mudar de "com sinal" (`-ref` a `+ref`) pra
    uma contagem simples (como já é `drawIntensitySection`), pros dois
    perfis.
  - `LIMIAR_EMPATE_TRACOS = 2` (empate de perfil) foi calibrado pro natural
    atual (-28 a +28); precisa ser revalidado pra contagem 0–28 antes de
    reaproveitar sem revisão.
  - Dado histórico: registros já gravados em `disc_respostas` foram
    calculados pela fórmula atual — trocar a fórmula sem migrar deixa
    registros antigos incomparáveis com os novos (mas o `.a` bruto já
    salvo é suficiente pra recalcular, se um dia quisermos).
  - Robustez de carga (2k participantes): essa mudança é neutra pro banco
    — continua 1 gravação por envio, payload até um pouco menor sem
    `respostas.b`. Não resolve nem piora o gargalo de 2k simultâneos (ver
    nova seção "Robustez pra >2k participantes simultâneos" no
    CLAUDE.md) — são frentes independentes.
  - Nada implementado ainda — análise e proposta de UX apresentadas na
    conversa, aguardando decisão do usuário sobre escopo antes de mexer em
    `disc.html`/`discScoring.js`/`discReport.js`/testes.
- **Nova seção no CLAUDE.md: robustez pra >2k participantes simultâneos,
  reconhecida como dívida técnica, não mais adiada** — pedido explícito do
  usuário pra seguir práticas de DevOpsSec daqui pra frente. Lista os
  gargalos já identificados (SQLite não escala horizontalmente, processo
  Node único sem cluster, geração de PDF síncrona/bloqueante, 1 instância
  Render sem load balancer, sem rate limiting, nenhum teste de carga real
  rodado, sem monitoramento/alerta) como trabalho ativo, e passa a exigir
  que toda mudança de UX/instrumento também seja avaliada por esse ângulo.
- **Parte A do DISC vira passo a passo, e a Parte B (situações) é
  aposentada** (item 01 do reteste-e-plataforma-ideal.md, reaberto por
  pedido do usuário depois de vários testadores relatarem confusão na
  Parte A mesmo com o texto de instrução e o exemplo visual da mudança
  anterior). Decisão do usuário: registros de teste já coletados sob o
  modelo antigo podem ser apagados sem migração — não há um script de
  recálculo dos dados históricos.
  - **UX (public/disc.html, public/style/disc.css):** cada bloco agora
    responde em 2 passos sequenciais — Passo 1 escolhe a frase MAIS
    parecida (das 4), Passo 2 escolhe a MENOS parecida (só das 3 que
    sobraram). O Passo 2 (`.choice-step-menos`) começa com todas as opções
    `disabled` até o Passo 1 responder, e a opção igual à escolhida no
    Passo 1 fica `disabled` + tag "Já é sua Mais" —
    `atualizarDisponibilidadeBlocoA(bIdx)` cuida disso a cada mudança, sem
    reconstruir o DOM (evita perder foco/posição do teclado). Elimina o
    conflito (mesma frase marcada como Mais e Menos) **por construção** —
    a versão anterior (2 grupos de radio simultâneos, resolvidos com um
    sorteio automático quando colidiam) ainda deixava as pessoas confusas.
    Cada opção virou um `<label class="choice-card">` que já embrulha o
    radio + o texto — nome acessível vem do próprio conteúdo, sem precisar
    mais de `aria-labelledby` (só era necessário quando o texto ficava
    fora do `<label>`, compartilhado entre os 2 radios do modelo anterior).
    `updateBlocoA` mantém uma rede de segurança: se `mais === menos`
    (só possível via `disc_state` salvo antes dessa correção existir, ou
    trocar a Mais depois de já ter respondido a Menos pra a mesma palavra
    que virou a nova Mais), limpa a ponta que não acabou de mudar.
  - **Escore (public/disc.html, src/discScoring.js, src/server.js):** os
    2 perfis (natural e adaptado) agora vêm das mesmas 28 marcações da
    Parte A — `calcNatural()` conta quantas vezes cada traço foi MENOS
    (o que exige menos esforço), `calcAdaptado()` conta quantas vezes foi
    MAIS (o que aparece quando o ambiente pede diferente). Os 2 viraram
    contagens sem sinal, 0 a 28 — mesma escala, ao contrário do modelo
    antigo (natural -28..+28 combinando Mais(+1)/Menos(-1); adaptado 0..16
    de uma Parte B separada de 16 situações) que produzia o N-06 (réguas
    incompatíveis). `calcAdaptado()` mudou de assinatura: recebia
    `respostasB` (situações), agora recebe `respostasA` (mesmo array da
    Parte A) — `POST /api/disc`/`POST /api/disc/pdf` em `src/server.js`
    chamam `calcAdaptado(respostas.a)`, não mais `respostas.b`.
    `SITUACOES_B` removida de `disc.html` e `discScoring.js` (as duas
    cópias, mesma convenção do `BLOCOS_A`/`INTENSIDADE_C`).
  - **PDF (src/reports/discReport.js):** `drawSignedBarSection()` (barra
    "com sinal", -ref a +ref — fazia sentido pro natural antigo, já era
    meio forçado pro adaptado 0..16) virou `drawUnsignedBarSection()`
    (contagem simples, 0 a `ref`) — os 2 perfis chamam com `ref=28` agora.
    Títulos/subtítulos das seções "Perfil natural"/"Perfil adaptado"
    reescritos (o antigo "Perfil adaptado (trabalho)" descrevia as 16
    situações de trabalho, que não existem mais).
  - **UI (public/disc.html):** hero/`.how-grid` de 3 cards (Parte
    A/B/C) virou 2 cards (Parte A = natural+adaptado, Parte B =
    intensidade). A antiga "Parte C" (intensidade) virou "Parte B" na UI
    (`#partB`, badge, `btnAtoB`/`btnBtoA`, `validMsgB`) — internamente as
    variáveis/funções continuam com sufixo "C" (`INTENSIDADE_C`,
    `respostasC`, `calcIntensidade`, `#intensityC`) por convenção
    histórica do instrumento, documentado no código pra não confundir.
    `LIMIAR_EMPATE_TRACOS` (empate técnico) mantido em 2 — mesma ordem de
    grandeza da escala nova (0-28), mas não foi revalidado com dado real;
    fica registrado como pendência se um dia houver volume de respostas
    pra calibrar de verdade.
  - **Testes:** `tests/disc.client.test.js` reescrito (novo describe
    "Parte A vira passo a passo", removido o describe da Parte B de
    situações, `completarParteA`/`completarIntensidade` atualizados,
    propriedade ipsativa testada como "soma sempre 28" em vez de "soma
    sempre 0"). `tests/server.test.js`: os 2 describes de `/api/disc` e
    `/api/disc/pdf` com fixtures reconstruídas pro novo modelo (natural
    vem de MENOS, adaptado vem de MAIS).
  - Testado visualmente num Chromium real: Passo 2 bloqueado até o Passo 1
    responder, tag "Já é sua Mais" na opção indisponível, e o PDF gerado
    de ponta a ponta confirmando natural/adaptado corretos na escala nova.
  - `npm test`: 75/75 passando.
- **Parte A vira 2 rodadas pelos mesmos 28 blocos, não 2 passos empilhados
  dentro do mesmo bloco** — usuário testou o passo a passo (entrada
  anterior) e relatou que "1. Mais" em cima e "2. Menos" embaixo, no
  mesmo bloco, ainda confundia. Pedido: deixar todos os 28 blocos só como
  Mais, e assim que os 28 forem preenchidos passar pra rodada do Menos.
  - `public/disc.html`: Parte A agora tem 2 listas de blocos separadas —
    `#blocksAMais` (28 blocos, só a pergunta Mais, construída 1x no
    carregamento) e `#blocksAMenos` (28 blocos, só a pergunta Menos,
    **não existe até terminar a Rodada 1** — só é construída quando a
    Rodada 2 abre, e sempre reconstruída nesse momento pra refletir
    qualquer mudança feita na Rodada 1 desde a última vez). Só uma fica
    visível por vez (`mostrarFaseA('mais' | 'menos')`), controlada por
    `state.faseA` (novo campo no `disc_state`, persistido).
  - Na Rodada 2, a opção igual à escolhida como Mais naquele bloco vem
    `disabled` + tag "Já é sua Mais" (mesma ideia da versão anterior, só
    que agora calculada 1x na construção da rodada, não a cada clique).
  - Botões: `btnMaisToMenos` (Rodada 1 → 2, valida os 28 Mais antes),
    `btnMenosToMais` (volta pra Rodada 1), `btnAtoB` (Rodada 2 → Parte B,
    valida os 28 Menos antes). `updateBlocoMais` limpa a Menos de um
    bloco se a pessoa voltar e trocar a Mais pra palavra que já era a
    Menos naquele bloco (rede de segurança, caso raro mas alcançável
    voltando/mudando de ideia).
  - Removido o conceito de "conflito" (`.conflict-msg`, classe
    `.conflict`) — como a opção correspondente já vem desabilitada na
    Rodada 2, não tem mais como um `disc_state` corrompido (`mais ===
    menos`) travar a UI com uma mensagem especial; o bloco só fica
    pendente até a pessoa escolher de novo (autocorretivo, sem aviso
    dedicado).
  - **Bug encontrado só em teste visual (Chromium real, não pego pelos
    testes jsdom):** `.blocks-list`/`.nav-actions` declaram `display:
    flex`, que sempre vence a folha de estilo do navegador (quem aplica
    `display:none` a `[hidden]`) — sem uma regra de autor equivalente,
    alternar `hidden` via JS não escondia nada visualmente; a Rodada 2
    aparecia sobreposta/misturada com a Rodada 1 na tela real, mesmo com
    `hidden=true` correto no DOM (por isso os testes jsdom, que checam a
    propriedade `hidden`, não pegos essa por não renderizar CSS de
    verdade). Corrigido com `[hidden] { display: none !important; }` no
    topo de `disc.css`.
  - `public/style/disc.css`: removido `.choice-step`/`.choice-step-title`
    /`.choice-step-menos.bloqueado` (o conceito de 2 passos dentro do
    bloco não existe mais) e o bloco de CSS do `.conflict`.
  - Testes: `tests/disc.client.test.js` reescrito pro modelo de 2 rodadas
    (novo describe, fixtures usando `#blocksAMais`/`#blocksAMenos`,
    incluindo teste da rede de segurança pro `disc_state` corrompido sem
    a mensagem de conflito).
  - Testado visualmente num Chromium real com `localStorage.clear()`
    entre execuções (senão a Parte A retomava de uma sessão anterior) —
    Rodada 1 preenchida, transição pra Rodada 2 com a opção certa
    desabilitada + tag, resultado final e PDF gerados corretamente.
  - `npm test`: 75/75 passando.
- **Responsividade da Rodada 2 (Menos) da Parte A no celular** — usuário
  relatou que a opção com a tag "Já é sua Mais" ficava fora do
  enquadramento no celular. Causa: o breakpoint mobile
  (`@media max-width:600px` em `public/style/disc.css`) nunca tinha
  ganhado uma regra pra `.choice-cards` — os cards continuavam em grade
  de 2 colunas mesmo em telas estreitas, e o texto da frase + a tag lado
  a lado num card estreito não cabiam. O breakpoint ainda tinha
  `.choice-options`/`.choice-option` (classes da versão anterior à atual,
  já não existem no HTML) — removidas.
  - `.choice-cards { grid-template-columns: 1fr; }` no mobile — 1 coluna,
    cards com largura total.
  - `.choice-card { flex-wrap: wrap; }` + `.choice-card-tag { flex-basis:
    100%; margin-left: 0; margin-top: 4px; }` — a tag quebra pra linha
    própria embaixo do texto em vez de espremer ao lado. Desktop não muda
    (2 colunas, tag inline ao lado do texto, como já era).
  - Testado visualmente num Chromium real com viewport de celular
    (375×700, `Emulation.setDeviceMetricsOverride`) — confirmado que a
    opção "Já é sua Mais" agora cabe inteira, sem cortar nem sair do
    card.
  - `npm test`: 75/75 passando (mudança só de CSS, sem alterar
    comportamento testado).
- **Landing page (`index.html`): download da Política Comercial, foto do
  CRM/funil e texto reduzido/realinhado** — pedido do usuário.
  - **Download real do documento**: `politica_comercial.docx` (raiz do
    repo, referência não versionada) foi copiado pra
    `public/politica-comercial-tatica.docx` — este sim **versionado**,
    de propósito, porque precisa existir no deploy pra ser baixável. O
    cartão "Trecho da Política Comercial" (só informativo antes) virou
    `.doc-download`, com título, descrição e um botão
    `<a href="/politica-comercial-tatica.docx" download>`.
  - **Imagem nova**: `img/plataforma.jpeg` (screenshot real do CRM/funil
    comercial da Tática — Lead → Contato → Reunião → Proposta →
    Negociação → Assinatura → Pagamento) adicionada logo depois da lista
    de rituais, com legenda ligando à reunião semanal ("é essa reunião que
    olha pra esse painel").
  - **Texto reduzido**: os 2 parágrafos de "Por que os documentos
    comerciais são fundamentais" viraram 1 só (mesmas ideias, menos
    palavras); o parágrafo solto "Meta não nasce na área comercial..."
    virou a introdução da seção de rituais (ganhou um `<h2>` que não
    existia — a lista de rituais antes não tinha nenhum título próprio);
    frase da "troca de cadeira" enxugada.
  - **Alinhamento consertado**: o hero tinha `text-align:center` no bloco
    inteiro com uma exceção pontual (`.lead { text-align: left }`) pra não
    seguir o centro — trocado por `text-align:center` direto em cada
    elemento da identidade (eyebrow/nome/cargo), sem exceção nenhuma; o
    parágrafo de abertura (`.lead`) fica com o texto naturalmente à
    esquerda (mais legível em várias linhas), só a coluna centralizada via
    `max-width` + `margin:auto`. Removida também a regra mobile que
    forçava `.lead` centralizado (não fazia mais sentido com o padrão
    novo, consistente entre breakpoints).
  - `.doc-download` empilha verticalmente no mobile (`@media
    max-width:620px`), botão de download com largura total.
  - Testado ao vivo: `GET /politica-comercial-tatica.docx` e `GET
    /img/plataforma.jpeg` respondem 200; conferido visualmente num
    Chromium real (identidade centralizada + parágrafo alinhado à
    esquerda, cartão de download, imagem do funil com legenda).
  - `npm test`: 75/75 passando (o teste de `GET /` só checa "Priscila
    Galindo" e "ferramentas.html", ambos inalterados).
