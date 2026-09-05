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
  `calculadora.html`. Nome do arquivo: `${empresa} meta comercial.pdf`.
- `src/reports/discReport.js` — relatório da avaliação DISC (arquétipo,
  barras de perfil natural/adaptado/intensidade, os 4 perfis, insights de
  performance). Repete localmente o `ARQUETIPO_MAP` de `disc.html` porque o
  relatório é gerado no servidor e não deve depender do texto que o cliente
  mandou. `POST /api/disc/pdf` (não grava no banco; mesmo payload de
  `POST /api/disc`) é consumido pelo botão "Salvar PDF" em `disc.html`. Nome
  do arquivo: `${nome do participante} perfil disc.pdf` (não usa `empresa` —
  diferente do relatório de meta comercial).

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

## Fluxo de commit

Sempre que o usuário pedir para commitar (ex.: "comita", "pode commitar",
"suba isso"), siga esta sequência, nesta ordem:

1. **Rodar os testes**, se existirem (`npm test`) — não commitar com teste
   quebrado. Se não houver testes cobrindo a mudança, siga em frente.
2. **Criar commits atômicos** — um commit por mudança logicamente coesa (não
   misture, por exemplo, uma feature nova com um refactor não relacionado).
   Nunca incluir `*.pdf` nem arquivos/diretórios com prefixo `_` (ver
   convenção abaixo) — confira `git status` antes de `git add`.
3. **Mergiar com a `main`** — se o trabalho estiver numa branch separada,
   faça `git checkout main && git merge <branch>` (fast-forward quando
   possível) antes do passo seguinte. Se já estiver na `main`, este passo é
   automático (nada a fazer).
4. **Atualizar o remoto** — `git push origin main`.

## Rodar e testar

```bash
npm install
npm start          # sobe em http://localhost:3000
npm test           # node --test — roda tests/*.test.js
```

Os testes usam o runner nativo do Node (`node --test`) + `supertest`. Cada
execução aponta `DB_PATH` para um SQLite temporário em `os.tmpdir()` e limpa
o arquivo no `after()` — nunca escrevem em `db/metas.db`.

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
