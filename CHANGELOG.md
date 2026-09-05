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
