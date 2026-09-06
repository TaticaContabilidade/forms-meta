# CLAUDE.md

Orientações para trabalhar neste repositório (`forms-meta`).

## O que é o projeto

Backend Node.js (Express 5 + `better-sqlite3`) que serve duas ferramentas de
treinamento comercial em `public/`:

- `calculadora.html` — "Qual é a sua meta comercial?", grava respostas em
  `POST /api/metas` (tabela `metas`).
- `disc.html` — avaliação DISC, grava respostas em `POST /api/disc` (tabela
  `disc_respostas`).
- `admin.html` — painel autenticado (`x-admin-token` / `?token=`) para listar,
  exportar CSV e apagar registros de ambas as tabelas.

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
  salvos no banco todos refletem os dois traços, nunca um só. `POST
  /api/disc` e `generateDiscPdf` sempre recalculam a partir dos escores
  brutos (`d_natural`, `i_natural`, ...) — nunca confiam num
  `perfil_dominante`/`arquetipo` que o cliente mandou, para não persistir um
  resultado calculado por uma versão desatualizada/cacheada do `disc.html`.

Em ambos os HTML, o download baixa o PDF via `fetch` + blob e lê o nome do
arquivo do header `Content-Disposition` da resposta — não usam mais
`window.print()`.

**Parte A permite marcar mais de uma palavra por grupo.** Cada bloco tem 2
grupos de escolha (Mais/Menos), cada um com `<input type="checkbox">` (não
`radio` — Partes B e C continuam `radio`, são escolha única). Um bloco só
conta como respondido (`blocoARespondido(r)` em `disc.html`) quando há pelo
menos 1 palavra marcada em cada grupo **e** nenhuma palavra está marcada nos
2 grupos ao mesmo tempo (isso continua bloqueado como conflito). `calcNatural()`
soma/subtrai o traço de **cada** palavra marcada, não só da 1ª — se 2 palavras
forem marcadas como Mais no mesmo bloco, as 2 pontuam.

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
  arquivo) pra chegar na tela de resultado e testar arquétipo, comparação
  natural×adaptado, modulação por intensidade, persistência de nome/empresa
  e a confirmação inline do "Refazer avaliação". Os dois arquivos de teste
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
