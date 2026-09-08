# Practice to Create — Calculadora de Meta + Avaliação DISC

Backend em Node.js (Express) + banco SQLite (`better-sqlite3`) para duas
dinâmicas de treinamento comercial:

- **Calculadora de meta comercial** (`calculadora.html`) — transforma o
  faturamento desejado em meta mensal, número de contratos e volume de
  contatos necessários, e distribui a meta entre a equipe.
- **Avaliação DISC Profunda** (`disc.html`) — 56 perguntas em 3 partes que
  revelam o perfil natural, o comportamento sob pressão e a intensidade de
  cada traço (D/I/S/C).

`index.html` é a landing page institucional (a história da Tática, contada
pela fundadora Priscila Galindo). O menu com as duas dinâmicas, QR code e
link para compartilhar com o time é `ferramentas.html` (o botão "Acessar as
ferramentas do treinamento" logo no topo do `index.html` leva pra lá).
Inclui um painel `/admin.html` para ver e exportar (CSV) as respostas de
ambas.

Ambas as dinâmicas geram um **relatório em PDF de verdade** (não é print da
página) — veja `CLAUDE.md` para os detalhes de arquitetura.

## Rodar na sua máquina

```bash
npm install
npm start
```

Abre em `http://localhost:3000`. O painel admin fica em
`http://localhost:3000/admin.html`.

**Token de admin:** por padrão é `troque-isto`. Mude isso antes de usar de
verdade — veja "Variáveis de ambiente" abaixo.

## Testes

```bash
npm test
```

Roda com o test runner nativo do Node (`node --test`):

- `tests/server.test.js` — API do backend (`supertest`), incluindo geração
  dos PDFs.
- `tests/calculadora.client.test.js` — lógica client-side da calculadora
  num DOM real (`jsdom`): parsing de números no formato pt-BR, validação
  antes do envio, regras da tabela de equipe e persistência local.
- `tests/disc.client.test.js` — lógica client-side da avaliação DISC num
  DOM real (`jsdom`): escolha forçada (radio) na Parte A, foco/marcação,
  modulação do laudo pela intensidade, persistência de nome/empresa.

## Estrutura

```
forms-meta/
  src/
    server.js               -> servidor Express + rotas da API
    reports/
      pdfLayout.js           -> base compartilhada dos relatórios em PDF
      metaComercialReport.js -> relatório da calculadora de meta
      discReport.js          -> relatório da avaliação DISC
  tests/
    server.test.js           -> testes de API (node --test + supertest)
    calculadora.client.test.js -> testes de UI da calculadora (jsdom)
    disc.client.test.js       -> testes de UI da avaliação DISC (jsdom)
  public/
    index.html               -> landing page institucional (a história da Tática)
    ferramentas.html          -> menu com as duas dinâmicas + QR code
    calculadora.html          -> calculadora de meta comercial
    disc.html                 -> avaliação DISC
    admin.html                 -> painel para ver/exportar as respostas
    style/
      index.css               -> estilos do menu (ferramentas.html) e da calculadora
      disc.css                -> estilos da avaliação DISC
      admin.css                -> estilos do painel admin
  db/
    metas.db                  -> criado automaticamente na primeira execução
  CLAUDE.md                   -> convenções do repositório (leia antes de mexer)
```

## Rotas da API

| Rota | Método | Uso |
|---|---|---|
| `/api/metas` | `POST` | a calculadora envia a meta preenchida |
| `/api/metas` | `GET` | lista tudo — precisa do header `x-admin-token` |
| `/api/metas.csv` | `GET` | exporta CSV — `x-admin-token` ou `?token=` |
| `/api/metas/:id` | `DELETE` | remove um registro — precisa do token |
| `/api/metas/pdf` | `POST` | gera o relatório em PDF da meta (não grava no banco) |
| `/api/disc` | `POST` | a avaliação DISC envia o perfil calculado |
| `/api/disc` | `GET` | lista tudo — precisa do header `x-admin-token` |
| `/api/disc.csv` | `GET` | exporta CSV — `x-admin-token` ou `?token=` |
| `/api/disc/:id` | `DELETE` | remove um registro — precisa do token |
| `/api/disc/pdf` | `POST` | gera o relatório em PDF do perfil DISC (não grava no banco) |
| `/api/qr` | `GET` | PNG do QR code (`?url=`, senão aponta pro próprio host) |
| `/api/qr/download` | `GET` | mesmo QR code, forçando download |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | porta do servidor |
| `ADMIN_TOKEN` | `troque-isto` | senha simples para ver/exportar os dados |
| `DB_PATH` | `./db/metas.db` | onde o SQLite grava |

Exemplo:

```bash
ADMIN_TOKEN="uma-senha-forte" PORT=3000 npm start
```

## Colocar no ar (grátis) antes do treinamento

Como agora tem um servidor Node de verdade (não é mais um HTML solto), não dá
pra usar Netlify/GitHub Pages — esses só servem arquivo estático. Precisa de
um serviço que rode Node continuamente. Opções gratuitas e rápidas:

- **Render.com** (free web service): conecta o repositório do GitHub, ele
  detecta o `npm start` sozinho. **Atenção:** no plano free o disco é
  temporário — se o serviço reiniciar ou "dormir" por inatividade, o
  `metas.db` pode ser resetado. Pra um evento ao vivo de algumas horas isso
  normalmente não chega a acontecer, mas exporte o CSV **logo depois do
  treinamento**, não deixe pra depois. Se quiser persistência de verdade,
  precisa de um plano pago com Persistent Disk anexado (o free não suporta).
- **Railway.app**: também sobe direto do GitHub, tem uma cota grátis mensal
  pequena — dá pra testar e rodar o evento.
- **Fly.io**: free tier permite anexar um volume persistente de verdade, é a
  opção mais segura se quiser manter os dados por mais tempo, mas exige um
  pouco mais de configuração (`fly volumes create`).

**Passo a passo mais simples (Render):**
1. Suba esta pasta num repositório no GitHub.
2. Em render.com → New → Web Service → conecte o repositório.
3. Build command: `npm install`. Start command: `npm start`.
4. Em "Environment", adicione `ADMIN_TOKEN` com uma senha sua.
5. Deploy. Você recebe um link tipo `https://sua-calculadora.onrender.com`.
6. O link que vai para o time **antes** da mentoria é o `/disc.html` desse
   domínio — a calculadora de metas é feita ao vivo, com o facilitador,
   durante o encontro (ver a seção "QR code" em `ferramentas.html`).
7. Depois do treinamento, acesse `/admin.html` no mesmo domínio, entre com o
   token, e clique em "Exportar CSV" para guardar tudo numa planilha.

## Backup dos dados

O arquivo `db/metas.db` é um banco SQLite comum — dá pra abrir com o
[DB Browser for SQLite](https://sqlitebrowser.org/) (grátis) se quiser olhar
os dados fora do painel admin, ou simplesmente usar o botão "Exportar CSV".
