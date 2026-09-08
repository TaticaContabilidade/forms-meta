# CLAUDE.md

Orientações para trabalhar neste repositório (`forms-meta`).

## O que é o projeto

Backend Node.js (Express 5 + `better-sqlite3`) que serve duas ferramentas de
treinamento comercial em `public/`:

- `index.html` — landing page institucional: a história da Tática contada
  pela fundadora Priscila Galindo, com trechos da política comercial
  interna (`politica_comercial.docx`, na raiz do repo, não versionado)
  ilustrando a fala dela. Um botão logo abaixo do header ("Acessar as
  ferramentas do treinamento") leva pra `ferramentas.html` — é o ponto de
  entrada do site (`GET /`), sem lógica de formulário nem `<script>`.
- `ferramentas.html` — o menu com as duas dinâmicas + QR code pra
  compartilhar com o time (era o `index.html` antes da landing page
  entrar; só mudou de nome/rota, conteúdo idêntico).
- `calculadora.html` — "Qual é a sua meta comercial?", grava respostas em
  `POST /api/metas` (tabela `metas`).
- `disc.html` — avaliação DISC, grava respostas em `POST /api/disc` (tabela
  `disc_respostas`).
- `admin.html` — painel autenticado (`x-admin-token` / `?token=`) para listar,
  exportar CSV e apagar registros de ambas as tabelas.

Todas as páginas com `<a>← Voltar ao menu</a>` linkam pra
`/ferramentas.html`, não pra `/` — `/` agora é a landing page, não o menu.

`src/server.js` é o único arquivo de backend; ele exporta o `app` do Express
(`module.exports = app`) e só chama `app.listen` quando executado diretamente
(`require.main === module`), justamente para poder ser importado nos testes
sem abrir porta.

### Relatórios em PDF

`src/reports/pdfLayout.js` tem a base compartilhada (com `pdfkit`) usada por
todo relatório: paleta, margens, paginação/rodapé numerado, faixa de
cabeçalho, título de seção, callout colorido, sanitização de nome de arquivo
e `Content-Disposition` com acentos (RFC 5987 + fallback ASCII). Cada
relatório é um documento formatado de verdade (cards, tabelas, gráficos de
barra) — nunca um "print" da página HTML.

- `src/reports/metaComercialReport.js` — relatório da calculadora de meta
  comercial. `POST /api/metas/pdf` (não grava no banco; mesmo payload de
  `POST /api/metas`) é consumido pelo botão "Salvar meu resultado (PDF)" em
  `calculadora.html`. Nome do arquivo: `${nome do participante} meta
  comercial.pdf`.
- `src/reports/discReport.js` — relatório da avaliação DISC (arquétipo,
  barras de perfil natural/adaptado/intensidade, os 4 perfis, insights de
  performance). Repete localmente o `ARQUETIPO_MAP` de `disc.html` porque o
  relatório é gerado no servidor e não deve depender do texto que o cliente
  mandou. `POST /api/disc/pdf` (não grava no banco; mesmo payload de
  `POST /api/disc`) é consumido pelo botão "Salvar PDF" em `disc.html`. Nome
  do arquivo: `${nome do participante} perfil disc.pdf`.

  **Nome do arquivo por participante nos dois relatórios** (não por
  empresa) — decisão explícita, ver CHANGELOG.md (D-13 da auditoria do
  DISC). Não reverta pra empresa sem confirmar de novo.

  **Empate entre traços:** `resolverPerfilDominante(scores)` (duplicada em
  `disc.html` e `discReport.js`, mesmo `LIMIAR_EMPATE_TRACOS = 2`) nunca
  atribui dominância a um traço só porque `Math.max` com ordem fixa D,I,S,C
  desempataria por posição. Se a diferença entre o 1º e o 2º traço for menor
  que o limiar, o resultado vira um perfil combinado (`traits` com 2
  elementos, ex. `"D+I"`) — hero, insights e `perfil_dominante`/`arquetipo`
  salvos no banco todos refletem os dois traços, nunca um só.

  **Escore calculado no servidor, não confia no cliente.**
  `src/discScoring.js` duplica `BLOCOS_A`/`SITUACOES_B`/`INTENSIDADE_C` e as
  funções `calcNatural()`/`calcAdaptado()`/`calcIntensidade()` de
  `disc.html` (mesma ideia do `ARQUETIPO_MAP` duplicado em
  `discReport.js`) — se o conteúdo das partes A/B/C mudar em `disc.html`,
  espelhe a mudança aqui também. `POST /api/disc` e `POST /api/disc/pdf`
  recebem `respostas.{a,b,c}` (as respostas cruas por bloco/situação/item)
  e recalculam `d_natural`/`i_natural`/... e `perfil_dominante`/`arquetipo`
  inteiramente no servidor a partir disso — nunca confiam em nenhum escore
  pronto que o cliente mande (`disc.html` nem envia mais esses campos,
  ver `montarPayloadBase()`). Isso fecha o buraco de quem abria o console
  do navegador e fabricava um `d_natural` qualquer direto no POST, e evita
  persistir um resultado calculado por uma versão desatualizada/cacheada de
  `disc.html`. `SITUACOES_B`/`INTENSIDADE_C` guardam só `{trait}` (sem o
  texto de exibição, que só existe em `disc.html`) porque a ordem dos
  traços nessas duas partes é mecanicamente uniforme (situações sempre
  D,I,S,C; intensidade sempre D×3,I×3,S×3,C×3) — já `BLOCOS_A` guarda o
  `text` inteiro porque a ordem das palavras não é uniforme o bastante pra
  confiar sem poder auditar visualmente contra `disc.html`.

Em ambos os HTML, o download baixa o PDF via `fetch` + blob e lê o nome do
arquivo do header `Content-Disposition` da resposta — não usam mais
`window.print()`.

**Parte A é escolha forçada de verdade — `<input type="radio">`, não
`checkbox`.** Cada bloco tem 2 grupos de escolha (Mais/Menos), e o radio
nativo garante no máximo 1 palavra marcada por grupo — não dá pra marcar 2
como Mais mesmo tentando. Isso existiu diferente por um tempo: entre o
commit que trocou pra `checkbox` (permitindo marcar várias palavras por
grupo) e o N-05 do reteste externo (`reteste-e-plataforma-ideal.md`), que
apontou que isso quebrava a propriedade **ipsativa** do instrumento — com
`checkbox` o total de pontos por pessoa deixava de ser constante (a soma dos
4 traços podia variar de 0 a -56 dependendo de quantas palavras a pessoa
marcava por bloco), o que invalida qualquer comparação entre perfis de
pessoas diferentes. Voltou a ser `radio` (histórico no CHANGELOG). Um bloco
conta como respondido (`blocoARespondido(bIdx)` em `disc.html`, via
`avaliarBlocoA(bIdx)`) quando exatamente 1 palavra foi marcada em Mais **e**
1 em Menos, e não é a mesma palavra nos dois grupos (conflito — só isso o
radio não impede sozinho, já que Mais e Menos são 2 grupos independentes).
`calcNatural()` soma o traço da palavra em Mais e subtrai o da palavra em
Menos — sempre exatamente ±1 por bloco, nunca mais que isso.

**Não reintroduza múltipla escolha na Parte A sem entender a implicação
psicométrica** (ver seção 04 do documento de reteste) — o instrumento clássico
depende do total ser constante entre respondentes pra ser comparável.

**Não compare natural × adaptado com uma frase numérica de delta** (N-06 do
reteste). `calcNatural()` varia de -28 a +28 (28 blocos, +1/-1);
`calcAdaptado()` varia de 0 a 16 (16 situações, só +1) — são escalas
diferentes, subtrair um do outro não produz "pontos" de nada (o traço
natural mais negativo sempre "vencia" a conta, artificialmente). Existiu um
bloco assim (`#adaptacaoDelta` em `disc.html`, `drawAdaptacaoDelta()` em
`discReport.js`) — removido. Os dois perfis aparecem lado a lado (tela e
PDF), cada um na sua própria escala, sem comparação numérica entre eles.
Se um dia isso for resolvido de verdade, é derivando os dois perfis do
mesmo instrumento na mesma escala (ver seção 04/05 do documento de
reteste) — não voltando a subtrair réguas diferentes.

Cada bloco tem 2 alertas inline (`.conflict-msg`/`.pending-msg`, classes
`.conflict`/`.pending` no `<fieldset>`, cores `--danger`/`--warning`):
conflito (mesma palavra nos 2 grupos) e pendente (falta classificar alguma
palavra). Um `Set` em memória (`blocosAlertaVisivel`, não vai pro
`localStorage`) controla quando cada alerta pode aparecer — assim que o
participante mexe naquele bloco (`updateBlocoA`), ou em todos os blocos
pendentes de uma vez quando ele clica "Continuar para Parte B" sem terminar
(mesmo os nunca tocados) — pra não mostrar "pendente" nos 28 blocos de cara,
antes de qualquer interação.

**Parte B (situações) segue o mesmo padrão de alerta de pendente**, mas mais
simples: como cada situação é escolha única (`radio`), não existe estado
"parcialmente respondido" nem conflito — só respondida ou não. Por isso
`situacoesAlertaVisivel` (mesma ideia do `blocosAlertaVisivel` da Parte A) só
é preenchido no clique de "Continuar para Parte C", nunca durante a
digitação — responder uma situação já resolve o alerta dela na hora, então
não há por que revelar cedo. Clicar no botão com pendências sinaliza
**todas** de uma vez (`.situation-card.pending`, `--warning`) e rola até a
primeira, igual a Parte A.

**Compatibilidade do `disc_state` salvo:** sempre que o formato de
`respostasA`/`respostasB`/`respostasC` mudar, `loadState()` precisa migrar o
formato antigo na leitura (ver `normalizarRespostasA`) — nunca assumir que o
`localStorage` de quem já estava com uma avaliação em andamento vai estar no
formato novo. `renderParteA()`/B()/C() rodam em sequência, sem try/catch,
direto no topo do script; uma exceção em qualquer uma trava as três (nenhum
bloco aparece). Já aconteceu duas vezes com `respostasA[bIdx].mais`/`.menos`
(valor único → array, no commit que trocou pra `checkbox`; array → valor
único de novo, no revert do N-05) — nenhuma das duas vezes foi pega pelos
testes existentes até então porque nenhum simulava um `disc_state` no
formato anterior. `normalizarRespostasA()` sempre precisa saber ler o
formato imediatamente anterior ao atual, não só o "correto".

### Identidade visual (favicon)

`public/favicon.ico` e `public/img/favicon-{16,32}.png` /
`apple-touch-icon.png` vêm do símbolo (seta) isolado do logo oficial da
Tática, extraído em vetor da página 5 de `Logo Tática.ai` (Illustrator,
1000×1000pt/página, 7 páginas com variações do logo) — não do arquivo
`.jpg`/`.pdf` de exportação, que é o logo completo (símbolo + "Tática" +
"Gestão Contábil") e vira ilegível/borrado quando reduzido a 16–32px. Os
quatro HTML em `public/` (`index.html`, `calculadora.html`, `disc.html`,
`admin.html`) linkam os quatro tamanhos no `<head>`. Se o logo for
atualizado, repita o processo a partir do `.ai`/`.pdf` vetorial (nunca a
partir de um raster), isolando só o símbolo antes de gerar os tamanhos —
`pdftocairo -png -r 600 -transp` preserva o alpha; um `pdftoppm` comum não
tem essa flag nesta versão do poppler.

### Deploy (Render) e persistência do banco

`render.yaml` roda no plano **starter** (não `free`) porque só planos pagos
suportam **Persistent Disk** — sem disco, o SQLite (`db/metas.db`) some a
cada deploy e quando a instância dorme por inatividade (comportamento do
plano free, que o starter também não tem). O disco é montado em
`/var/data` e `DB_PATH=/var/data/metas.db` aponta o `better-sqlite3` pra
lá — sem nenhuma mudança de código em `src/server.js`, que já lê `DB_PATH`
do ambiente. Localmente (`.env`/`npm start` sem `DB_PATH` definido) continua
gravando no default `db/metas.db`, dentro do próprio repo — só o ambiente
do Render é diferente.

Se um dia crescer para precisar de um banco relacional de verdade (múltiplos
serviços, backups gerenciados, queries mais complexas), a alternativa é o
PostgreSQL gerenciado do Render — mas isso exige reescrever a camada de
banco (`better-sqlite3` → `pg`) em `src/server.js`, não é só configuração de
infraestrutura. Não faça essa migração sem pedido explícito.

## Backlog: features novas (não são bugs)

A seção "05 — Como seria a plataforma" de `reteste-e-plataforma-ideal.md`
(documento de reteste externo, não versionado — ver convenção de prefixo `_`
abaixo, embora este não tenha o prefixo por não ter sido pedido) lista 8
ideias de evolução da plataforma. O item 02 (escolha forçada com radio
agrupado) já foi entregue — era o N-05, ver CHANGELOG. O item 01 (aposentar
a Parte B, derivando os 2 perfis das mesmas 28 marcações da Parte A) foi
avaliado e **descartado por decisão explícita do usuário** — não faz parte
do backlog, não reconsiderar sem pedido novo. Os 6 restantes são **features
novas, não correções** — ficam pra fase de refinamento, depois que a
entrega atual fechar. Ordenados por barateamento (mais barato primeiro):

1. **Uma linha sobre o que o instrumento não é** (item 08) — uma frase de
   rodapé no relatório e no PDF ("leitura de estilo comportamental para
   desenvolvimento, não instrumento de seleção"). Sem lógica nova, sem
   schema novo. O mais barato de longe.
2. **Selo de confiabilidade da resposta, expandido** (item 05) — o aviso de
   "respostas pouco diferenciadas" (D-05) já existe; falta capturar tempo
   de preenchimento e sequência de respostas idênticas. Precisa de campos
   novos (timestamps, ou um log leve de interação) mas não toca no cálculo
   existente.
3. **Painel de turma pro instrutor** (item 07) — `admin.html` já lista/
   exporta/apaga; falta agregar (distribuição de perfis, metas impossíveis,
   incoerências de distribuição). Os dados já estão no banco — é só
   consulta e UI novas, sem mudar o que já é gravado.
4. **Norma da própria base** (item 04) — parecido com o item 07 (consulta
   agregada sobre dados já existentes: "2º mais D entre os 40"), mas só
   fica útil com volume real de respondentes na base — sem massa crítica,
   não compensa implementar ainda.
5. ~~**Escore no servidor, não no navegador** (item 03)~~ — feito. Ver
   `src/discScoring.js` e a seção "Escore calculado no servidor" acima.
6. **Um cadastro, um participante, duas ferramentas** (item 06) — hoje
   nome/empresa são digitados 2x, cada ferramenta com seu `localStorage` e
   PDF separados. Precisa de um identificador compartilhado entre as duas
   ferramentas e um relatório combinado novo (meta comercial + perfil
   DISC) — maior que os itens acima, mexe na identidade de dados das duas
   tabelas.

## Fluxo de commit

Sempre que o usuário pedir para commitar (ex.: "comita", "pode commitar",
"suba isso"), siga esta sequência, nesta ordem. **Toda alteração vive numa
branch — nunca commitar direto na `main`.**

1. **Rodar os testes**, se existirem (`npm test`) — não commitar com teste
   quebrado. Se não houver testes cobrindo a mudança, siga em frente.
2. **Criar (ou reaproveitar) uma branch** para a mudança — `git checkout -b
   <tipo>/<nome-curto>` (ex.: `fix/validacao-por-campo`,
   `feat/relatorio-pdf`). Se já estiver numa branch de trabalho aberta para
   o mesmo assunto, reaproveite-a em vez de criar outra.
3. **Criar commits atômicos** nessa branch — um commit por mudança
   logicamente coesa (não misture, por exemplo, uma feature nova com um
   refactor não relacionado). Nunca incluir `*.pdf` nem arquivos/diretórios
   com prefixo `_` (ver convenção abaixo) — confira `git status` antes de
   `git add`.
4. **Mergiar a branch na `main`** — `git checkout main && git merge
   <branch>` (fast-forward quando possível).
5. **Atualizar o remoto** — `git push origin main` **e** `git push origin
   <branch>` (mantém a branch publicada, rastreável).

## Relato de mudanças em CHANGELOG.md

Além de responder na conversa, toda mudança feita no repositório também é
registrada em `CHANGELOG.md`, organizado por branch: sempre que a branch de
trabalho mudar em relação à entrada anterior, abra um novo cabeçalho
`## Alterações branch <nome>` antes de registrar a mudança (fica fácil
localizar no tempo o que foi feito em cada trabalho). Dentro de uma mesma
branch, novas entradas vão em ordem cronológica (mais recente por último),
com a data (`### AAAA-MM-DD`). Escreva o registro do ponto de vista do que
mudou e por quê — não é changelog de usuário final, é um diário de bordo
técnico para quem (humano ou não) precisar entender depois o que foi feito
e quando.

## Rodar e testar

```bash
npm install
npm start          # sobe em http://localhost:3000
npm test           # node --test — roda tests/*.test.js
```

Os testes usam o runner nativo do Node (`node --test`):

- `tests/server.test.js` — API (`supertest`). Cada execução aponta `DB_PATH`
  para um SQLite temporário em `os.tmpdir()` e limpa o arquivo no `after()`
  — nunca escreve em `db/metas.db`.
- `tests/calculadora.client.test.js` — lógica client-side de
  `calculadora.html` num DOM real (`jsdom`), carregando o HTML de verdade e
  disparando eventos reais (`input`/`change`/`click`). Se mexer em
  `calculadora.html`, rode esses testes — é a única cobertura automatizada
  que existe da UI (parsing de número, validação, tabela de equipe,
  persistência local).
- `tests/disc.client.test.js` — mesma ideia pra `disc.html`. Preenche a
  avaliação inteira de forma determinística (ver comentário no topo do
  arquivo) pra chegar na tela de resultado e testar arquétipo, modulação
  por intensidade, persistência de nome/empresa e a confirmação inline do
  "Refazer avaliação". Os dois arquivos de teste
  usam um `VirtualConsole` próprio (sem `.sendTo(console)`) pra suprimir o
  aviso "Not implemented" que o `window.scrollTo`/`scrollIntoView` do jsdom
  imprime a cada chamada — isso não esconde erro de verdade: uma exceção
  real lançada dentro de um handler ainda propaga pro teste normalmente.

## Convenção: prefixo `_` = não versionar

Qualquer arquivo ou diretório cujo nome comece com `_` é conteúdo local do
usuário (capturas de tela, PDFs de exemplo, rascunhos etc.) e **nunca deve
subir ao git**. Isso é reforçado pela regra `_*` no `.gitignore` — não
remova essa regra, e não force `git add` sobre algo com esse prefixo.

Da mesma forma, **nenhum `*.pdf` sobe ao git** (regra própria no
`.gitignore`, independente do prefixo `_`) — são sempre relatórios
gerados/baixados localmente, nunca artefatos de código.

## Convenções de código

- Sem framework de build/transpile: os HTML em `public/` são estáticos, com
  JS inline em `<script>` no fim do arquivo (sem módulos, sem bundler).
- Todo texto voltado ao usuário (labels, mensagens de erro, commits) é em
  português.
- Variáveis de ambiente: `PORT`, `ADMIN_TOKEN`, `DB_PATH` (ver `.env.example`).
- Antes de mudanças em `src/server.js`, rode `npm test`.
