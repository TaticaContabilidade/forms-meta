# Migração Node/Express → Django REST + React

Backlog de acompanhamento da migração incremental (ver `CLAUDE.md`, seção
"Migração incremental: Django REST + React", para o desenho técnico
completo). Documento vivo — atualizar conforme o backlog avançar, não é
changelog (isso já existe em `CHANGELOG.md`).

**Modelo da migração**: Django (`backend/`) e React (`frontend/`) rodam ao
lado do Node/Express (`src/`, `public/`) — mesmo Postgres compartilhado —
até cada ferramenta ser migrada. Nada do Node é desligado até a
substituição correspondente estar validada em produção.

## ✅ Já feito

### Fundação (auth + infra)
- Custom user model `Usuario` (login por e-mail, papel `GERENTE`/
  `COLABORADOR`, FK pra `Empresa` e `Setor`) + JWT via
  `djangorestframework-simplejwt` (access 15min, refresh 7 dias com
  rotação/blacklist).
- Cadastro de colaborador self-service (escolhe empresa → setor,
  dropdown dependente); Gerente só criado via Django admin (evita
  escalonamento de privilégio).
- CORS (`django-cors-headers`) liberado pro frontend.
- `docker-compose.yml` com serviço `backend` novo, compartilhando o
  mesmo Postgres (`db`) que o `app` (Node) já usa.
- `backend/Dockerfile` roda `migrate` no **start do container** (não no
  build) — funciona sem precisar do Pre-Deploy Command pago do Render.
- `.gitignore` cobre `venv/`/`.venv/`/`__pycache__` sem engolir
  `__init__.py` por acidente.
- Backend deployado no Render como Web Service (Docker) — domínio
  `forms-meta-7lf6.onrender.com`, `ALLOWED_HOSTS` corrigido.

### Primeira ferramenta migrada: Meu Porquê
- `MeuPorqueResposta` aponta pra `meu_porque_respostas` (tabela
  existente, `managed=False` — o Node continua dono do DDL). Coluna
  `usuario_id` (FK) adicionada via migration `RunSQL` idempotente, sem
  conflitar com o `CREATE TABLE IF NOT EXISTS` do Node.
- Endpoints REST: criar (identidade vem do usuário logado, nunca do
  body), listar (colaborador só as próprias, gerente as do seu setor),
  PDF (WeasyPrint, mesmo layout do relatório do Node).
- Frontend: páginas Login, CadastroColaborador, Ferramentas (menu),
  MeuPorque — com refresh automático de JWT via interceptor Axios.

### Visual
- Design system do site (dark mode, Space Grotesk + DM Sans, paleta
  verde-lima/coral/âmbar) portado pro React — `frontend/src/index.css`
  compartilhado entre as páginas.
- Página de Ferramentas replicando o layout de `public/ferramentas.html`
  (hero, chips, grid de cards por dinâmica), protegida por
  `RequireAuth`. Calculadora e DISC aparecem como "Em breve" (ainda não
  migraram).

### Segunda ferramenta migrada: Calculadora de Meta Comercial
- `MetaComercial` aponta pra `metas` (tabela existente, `managed=False`,
  mesmo padrão do Meu Porquê). Coluna `usuario_id` (FK) adicionada via
  migration `RunSQL` idempotente.
- **Servidor recalcula tudo a partir dos campos brutos** (faturamento,
  crescimento_pct, churn_pct, ticket, conversao_pct, hunter_valor) — não
  confia em nenhum valor computado que o cliente mande (`meta_anual`,
  `meta_mensal`, etc.), mesmo princípio já aplicado ao DISC no Node.
  `backend/apps/metas/calculo.py` é uma função pura isolada, testável sem
  banco (9 testes unitários), reaproveitada pelo serializer e pelo PDF.
  **Mudança de comportamento em relação ao Node**: antes o servidor
  confiava cegamente nesses valores; agora não.
- **Login obrigatório** (como o Meu Porquê) — antes a Calculadora era
  anônima no Node, agora nome/empresa/email vêm do usuário autenticado.
- Equipe comercial (hunter/farmer) via serializer aninhado, linhas sem
  nome descartadas antes de salvar — mesma regra do Node.
- PDF (WeasyPrint): 3 stat cards, 2 seções de fatos, 2 callouts
  condicionais (contatos vs necessários, hunter vs meta mensal), tabela
  de equipe com total e callout de fechamento — mesmo layout visual do
  relatório pdfkit original.
