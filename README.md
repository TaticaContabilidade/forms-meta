# Calculadora de Meta Comercial — com backend

Backend em Node.js (Express) + banco SQLite (`better-sqlite3`) que recebe as
respostas da calculadora e guarda tudo num arquivo `db/metas.db`. Inclui um
painel `/admin.html` para ver e exportar (CSV) as metas de todo mundo.

## Rodar na sua máquina

```bash
npm install
npm start
```

Abre em `http://localhost:3000`. O painel admin fica em
`http://localhost:3000/admin.html`.

**Token de admin:** por padrão é `troque-isto`. Mude isso antes de usar de
verdade — veja "Variáveis de ambiente" abaixo.

## Estrutura

```
meta-backend/
  src/
    server.js          -> servidor Express + rotas da API
  package.json
  public/
    index.html        -> a calculadora (o que os 240 participantes acessam)
    admin.html         -> painel para você ver/exportar as respostas
    style/
      index.css        -> estilos da calculadora
      admin.css        -> estilos do painel admin
  db/
    metas.db           -> criado automaticamente na primeira execução
```

## Rotas da API

| Rota | Método | Uso |
|---|---|---|
| `/api/metas` | `POST` | a calculadora envia a meta preenchida |
| `/api/metas` | `GET` | lista tudo — precisa do header `x-admin-token` |
| `/api/metas.csv` | `GET` | exporta CSV — `x-admin-token` ou `?token=` |
| `/api/metas/:id` | `DELETE` | remove um registro — precisa do token |

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
  treinamento**, não deixe pra depois.
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
5. Deploy. Você recebe um link tipo `https://sua-calculadora.onrender.com` —
   é esse link que vai para as 240 pessoas.
6. Depois do treinamento, acesse `/admin.html` no mesmo domínio, entre com o
   token, e clique em "Exportar CSV" para guardar tudo numa planilha.

## Backup dos dados

O arquivo `db/metas.db` é um banco SQLite comum — dá pra abrir com o
[DB Browser for SQLite](https://sqlitebrowser.org/) (grátis) se quiser olhar
os dados fora do painel admin, ou simplesmente usar o botão "Exportar CSV".
