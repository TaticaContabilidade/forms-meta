# CLAUDE.md

Orientações para trabalhar neste repositório (`forms-meta`).

## O que é o projeto

Backend Node.js (Express 5 + `better-sqlite3`) que serve três ferramentas de
treinamento comercial em `public/`:

- `index.html` — landing page institucional: a história da Tática contada
  pela fundadora Priscila Galindo, com trechos da política comercial
  interna ilustrando a fala dela, uma foto real do CRM/funil comercial
  (`img/plataforma.jpeg`) e um cartão de download do documento completo
  (`public/politica-comercial-tatica.docx`, **versionado** — pedido
  explícito do usuário pra ficar baixável pelos participantes; é uma cópia
  de `politica_comercial.docx` na raiz do repo, que continua não
  versionado por ser só material de referência pra escrever a página, não
  o arquivo servido). Um botão logo abaixo do header ("Acessar as
  ferramentas do treinamento") leva pra `ferramentas.html` — é o ponto de
  entrada do site (`GET /`), sem lógica de formulário nem `<script>`.
  Texto corrido sempre alinhado à esquerda (mais legível em parágrafo de
  várias linhas) — só a identidade no topo (foto/nome/cargo) é centralizada,
  cada elemento com seu próprio `text-align:center`, sem depender de um
  `text-align:center` herdado do bloco pai com exceção pro parágrafo
  (armadilha de antes: o `.lead` tinha que forçar `text-align:left` pra
  não seguir o centro do container).
- `ferramentas.html` — o menu com as duas dinâmicas + QR code pra
  compartilhar com o time (era o `index.html` antes da landing page
  entrar; só mudou de nome/rota, conteúdo idêntico).
- `calculadora.html` — "Qual é a sua meta comercial?", grava respostas em
  `POST /api/metas` (tabela `metas`).
- `disc.html` — avaliação DISC, grava respostas em `POST /api/disc` (tabela
  `disc_respostas`).
- `meu-porque.html` — dinâmica simples de reflexão, 4 perguntas abertas
  (objetivo, sonho, mudança, visão de futuro), sem cálculo/perfil nenhum —
  grava em `POST /api/meu-porque` (tabela `meu_porque_respostas`). Veio de
  um pedido direto (`nova dinamica simples.md` na raiz do repo, não
  versionado — mesma convenção de material de referência de
  `politica_comercial.docx`/`texto_auxiliar.md`), com 2 decisões explícitas
  do usuário: sem cadastro unificado com as outras 2 ferramentas (identidade
  própria — nome/empresa de novo, mesmo padrão de sempre) e **com** relatório
  em PDF (`POST /api/meu-porque/pdf`, `src/reports/meuPorqueReport.js`,
  nome do arquivo `${participante} meu porque.pdf` — mesma convenção D-13
  das outras 2). Tem "Salvar PDF" ao lado de "Enviar minhas respostas", os 2
  reaproveitando a mesma validação (nome + as 4 perguntas respondidas).
- `admin.html` — painel autenticado (`x-admin-token` / `?token=`) para listar,
  exportar CSV e apagar registros das três tabelas.

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
- `src/reports/meuPorqueReport.js` — relatório do Meu Porquê (as 4
  perguntas com a resposta de cada uma, texto corrido, sem cálculo). `POST
  /api/meu-porque/pdf` (não grava no banco; mesmo payload de `POST
  /api/meu-porque`) é consumido pelo botão "Salvar PDF" em
  `meu-porque.html`. Nome do arquivo: `${nome do participante} meu
  porque.pdf`.

  **Nome do arquivo por participante nos três relatórios** (não por
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
  `src/discScoring.js` duplica `BLOCOS_A`/`INTENSIDADE_C` e as funções
  `calcNatural()`/`calcAdaptado()`/`calcIntensidade()` de `disc.html`
  (mesma ideia do `ARQUETIPO_MAP` duplicado em `discReport.js`) — se o
  conteúdo mudar em `disc.html`, espelhe a mudança aqui também. `POST
  /api/disc` e `POST /api/disc/pdf` recebem `respostas.{a,c}` (as respostas
  cruas por bloco/item — ver "A avaliação tem 2 partes" abaixo pro porquê
  de não ter mais `respostas.b`) e recalculam `d_natural`/`i_natural`/... e
  `perfil_dominante`/`arquetipo` inteiramente no servidor a partir disso —
  nunca confiam em nenhum escore pronto que o cliente mande (`disc.html`
  nem envia mais esses campos, ver `montarPayloadBase()`). Isso fecha o
  buraco de quem abria o console do navegador e fabricava um `d_natural`
  qualquer direto no POST, e evita persistir um resultado calculado por uma
  versão desatualizada/cacheada de `disc.html`. `INTENSIDADE_C` guarda só
  `{trait}` (sem o texto de exibição, que só existe em `disc.html`) porque
  a ordem dos traços é mecanicamente uniforme (D×3,I×3,S×3,C×3) — já
  `BLOCOS_A` guarda o `text` inteiro porque a ordem das palavras não é
  uniforme o bastante pra confiar sem poder auditar visualmente contra
  `disc.html`.

Em ambos os HTML, o download baixa o PDF via `fetch` + blob e lê o nome do
arquivo do header `Content-Disposition` da resposta — não usam mais
`window.print()`.

**A avaliação tem 2 partes, não 3.** Item 01 do reteste externo
(`reteste-e-plataforma-ideal.md`, ver CHANGELOG) foi implementado: a antiga
Parte B (16 situações de trabalho, escala 0..16) foi aposentada. Os 2
perfis (natural e adaptado) agora vêm das mesmas 28 marcações da Parte A —
`calcNatural()` conta quantas vezes cada traço foi escolhido como **Menos**
(o que exige menos esforço), `calcAdaptado()` conta quantas vezes cada
traço foi escolhido como **Mais** (o que aparece quando o ambiente pede
diferente). Os 2 são contagens sem sinal, 0 a 28, **mesma escala** — ao
contrário do modelo antigo (natural -28..+28 combinando Mais(+1)/Menos(-1)
num único escore; adaptado 0..16 de um instrumento separado), que é
exatamente o que produzia o N-06 (réguas incompatíveis, ver abaixo). A
"Parte B" que sobrou na UI é a intensidade — internamente ainda é chamada
de "Parte C" nas variáveis/funções (`INTENSIDADE_C`, `respostasC`,
`calcIntensidade`, `#intensityC`) por convenção histórica do instrumento;
não é um bug, é só uma discrepância de nome entre código e UI.

**Parte A tem 2 rodadas pelos mesmos 28 blocos — Rodada 1 (Mais) primeiro,
Rodada 2 (Menos) só depois de terminar a Rodada 1.** Passou por três
formatos antes deste: 1) `<input type="checkbox">` permitindo marcar
várias palavras por grupo (quebrava a propriedade **ipsativa** — a soma dos
4 traços deixava de ser constante entre pessoas, invalidando qualquer
comparação de perfis — corrigido pelo N-05 do reteste); 2) `<input
type="radio">` com os 2 grupos (Mais/Menos) simultâneos lado a lado no
mesmo bloco — tecnicamente correto, mas testadores relatavam confusão e
ainda dava pra marcar a mesma frase nos 2 grupos (resolvido na época com
sorteio automático); 3) 2 passos sequenciais dentro do MESMO bloco ("1.
Mais" em cima, "2. Menos" embaixo) — ainda confundia, segundo relato do
usuário depois de testar. O formato atual separa os 2 passos em **rodadas
inteiras**, não mais dentro do bloco: `#blocksAMais` (28 blocos, só
pergunta Mais) e `#blocksAMenos` (28 blocos, só pergunta Menos) são 2
listas/árvores de DOM diferentes, só uma visível por vez
(`mostrarFaseA('mais' | 'menos')`, estado em `state.faseA`, persistido no
`disc_state`). `#blocksAMenos` só é construído (`renderBlocosMenos()`)
quando a Rodada 2 é aberta — nunca antes — e sempre reconstruído nesse
momento, refletindo qualquer mudança feita na Rodada 1 desde a última vez
(voltar pra Rodada 1 e trocar uma resposta invalida a Menos daquele bloco
específico, ver `updateBlocoMais`). Na Rodada 2, a opção igual à escolhida
como Mais vem com `disabled` + tag "Já é sua Mais" — impossível marcar a
mesma frase nas 2 rodadas **por construção**, sem precisar de alerta nem
correção depois do fato. Cada opção é um `<label class="choice-card">` que
já embrulha o radio + o texto da frase (nome acessível vem do próprio
conteúdo do label — não precisa de `aria-labelledby`, que só era necessário
no formato 2, quando o texto ficava fora do `<label>`, compartilhado entre
2 radios). Um bloco conta como respondido (`blocoARespondido(bIdx)` =
`avaliarBlocoMais(bIdx) && avaliarBlocoMenos(bIdx)`) quando tem Mais **e**
Menos definidos e diferentes — `avaliarBlocoMenos` rejeita `menos ===
mais` como rede de segurança pra um `disc_state` salvo antes dessa correção
existir (na prática impossível de criar via UI, já que a opção fica
desabilitada; se acontecer, o bloco só fica pendente até a pessoa escolher
de novo, sem nenhuma mensagem especial de "conflito").

**Não reintroduza múltipla escolha na Parte A sem entender a implicação
psicométrica** (ver seção 04 do documento de reteste) — o instrumento
clássico depende do total ser constante entre respondentes pra ser
comparável.

Cada bloco tem 1 alerta inline (`.pending-msg`, classe `.pending` no
`<fieldset>`, cor `--warning`) por rodada — falta responder aquele bloco na
rodada atual. 2 `Set`s em memória (`blocosAlertaVisivelMais`/`...Menos`,
não vão pro `localStorage`, um por rodada porque são 2 árvores de DOM
diferentes) controlam quando cada alerta pode aparecer — assim que o
participante mexe naquele bloco, ou em todos os blocos pendentes de uma vez
quando clica "Continuar" sem terminar a rodada (mesmo os nunca tocados) —
pra não mostrar "pendente" nos 28 blocos de cara, antes de qualquer
interação. **Cuidado com `[hidden]`:** `.blocks-list`/`.nav-actions`
declaram `display: flex`, que sempre vence a folha de estilo do navegador
(que é quem aplica `display:none` a `[hidden]`) — sem a regra `[hidden] {
display: none !important; }` no topo de `disc.css`, alternar rodada via JS
(`hidden = true`) não escondia nada visualmente, só passou despercebido nos
testes porque jsdom não renderiza CSS de verdade (só foi pego testando num
Chromium real). Qualquer elemento novo que use `hidden` deve continuar
confiando nessa regra — não declare `display` direto num seletor que
também possa ficar `hidden`, ou garanta que o `!important` global cobre.

**Responsivo (mobile, `@media max-width:600px`):** `.choice-cards` vira 1
coluna (não 2, como no desktop) e `.choice-card` ganha `flex-wrap: wrap`
com `.choice-card-tag` em `flex-basis: 100%` — sem isso a tag "Já é sua
Mais" (Rodada 2) não cabia ao lado do texto da frase num card de 2 colunas
estreito, ficando cortada/fora do enquadramento (relatado por usuário
testando no celular). Qualquer novo texto auxiliar dentro de `.choice-card`
(tag, badge etc.) precisa do mesmo cuidado de quebra em telas estreitas.

**Compatibilidade do `disc_state` salvo:** sempre que o formato de
`respostasA`/`respostasC` mudar, `loadState()` precisa migrar o formato
antigo na leitura (ver `normalizarRespostasA`) — nunca assumir que o
`localStorage` de quem já estava com uma avaliação em andamento vai estar
no formato novo. `renderParteA()`/`renderParteB()` (intensidade) rodam em
sequência, sem try/catch, direto no topo do script; uma exceção em
qualquer uma trava as duas (nenhum bloco aparece). Já aconteceu duas vezes
com `respostasA[bIdx].mais`/`.menos` (valor único → array, no commit que
trocou pra `checkbox`; array → valor único de novo, no revert do N-05) —
nenhuma das duas vezes foi pega pelos testes existentes até então porque
nenhum simulava um `disc_state` no formato anterior. `normalizarRespostasA()`
sempre precisa saber ler o formato imediatamente anterior ao atual, não só
o "correto".

### Calculadora de meta comercial: números pt-BR

`parseBRNumber()` em `calculadora.html` segue a convenção pt-BR: `.` é
sempre separador de milhar, `,` é sempre separador decimal (ver F-01/F-02
no CHANGELOG — os campos eram `type="number"` antes, que quebrava com
qualquer separador). Isso significa que digitar um número **sem nenhum
separador** é lido como inteiro — "2000663" vira R$ 2.000.663,00, não
R$ 2.000,66. Um testador caiu nisso no campo ticket médio (linha 9): o
valor gigante gerado fez a conta de contratos/mês (linha 8 ÷ linha 9)
arredondar pra "0 contratos" sem nenhuma pista do porquê. O mesmo risco
existe em qualquer campo em reais, não só no ticket.

**Não colocamos teto/validação de valor em nenhum campo em reais de
propósito** — decisão do usuário: o valor real (faturamento, ticket médio,
meta de hunter) varia demais entre empresas clientes pra travar um limite
(uma empresa pode legitimamente ter ticket de R$ 100.000). Em vez disso,
`atualizarPreviewMoeda(id)` (chamada pra cada campo em
`CAMPOS_PREVIEW_MOEDA = ['faturamento', 'ticket', 'hunterValor']`) mostra
ao vivo, abaixo do campo (`#<id>-preview`, `.field-preview` no CSS), o
valor que o sistema está lendo (`= R$ 2.000.663,00`) — pra quem esqueceu a
vírgula perceber na hora e se corrigir sozinho, sem bloquear ninguém com
valor alto de verdade. Chamada no `input` de cada um desses 3 campos
(`CAMPOS_PREVIEW_MOEDA.includes(id)` no listener genérico), na carga
inicial via `atualizarPreviewsMoeda()` (depois de `loadState()`, que
popula os campos direto, sem passar pelo listener) e no reset do
formulário (mesma razão). Se um novo campo em reais for adicionado, inclua
o `id` em `CAMPOS_PREVIEW_MOEDA` e o `<p class="field-preview"
id="<id>-preview">` no HTML — não tem efeito automático, tem que declarar
os dois lados. Não inclui a tabela de equipe (`t-meta-<idx>`, meta mensal
por pessoa) — layout de tabela compacta, sem espaço óbvio pra um preview
por linha; reavaliar se isso também virar uma fonte de confusão relatada.

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

### Robustez pra >2k participantes simultâneos — dívida reconhecida, não mais adiada

Práticas de DevOpsSec não foram levadas em conta desde o início do projeto —
deveriam ter sido. Chegamos perto da entrega e o sistema, do jeito que está
hoje, não aguenta os >2.000 participantes simultâneos de uma palestra ao
vivo. Isso passa a ser trabalho ativo, não mais "adiar pra depois":

- **SQLite não escala horizontalmente.** Um único arquivo num único disco
  montado (ver acima) não pode ser compartilhado entre múltiplas instâncias
  do Render — hoje só dá pra escalar verticalmente (uma instância maior),
  não adicionando instâncias. Migrar pra Postgres (ver acima) é o que
  desbloqueia isso, mas é uma decisão que exige pedido explícito por
  reescrever a camada de banco inteira.
- **Um único processo Node, sem cluster** (`src/server.js`, `require.main
  === module` chama `app.listen` direto) — não usa todos os núcleos da
  instância.
- **Geração de PDF é síncrona/bloqueante dentro do handler da requisição**
  (`pdfkit` em `src/reports/*.js`) — uma rajada de downloads de PDF
  simultâneos trava o event loop pra todo mundo, não só quem pediu o PDF.
  Perfil natural igual bug encontrado no reteste (falta serializado versus
  paralelo) — considerar fila/worker se o volume de PDFs simultâneos for
  alto.
- **`render.yaml` roda 1 instância `starter`** — sem plano de múltiplas
  instâncias nem load balancer configurado.
- **Sem rate limiting** em nenhuma rota — nada impede uma rajada de
  requisições (intencional ou não) de derrubar a única instância.
- **Nenhum teste de carga real foi rodado** — os números acima são
  diagnóstico por leitura de código, não medição. Antes de prometer
  suporte a 2k pessoas, rodar uma carga sintética de verdade (ex.: `k6`,
  `autocannon`) contra uma cópia de staging.
- **Sem monitoramento/alerta** — hoje não há visibilidade de erro/latência
  em produção além dos logs do Render.

Qualquer mudança de UX/instrumento (DISC ou calculadora) deve ser avaliada
também por este ângulo antes de implementar — não só "melhora a
experiência", mas "o que isso muda pra 2k pessoas preenchendo ao mesmo
tempo".

## Backlog: features novas (não são bugs)

A seção "05 — Como seria a plataforma" de `reteste-e-plataforma-ideal.md`
(documento de reteste externo, não versionado — ver convenção de prefixo `_`
abaixo, embora este não tenha o prefixo por não ter sido pedido) lista 8
ideias de evolução da plataforma. O item 02 (escolha forçada com radio
agrupado) já foi entregue — era o N-05, ver CHANGELOG. O item 01 (aposentar
a Parte B, derivando os 2 perfis das mesmas 28 marcações da Parte A)
também já foi entregue — tinha sido avaliado e descartado antes, mas
voltou a ser discutido e implementado por pedido explícito do usuário
(relatos de confusão de testadores na Parte A) — ver a seção "A avaliação
tem 2 partes, não 3" acima e o CHANGELOG. Os 6 restantes são **features
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
6. **Um cadastro, um participante, três ferramentas** (item 06) — hoje
   nome/empresa são digitados de novo em cada ferramenta (calculadora, DISC
   e agora também Meu Porquê), cada uma com seu `localStorage` e PDF
   separados — decisão explícita ao criar o Meu Porquê, não um esquecimento.
   Precisa de um identificador compartilhado entre as três ferramentas e um
   relatório combinado novo — maior que os itens acima, mexe na identidade
   de dados das três tabelas.

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
  "Refazer avaliação".
- `tests/meu-porque.client.test.js` — mesma ideia pra `meu-porque.html`:
  validação (nome + as 4 perguntas antes de "Enviar" ou "Salvar PDF",
  mesma função de validação nos 2 botões) e persistência local.
  Os três arquivos de teste client-side usam um `VirtualConsole` próprio
  (sem `.sendTo(console)`) pra suprimir o aviso "Not implemented" que o
  `window.scrollTo`/`scrollIntoView` do jsdom imprime a cada chamada — isso
  não esconde erro de verdade: uma exceção real lançada dentro de um
  handler ainda propaga pro teste normalmente.

## Convenção: prefixo `_` = não versionar

Qualquer arquivo ou diretório cujo nome comece com `_` é conteúdo local do
usuário (capturas de tela, PDFs de exemplo, rascunhos etc.) e **nunca deve
subir ao git**. Isso é reforçado pela regra `_*` no `.gitignore` — não
remova essa regra, e não force `git add` sobre algo com esse prefixo.

Da mesma forma, **nenhum `*.pdf` sobe ao git** (regra própria no
`.gitignore`, independente do prefixo `_`) — são sempre relatórios
gerados/baixados localmente, nunca artefatos de código.

**Material de referência solto na raiz do repo, sem prefixo `_`, não
coberto pelo `.gitignore` — mas nunca versionado, por convenção manual.**
São documentos/imagens que o usuário larga na raiz pra eu ler e usar de
base (pedido de feature, texto pra adaptar, imagem pra incluir numa
página), não código nem conteúdo final do site. Exemplos já vistos:
`politica_comercial.docx`, `texto_auxiliar.md`, `plataforma.jpeg`,
`reteste-e-plataforma-ideal.md`, os `auditoria*.md`, `nova dinamica
simples.md`, e os `qrcode-*.png` gerados ad-hoc. Antes de `git add`, sempre
confira `git status` e não inclua nada assim — só a cópia final (quando
existe uma, ex.: `public/politica-comercial-tatica.docx`,
`public/img/plataforma.jpeg`) é que vai pro repo.

## Convenções de código

- Sem framework de build/transpile: os HTML em `public/` são estáticos, com
  JS inline em `<script>` no fim do arquivo (sem módulos, sem bundler).
- Todo texto voltado ao usuário (labels, mensagens de erro, commits) é em
  português.
- Variáveis de ambiente: `PORT`, `ADMIN_TOKEN`, `DB_PATH` (ver `.env.example`).
- Antes de mudanças em `src/server.js`, rode `npm test`.
