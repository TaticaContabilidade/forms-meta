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

### Relatório em PDF da meta comercial

`src/reports/metaComercialReport.js` monta, com `pdfkit`, o relatório em PDF
da calculadora — um documento formatado (cards, tabelas, callouts), não um
"print" da página HTML. É consumido por `POST /api/metas/pdf` (não grava no
banco; recebe o mesmo payload de `POST /api/metas`) e pelo botão "Salvar meu
resultado (PDF)" em `calculadora.html`, que baixa o arquivo via `fetch` +
blob. O nome do arquivo segue sempre o padrão `${empresa} meta comercial.pdf`
(`metaComercialFilename()`, com sanitização de caracteres inválidos).

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
