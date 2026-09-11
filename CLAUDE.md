# CLAUDE.md

Orientações para trabalhar neste repositório (`forms-meta`).

## O que é o projeto

Backend Node.js (Express 5 + PostgreSQL via `pg`) que serve três ferramentas
de treinamento comercial em `public/`:

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
  exportar CSV e apagar registros das três tabelas, além de uma 4ª aba
  ("Líderes por Empresa") pra cadastrar quem recebe notificação por e-mail
  quando um colaborador daquela empresa preenche o DISC (ver seção
  "Notificação de líderes por e-mail" abaixo). Sem link público em nenhuma
  página — acessível só por quem souber a URL direto.

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

### Notificação de líderes por e-mail (DISC)

Quando um colaborador envia o DISC (`POST /api/disc`), o servidor busca na
tabela `lideres_empresa` (ver `src/db.js`) todos os líderes cadastrados
com a mesma `empresa` (comparação de texto exata — grafias diferentes não
casam, ver aviso na própria aba do admin) e manda um e-mail pra cada um
com o PDF do perfil DISC anexado (`src/notifications/discNotifier.js`,
reaproveita o mesmo `generatePdfAsync('disc', data)`/`discFilename()` das
outras rotas de PDF). Pedido explícito do usuário: os "participantes" que
recebem a notificação não são colegas do colaborador, são os chefes/
líderes técnicos responsáveis por decidir alocação de pessoas com base no
perfil.

`notificarLideresDisc(row)` é chamado **sem `await`** logo depois de
responder ao participante (`res.status(201).json(...)` primeiro, depois a
chamada) — a submissão do colaborador nunca deve demorar nem falhar por
causa de um problema de e-mail/SMTP. Erros de envio (SMTP fora do ar,
credencial errada, etc.) só são logados, nunca propagados pro participante.

**Cadastro de líderes é uma aba nova dentro do `/admin.html` já
existente** (`Líderes por Empresa`), protegida pelo mesmo `x-admin-token`
que já protege as outras 3 abas — decisão explícita do usuário depois de
cogitar um sistema de login separado (usuário/senha) e achar trabalhoso
demais pro que era necessário. Não crie um sistema de autenticação novo
pra essa aba sem pedido explícito de novo.

**SMTP é opcional, ao contrário de `DATABASE_URL`.** `src/email.js`
não lança erro nenhum se `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` não
estiverem configurados — só loga um aviso (1 vez só, não a cada
tentativa) e a notificação fica desligada; o resto do app (metas, disc,
meu-porque, PDFs) continua funcionando normalmente. Ver `.env.example`
pros valores esperados (testado com Gmail/Google Workspace — precisa de
uma "senha de app" gerada em `myaccount.google.com/apppasswords`, não a
senha normal da conta, porque contas com 2FA não aceitam autenticação
SMTP básica).

**`/admin.html` não tem mais link público.** Ele era linkado no rodapé de
`ferramentas.html` ("Painel do facilitador") — removido por pedido
explícito do usuário (a página é só pra uso interno da Tática, não deveria
estar visível/clicável por participantes). O painel continua acessível
direto pela URL — não é bloqueio de acesso, só deixou de ser descoberto
por quem só navega pelo site.

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

### Campo de e-mail nas 3 ferramentas

`nome_participante`/`empresa` ganharam um 3º campo de identidade,
`email`, nas três ferramentas (calculadora, DISC, Meu Porquê) — pedido
explícito do usuário. **Obrigatório em todo lugar onde `nome` já é
obrigatório, opcional onde `nome` não é** (mesma decisão explícita do
usuário: "obrigatório, como o nome") — como o "obrigatório" de `nome`
já era inconsistente entre ferramenta e botão antes desta mudança, o
e-mail segue exatamente essa mesma inconsistência por arquivo, não um
padrão novo e uniforme:

- `calculadora.html`/`disc.html`: obrigatório pro botão "Enviar"
  (bloqueia com foco + mensagem, igual a `nome`), **não** obrigatório
  pro "Salvar PDF" (mesmo padrão que `nome` já tinha aí — o PDF nunca
  exigiu identidade completa, só os campos de cálculo/respostas).