- Frontend: página `CalculadoraMeta.jsx` com preview ao vivo (cosmético —
  o valor persistido vem sempre da resposta do servidor), tabela de
  equipe dinâmica (mínimo 1 linha). Classes CSS novas (`.stat-cards`,
  `.team-table`) reaproveitando só variáveis de design já existentes.
- Testado: 41 testes no backend (9 unitários de cálculo + 32 de API,
  incluindo o teste mais importante — recálculo ignora valores forjados
  no body), fluxo real via curl (criar → PDF) + conferência visual do
  PDF gerado.

### Testes
- `pytest-django` + `factory-boy`: 50/50 passando (Meu Porquê + Calculadora).
- Suíte do Node (`npm test`) confirmada intacta a cada mudança — nada em
  `src/`/`public/`/`tests/` foi tocado pela migração.

## 🔧 Pendente agora (bloqueando ou quase)

- [ ] **Estáticos do Django admin em produção** — sem CSS/JS (confirmado
  via `curl`, 404 em `/static/admin/css/base.css`). Uma correção via
  WhiteNoise foi feita e depois revertida a pedido do usuário, que está
  pesquisando uma solução com Nginx. Em aberto.
- [ ] **Deploy do frontend (Static Site) no Render** — confirmar se já
  foi criado; falta configurar Build Command
  (`npm install && npm run build`), Publish Directory (`dist`) e
  `VITE_API_URL` apontando pro backend.
- [ ] **Cadastrar Empresas/Setores/Gerentes reais** via Django admin —
  hoje só existem registros de teste (sempre limpos depois de cada
  validação). Nenhum cliente de verdade tem conta ainda.

## 📋 Backlog — próximas fatias da migração

Ordenado sugerido (mais simples/isolado primeiro), mas pode reordenar
conforme prioridade de negócio:

1. **Migrar a avaliação DISC** (`disc.html` → Django/DRF + React) — a
   mais complexa das 3: reimplementar `discScoring.js` em Python
   (cálculo no servidor, não confiar no cliente — mesma regra já vale
   hoje no Node) e portar o relatório PDF (`discReport.js` → template
   WeasyPrint).
2. **Migrar o painel administrativo** (`admin.html` → Django) — hoje
   token fixo (`x-admin-token`); o Django já tem `/admin/` funcionando
   pra Empresa/Setor/Usuario/MeuPorqueResposta/MetaComercial, falta
   estender pras outras ferramentas conforme migram, e decidir se o
   painel do facilitador vira uma tela React própria (com permissão por
   papel) ou continua sendo só o Django admin puro.
3. **Migrar a rotina de notificação por e-mail**
   (`participantNotifier.js`) — depende das 3 tabelas (`metas`,
   `disc_respostas`, `meu_porque_respostas`), só faz sentido migrar de
   verdade depois que o DISC também estiver no Django.
4. **Desligar as rotas/páginas antigas do Node** correspondentes, uma a
   uma, conforme cada fatia acima for validada em produção
   (`public/meu-porque.html` e `public/calculadora.html`, já que são as
   2 migradas até agora) — nenhuma foi desligada ainda, tudo residente
   nos dois stacks ao mesmo tempo.

## ⚠️ Riscos/observações conhecidas

- **Risco de dado, não de código**: `participantNotifier.js` (Node,
  ainda ativo) casa `disc_respostas.empresa` com
  `meu_porque_respostas.empresa` por **igualdade exata de string**.
  Agora que `meu_porque_respostas.empresa` passa a vir de `Empresa.nome`
  (cadastro controlado no Django) em vez de texto livre, um nome
  cadastrado com grafia diferente do que os colaboradores digitam no
  DISC/Calculadora antigos (acento, maiúscula, espaço) faz o bundle de
  PDFs da rotina de notificação parar de encontrar aquela empresa,
  silenciosamente. Atenção ao cadastrar `Empresa` no Django admin.
- **Sem teste de carga ainda pro backend Django** — só o Node tem
  `scripts/loadtest.js` rodado. Avaliar antes de prometer volume alto de
  usuários na stack nova.
- **Sem health check dedicado no Django** — o Node tem `GET
  /api/health`; o backend novo ainda não tem um endpoint equivalente pra
  monitoramento externo.
- **Limitação já documentada do Meu Porquê**: só quem tem uma linha
  *pendente* em `meu_porque_respostas` é descoberto como destinatário da
  notificação — depois de processada uma vez, novos DISCs da mesma
  empresa só disparam e-mail se alguém preencher o Meu Porquê nela de
  novo (ver `CLAUDE.md`).