- `meu-porque.html`: obrigatório pros 2 botões — `validarEMontarPayload()`
  já validava `nome` pros 2 (`Enviar` e `Salvar PDF` reaproveitam a mesma
  função), então `email` entra na mesma validação compartilhada.

Persistido no `localStorage` junto com nome/empresa (mesmo padrão de
sempre) em todas as 3. Coluna `email TEXT` nas 3 tabelas (`metas`,
`disc_respostas`, `meu_porque_respostas`) — adicionada via `ALTER TABLE
... ADD COLUMN IF NOT EXISTS` em `src/db.js` além do `CREATE TABLE`
(mesmo motivo de `notificado_em`: as tabelas já existiam em produção,
`CREATE TABLE IF NOT EXISTS` sozinho não adicionaria a coluna nova).
Exigido com `400` no servidor nas 3 rotas `POST` principais (nunca nas
rotas `/pdf`, que não exigem `nome` também) — **nunca confie só na
validação client-side pra campo obrigatório**, sempre espelhe no
servidor. Aparece como coluna nova em `admin.html` (as 3 tabelas) e nos
3 CSVs exportados.

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

Banco de dados: **PostgreSQL gerenciado**, não mais SQLite — migração pedida
explicitamente pelo usuário ("comece a migrar", depois de perguntar "qual a
melhora de migrar o banco para o postgres?"). `src/db.js` exporta `{ pool,
ready }`: `pool` é um `pg.Pool` configurado a partir de `DATABASE_URL`
(obrigatório — o processo lança um erro no `require()` se não estiver
definida, sem fallback silencioso pra um caminho local, mesma filosofia de
"falhar alto" do diagnóstico de boot que existia antes pro SQLite); `ready`
é a promise que resolve quando as 3 `CREATE TABLE IF NOT EXISTS` já
rodaram. `src/server.js` só chama `app.listen` depois de `await ready` (ver
o bloco `if (require.main === module)` no fim do arquivo) — assim uma
requisição não pode chegar antes da 1ª tabela existir de verdade.

SSL é ligado automaticamente (`rejectUnauthorized: false`) só quando o host
da connection string bate com `.render.com` — a "Internal Database URL" do
Render (mesma região, rede interna) não precisa; uma connection string local
(Docker, `localhost`) também não.

**Infra do Render operada manualmente pelo dashboard, sem `render.yaml`.**
Chegou a existir um `render.yaml` com bloco `databases:` (Blueprint) pra
provisionar o Postgres junto com o serviço web — removido por decisão do
usuário depois de 2 armadilhas na prática (ver CHANGELOG, entrada
"render.yaml removido"): (1) o usuário já tinha um Postgres criado
manualmente antes, e o Blueprint criou um segundo banco separado, quase
gerando cobrança duplicada — só percebido porque o manual ficava numa aba
diferente do dashboard ("Projects"); (2) o disco de cada banco vem com um
tamanho padrão vinculado ao *tier* do plano de computação escolhido (ex.:
`Basic` → 15GB por padrão), não ao volume de dados real — e o Render só
permite aumentar esse disco depois, nunca diminuir, então corrigir isso
exigiria recriar o banco do zero. Diante disso, `forms-meta-db` (Postgres)
e o serviço web `forms-meta` são geridos manualmente no dashboard: qualquer
mudança de plano, disco ou variável de ambiente é feita direto lá, não por
um arquivo versionado. Se um dia quiser voltar a usar Blueprint, releia
essa entrada do CHANGELOG antes — os dois problemas acima se repetem se o
banco/serviço já existirem fora do Blueprint.

Full cutover, sem suporte dual: `better-sqlite3` foi removido de
`package.json` (confirmado via `grep -rln "better-sqlite3"` que só
`src/server.js` o usava — nada mais dependia dele). Não reintroduza SQLite
como fallback nem mantenha os dois caminhos de código ao mesmo tempo —
contraria a convenção deste repositório de não manter shims de
retrocompatibilidade.

**Local:** suba um Postgres descartável via Docker (não precisa de sudo,
só estar no grupo `docker`). 5432 pode já estar ocupado por um Postgres do
próprio sistema — ajuste a porta se precisar (este repo usa 5434 pro
Postgres de desenvolvimento e 5433 pro de teste, ver
`tests/server.test.js`):

```bash
docker run -d --name forms-meta-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=forms_meta -p 5434:5432 postgres:16-alpine
```

e aponte `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/forms_meta`
no `.env` (ver `.env.example`).

**Alternativa: `docker compose up`** (`Dockerfile` + `docker-compose.yml`,
raiz do repo) sobe app + Postgres juntos, isolados dos containers manuais
acima — não precisa de `npm install` nem de Postgres na máquina, só Docker.
O serviço `db` não expõe porta pro host de propósito (evita colidir com
`forms-meta-pg`/`forms-meta-pg-test`) — o app fala com ele pelo nome do
serviço (`db`) dentro da rede do compose. Código montado por bind mount
(`volumes: .:/app`, com um volume anônimo à parte só pra `node_modules`,
pra não sobrescrever com o do host) e rodando com `node --watch` — editar
qualquer arquivo reinicia o processo sozinho, sem rebuildar a imagem.
`docker compose down` pra encerrar (`-v` também apaga o volume do banco).

Práticas de DevOpsSec não foram levadas em conta desde o início do projeto —
deveriam ter sido. Boa parte dos gargalos identificados já foi corrigida;
os que restam exigem uma decisão de infraestrutura/custo antes de mexer
(sinalizados abaixo) — não são mais "esquecidos", são adiados
conscientemente até esse pedido acontecer.

**Já corrigido:**

- **Rate limiting** (`express-rate-limit`, `src/server.js`) — limite geral
  de 120 req/min por IP em toda `/api/`, e um limite bem mais apertado (20
  req/min) só nas 3 rotas de PDF, que são as mais caras de CPU. `app.set
  ('trust proxy', 1)` precisa continuar ligado pro Render (proxy reverso)
  não fazer o limite valer pra todo mundo junto pelo IP do proxy em vez do
  IP de quem faz a requisição de verdade. `DISABLE_RATE_LIMIT=true`
  desliga os 2 limites — só pra rodar `scripts/loadtest.js` localmente
  (nunca em produção, ver `.env.example`).
- **Geração de PDF não bloqueia mais o event loop principal.**
  `src/reports/pdfWorker.js` + `pdfWorkerPool.js` — um pool fixo de
  `worker_threads` (`PDF_WORKER_POOL_SIZE`, padrão 2) gera os PDFs numa
  thread separada da que atende as requisições HTTP; as 3 rotas `/pdf`
  agora são `async` e usam `generatePdfAsync(tipo, data)` em vez de chamar
  `generate*Pdf(data).pipe(res)` direto. Medido localmente (ver "Teste de
  carga" abaixo): ~210 req/s sustentados nas 3 rotas de PDF juntas, sem
  travar as demais rotas.
- **Health check** — `GET /api/health` confirma processo de pé + banco
  respondendo (`SELECT 1`), pra monitoramento externo (uptime, health
  check automático do Render).
- **Log de requisição** (`morgan`, `src/server.js`) — método, rota,
  status, tempo de resposta, em toda requisição. Desligado quando
  `NODE_ENV=test` (ver `tests/server.test.js`) pra não poluir `npm test`.
- **Log de diagnóstico no boot do banco** — `src/db.js` loga host/porta/nome
  do banco assim que conecta e cria o schema (ou o erro, se a conexão/schema
  falhar), em vez de o servidor subir "quieto" sem deixar claro se está
  falando com o Postgres certo.
- **Cluster opcional** (`WEB_CONCURRENCY`, `src/server.js`, módulo nativo
  `cluster`) — desligado por padrão (`WEB_CONCURRENCY` ausente ou `1` =
  comportamento idêntico a antes, 1 processo só). O plano `starter` atual
  do Render tem CPU fracionária — ligar isso hoje não ajuda em nada (pode
  até piorar, por overhead de troca de contexto). Existe pronto pra
  quando/se o plano for atualizado pra ter mais de 1 núcleo de verdade.
  Cada worker forkado reexecuta o arquivo inteiro e abre seu próprio pool
  de conexões Postgres (`src/db.js`) — ao contrário do SQLite de antes,
  isso agora também escala entre *instâncias* separadas do Render, não só
  entre processos de uma mesma instância (ver o item abaixo).
- **Banco migrado de SQLite pra PostgreSQL gerenciado** — pedido explícito
  do usuário ("comece a migrar", ver "Deploy (Render) e persistência do
  banco" acima). Um único arquivo SQLite num único disco montado não podia
  ser compartilhado entre múltiplas instâncias do Render — só dava pra
  escalar verticalmente (uma instância maior), nunca somando instâncias.
  Isso é justamente o que desbloqueia somar instâncias atrás de um load
  balancer, se/quando isso for pedido (ver item logo abaixo, ainda
  pendente).
- **Teste de carga real rodado** (`scripts/loadtest.js`, usa `autocannon`
  como devDependency) — 3 rodadas (páginas estáticas, escrita simples,
  geração de PDF) contra uma URL alvo, imprime requisições/s e latência
  de verdade em vez de estimativa por leitura de código. Rodado
  localmente (não é o hardware do Render, então os números absolutos não
  transferem 1:1, mas a validação relativa vale): páginas estáticas ~3.150
  req/s, escrita simples ~2.415 req/s, as 3 rotas de PDF juntas ~212
  req/s — todos com 0 erros/timeouts em 50 conexões simultâneas por 10s.
  **Nome do arquivo sem hífen antes de "test" de propósito** — `node
  --test` descobre arquivo de teste sozinho por padrão de nome, e um dos
  padrões é `*-test.js`; "load-test.js" fazia o `npm test` rodar essa
  carga inteira (30s+, contra um servidor de verdade) como se fosse mais
  um teste unitário. Não renomeie de volta.
- **Build Command do serviço web usa `--omit=dev`** (configurado direto no
  dashboard do Render, não por `render.yaml` — ver "Deploy" acima):
  `npm install --omit=dev`. `jsdom`/`supertest`/`autocannon`
  (devDependencies) não precisam ir pro servidor de produção, só são
  usados por `npm test`/`npm run load-test`.

**Ainda pendente, decisão de infra/custo antes de mexer:**

- **O serviço web roda 1 instância `starter`** — sem plano de múltiplas
  instâncias nem load balancer configurado. Com o banco já em Postgres
  gerenciado, somar instâncias agora é só configuração (não exige mais
  reescrever a camada de banco) — mas ainda exige upgrade de plano (custo)
  e configurar o load balancer. Não faça sem pedido explícito.
- **Sem monitoramento/alerta externo** (Sentry, Datadog etc.) — o log de
  requisição (`morgan`) e o health check acima ajudam, mas não substituem
  um serviço de verdade com alerta ativo; exigiria conta/API key que não
  temos configurada.
- **Teste de carga só rodou local, nunca contra staging/produção** — os
  números acima validam a arquitetura (PDF não trava mais o resto), mas
  não equivalem à capacidade real do plano `starter` do Render. Rodar
  `scripts/loadtest.js` contra uma cópia de staging antes de prometer
  suporte a 2k pessoas de verdade.

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

Precisa de um Postgres rodando (local ou Docker — ver "Deploy (Render) e
persistência do banco" acima) e `DATABASE_URL` apontando pra ele:

```bash
npm install
npm start          # sobe em http://localhost:3000
npm test           # node --test — roda tests/*.test.js
```

Os testes usam o runner nativo do Node (`node --test`):

- `tests/server.test.js` — API (`supertest`). Usa `DATABASE_URL` (default:
  `postgresql://postgres:testpass@localhost:5433/forms_meta_test`, pensado
  pro container Docker de teste — respeita um `DATABASE_URL` já setado no
  ambiente, ex. rodando contra staging). Ao contrário do SQLite temporário
  de antes (1 arquivo novo por execução), o banco de teste é reaproveitado
  entre execuções — um `before()` roda `TRUNCATE ... RESTART IDENTITY
  CASCADE` nas 3 tabelas pra cada `npm test` partir do mesmo estado zerado,
  e o `after()` fecha o `pool` do Postgres além do pool de PDF.
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
- Variáveis de ambiente: `PORT`, `ADMIN_TOKEN`, `DATABASE_URL` (ver `.env.example`).
- Antes de mudanças em `src/server.js`, rode `npm test`.
