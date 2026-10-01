"""Dados e cálculo do perfil DISC — porte fiel de src/discScoring.js +
a parte de src/reports/discReport.js que o POST (não só o PDF) também usa
(resolver_perfil_dominante, ARQUETIPO_MAP) — função pura, sem Django, pra
o servidor recalcular natural/adaptado/intensidade a partir das respostas
cruas, nunca confiando em escore pronto que o cliente mande.

BLOCOS_A/INTENSIDADE_C/ARQUETIPO_MAP são cópia fiel do que já existe no
Node (public/disc.html, src/discScoring.js, src/reports/discReport.js) —
se o conteúdo da avaliação mudar lá, espelhe a mudança aqui também.
"""

import json

# Parte A — 28 blocos de escolha forçada (1 palavra em Mais, 1 em Menos).
# Guarda o texto inteiro, não só o traço, porque a ordem das palavras não
# é garantidamente uniforme entre blocos — copiar o texto permite auditar
# visualmente contra public/disc.html se o conteúdo mudar lá.
BLOCOS_A = [
    {'words': [
        {'text': 'Decidido: escolho rápido e assumo a consequência', 'trait': 'D'},
        {'text': 'Entusiasmado: contagio as pessoas com energia', 'trait': 'I'},
        {'text': 'Paciente: espero o tempo certo sem me irritar', 'trait': 'S'},
        {'text': 'Preciso: gosto de fazer certo nos detalhes', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Competitivo: quero vencer e liderar o placar', 'trait': 'D'},
        {'text': 'Sociável: converso com qualquer pessoa facilmente', 'trait': 'I'},
        {'text': 'Leal: fico ao lado de quem confio, mesmo na crise', 'trait': 'S'},
        {'text': 'Criterioso: só sigo quando os dados fecham', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Assumo o comando quando ninguém decide', 'trait': 'D'},
        {'text': 'Falo em público sem medo e com prazer', 'trait': 'I'},
        {'text': 'Ouço mais do que falo nas reuniões', 'trait': 'S'},
        {'text': 'Pergunto os números antes de opinar', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Prefiro pedir perdão do que pedir permissão', 'trait': 'D'},
        {'text': 'Prefiro convencer a impor', 'trait': 'I'},
        {'text': 'Prefiro combinar antes de mudar qualquer coisa', 'trait': 'S'},
        {'text': 'Prefiro seguir o procedimento já validado', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Direto: digo o que penso, sem embalar', 'trait': 'D'},
        {'text': 'Otimista: sempre vejo a saída positiva', 'trait': 'I'},
        {'text': 'Calmo: mantenho a temperatura baixa na pressão', 'trait': 'S'},
        {'text': 'Cuidadoso: reviso antes de entregar', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Impaciência é meu maior defeito', 'trait': 'D'},
        {'text': 'Falar demais é meu maior defeito', 'trait': 'I'},
        {'text': 'Evitar conflito é meu maior defeito', 'trait': 'S'},
        {'text': 'Perfeccionismo é meu maior defeito', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Me energiza um desafio grande e difícil', 'trait': 'D'},
        {'text': 'Me energiza reconhecimento e plateia', 'trait': 'I'},
        {'text': 'Me energiza um time unido e previsível', 'trait': 'S'},
        {'text': 'Me energiza dominar um assunto a fundo', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Odeio perder tempo com reunião longa', 'trait': 'D'},
        {'text': 'Odeio trabalhar sozinho e em silêncio', 'trait': 'I'},
        {'text': 'Odeio mudança repentina de regra', 'trait': 'S'},
        {'text': 'Odeio improviso e informação solta', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Cobro resultado sem rodeio', 'trait': 'D'},
        {'text': 'Motivo elogiando na frente de todos', 'trait': 'I'},
        {'text': 'Apoio quem está travado, com paciência', 'trait': 'S'},
        {'text': 'Corrijo mostrando o erro no processo', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Sob pressão eu acelero e assumo', 'trait': 'D'},
        {'text': 'Sob pressão eu falo e mobilizo gente', 'trait': 'I'},
        {'text': 'Sob pressão eu absorvo e sigo firme', 'trait': 'S'},
        {'text': 'Sob pressão eu me recolho e analiso', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Foco no resultado final', 'trait': 'D'},
        {'text': 'Foco nas pessoas envolvidas', 'trait': 'I'},
        {'text': 'Foco em manter o time estável', 'trait': 'S'},
        {'text': 'Foco na qualidade da entrega', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Aceito risco alto por retorno alto', 'trait': 'D'},
        {'text': 'Aposto na minha capacidade de convencer', 'trait': 'I'},
        {'text': 'Prefiro ganho menor e mais garantido', 'trait': 'S'},
        {'text': 'Só arrisco depois de simular cenários', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Firme: mantenho posição mesmo contrariando', 'trait': 'D'},
        {'text': 'Persuasivo: viro o jogo na conversa', 'trait': 'I'},
        {'text': 'Conciliador: busco acordo entre as partes', 'trait': 'S'},
        {'text': 'Lógico: argumento com fato, não emoção', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Minha agenda é cheia de decisões', 'trait': 'D'},
        {'text': 'Minha agenda é cheia de gente', 'trait': 'I'},
        {'text': 'Minha agenda é rotineira e organizada', 'trait': 'S'},
        {'text': 'Minha agenda tem bloco para analisar', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Quero autonomia total no meu trabalho', 'trait': 'D'},
        {'text': 'Quero liberdade para criar e circular', 'trait': 'I'},
        {'text': 'Quero clareza de rotina e estabilidade', 'trait': 'S'},
        {'text': 'Quero regras e padrões bem definidos', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Me irrita indecisão', 'trait': 'D'},
        {'text': 'Me irrita ambiente frio e formal', 'trait': 'I'},
        {'text': 'Me irrita grosseria e briga', 'trait': 'S'},
        {'text': 'Me irrita descuido e desleixo', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Se der errado, eu mudo a rota na hora', 'trait': 'D'},
        {'text': 'Se der errado, eu chamo gente pra ajudar', 'trait': 'I'},
        {'text': 'Se der errado, eu insisto com constância', 'trait': 'S'},
        {'text': 'Se der errado, eu investigo a causa raiz', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Sou avaliado pelo que entrego', 'trait': 'D'},
        {'text': 'Sou lembrado pela energia que trago', 'trait': 'I'},
        {'text': 'Sou reconhecido pela confiança que passo', 'trait': 'S'},
        {'text': 'Sou respeitado pelo meu domínio técnico', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Negocio pressionando e testando limite', 'trait': 'D'},
        {'text': 'Negocio criando clima e relação', 'trait': 'I'},
        {'text': 'Negocio cedendo para preservar a relação', 'trait': 'S'},
        {'text': 'Negocio com planilha e comparativo', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Meta agressiva me acende', 'trait': 'D'},
        {'text': 'Ranking e campanha me acendem', 'trait': 'I'},
        {'text': 'Meta possível e constante me acende', 'trait': 'S'},
        {'text': 'Meta bem justificada por dado me acende', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Delego cobrando prazo curto', 'trait': 'D'},
        {'text': 'Delego animando e acompanhando junto', 'trait': 'I'},
        {'text': 'Delego explicando com calma e apoio', 'trait': 'S'},
        {'text': 'Delego com instrução escrita e padrão', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Tenho pouca paciência com detalhe', 'trait': 'D'},
        {'text': 'Tenho pouca paciência com burocracia', 'trait': 'I'},
        {'text': 'Tenho pouca paciência com pressa desnecessária', 'trait': 'S'},
        {'text': 'Tenho pouca paciência com achismo', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Meu maior medo é perder o controle', 'trait': 'D'},
        {'text': 'Meu maior medo é ser rejeitado', 'trait': 'I'},
        {'text': 'Meu maior medo é a instabilidade', 'trait': 'S'},
        {'text': 'Meu maior medo é cometer um erro', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'No meu negócio eu puxo o crescimento', 'trait': 'D'},
        {'text': 'No meu negócio eu abro mercado e relaciono', 'trait': 'I'},
        {'text': 'No meu negócio eu sustento a operação', 'trait': 'S'},
        {'text': 'No meu negócio eu organizo e controlo', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Contrato quem entrega resultado, mesmo difícil de lidar', 'trait': 'D'},
        {'text': 'Contrato quem tem energia e boa comunicação', 'trait': 'I'},
        {'text': 'Contrato quem é leal e fica no time', 'trait': 'S'},
        {'text': 'Contrato quem é técnico e não erra', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Meu dinheiro eu reinvisto em crescimento agressivo', 'trait': 'D'},
        {'text': 'Meu dinheiro eu coloco em marca, imagem e relacionamento', 'trait': 'I'},
        {'text': 'Meu dinheiro eu guardo como reserva de segurança', 'trait': 'S'},
        {'text': 'Meu dinheiro eu aplico depois de estudar bem', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Quando discordo, bato de frente na hora', 'trait': 'D'},
        {'text': 'Quando discordo, tento convencer com jeito', 'trait': 'I'},
        {'text': 'Quando discordo, prefiro deixar passar', 'trait': 'S'},
        {'text': 'Quando discordo, junto evidências e apresento depois', 'trait': 'C'},
    ]},
    {'words': [
        {'text': 'Sucesso pra mim é ter conquistado território', 'trait': 'D'},
        {'text': 'Sucesso pra mim é ser admirado e lembrado', 'trait': 'I'},
        {'text': 'Sucesso pra mim é ter paz e um time fiel', 'trait': 'S'},
        {'text': 'Sucesso pra mim é ter feito com excelência', 'trait': 'C'},
    ]},
]

# Intensidade — 12 afirmações (3 por traço). Só {trait}, sem o texto de
# exibição (que só existe em public/disc.html) — a ordem é mecanicamente
# uniforme (D×3,I×3,S×3,C×3), ao contrário de BLOCOS_A.
INTENSIDADE_C = [
    {'trait': 'D'}, {'trait': 'D'}, {'trait': 'D'},
    {'trait': 'I'}, {'trait': 'I'}, {'trait': 'I'},
    {'trait': 'S'}, {'trait': 'S'}, {'trait': 'S'},
    {'trait': 'C'}, {'trait': 'C'}, {'trait': 'C'},
]

TRAIT_LABELS = {'D': 'Dominância', 'I': 'Influência', 'S': 'Estabilidade', 'C': 'Conformidade'}

# Pontos mínimos de separação entre o 1º e o 2º traço pra considerar que
# há um traço realmente dominante. Abaixo disso é empate técnico — nunca
# atribui dominância só porque a ordem de checagem D,I,S,C desempataria
# sozinha.
LIMIAR_EMPATE_TRACOS = 2

# Os 4 traços com nome/descrição/resumo/insights — cópia fiel de
# src/reports/discReport.js (ARQUETIPO_MAP). Usado tanto pra montar a
# string `arquetipo` no momento de salvar (só o `nome`) quanto pelo PDF
# (todo o resto).
ARQUETIPO_MAP = {
    'D': {
        'nome': 'O Executor',
        'descricao': 'Perfil dominante — Dominância acima dos demais',
        'resumo': 'Foco em resultado rápido: decide sob pressão, mobiliza gente e assume responsabilidade sem esperar aprovação.',
        'performa': 'Você performa melhor em ambientes de alta pressão onde resultado rápido é o que importa. Tem capacidade natural de decidir sob incerteza, mobilizar pessoas para ação imediata e assumir responsabilidades que outros evitam. Funções de liderança direta, vendas consultivas de alta complexidade e qualquer papel que exija coragem para agir sem aprovação de todos são onde você entrega mais.',
        'derail': 'Você pode derrubar sua própria performance ao atropelar pessoas que precisam de mais tempo, ao não ouvir feedback que contradiz sua visão ou ao criar urgência desnecessária que desgasta o time. A impaciência com processos e a tendência de decidir sozinho podem gerar resistência onde você mais precisa de adesão.',
    },
    'I': {
        'nome': 'O Comunicador',
        'descricao': 'Perfil dominante — Influência acima dos demais',
        'resumo': 'Foco em relacionamento: engaja, entusiasma e vende visões com facilidade natural para conectar pessoas.',
        'performa': 'Você performa melhor em ambientes que exigem engajamento, construção de relacionamento e capacidade de inspirar pessoas a acreditar em algo. Tem talento natural para criar atmosfera positiva, vender visões e conectar pessoas. Funções de desenvolvimento de negócios, gestão de comunidade, treinamento e vendas relacionais são onde você entrega mais.',
        'derail': 'Você pode derrubar sua performance ao deixar tarefas incompletas por excesso de ideias, ao evitar conversas difíceis para preservar o clima, ou ao superestimar o entusiasmo de outros como compromisso real. A falta de follow-through e o excesso de otimismo podem comprometer sua credibilidade nos momentos críticos.',
    },
    'S': {
        'nome': 'O Planejador',
        'descricao': 'Perfil dominante — Estabilidade acima dos demais',
        'resumo': 'Foco em consistência: sustenta ritmo, cuida das pessoas ao redor e garante que o combinado seja entregue.',
        'performa': 'Você performa melhor em ambientes que valorizam consistência, profundidade e confiabilidade. Tem capacidade natural de sustentar ritmo, cuidar de pessoas e garantir que o que foi prometido seja entregue. Funções de customer success, gestão de projetos de longo prazo, atendimento e qualquer papel onde a confiança é o ativo central são onde você entrega mais.',
        'derail': 'Você pode derrubar sua performance ao evitar conflitos necessários, ao resistir a mudanças que seriam boas mas geram desconforto, ou ao se sobrecarregar por dificuldade de dizer não. A tendência de priorizar harmonia pode fazer você segurar feedbacks importantes que precisam ser dados.',
    },
    'C': {
        'nome': 'O Analista',
        'descricao': 'Perfil dominante — Conformidade acima dos demais',
        'resumo': 'Foco em precisão: analisa risco antes de agir, estrutura processo com rigor e busca o padrão de qualidade certo.',
        'performa': 'Você performa melhor em ambientes que valorizam qualidade, precisão e análise criteriosa. Tem capacidade natural de identificar riscos antes que se tornem problemas, estruturar processos com rigor e garantir que as entregas tenham o padrão esperado. Funções de operações, qualidade, análise de dados, produtos técnicos e consultoria são onde você entrega mais.',
        'derail': 'Você pode derrubar sua performance ao paralisar por excesso de análise, ao rejeitar decisões tomadas com dados insuficientes (mesmo quando o timing exige ação) ou ao criticar sem oferecer alternativas. O perfeccionismo pode gerar atrasos e a exigência de precisão pode tornar a colaboração com perfis mais impulsivos difícil.',
    },
}


def _word_index(valor):
    """Mesma tolerância do Number(...) + Number.isInteger(...) do JS —
    aceita int ou string numérica, rejeita bool (bool é subclasse de int
    em Python, mas não é um índice de palavra válido)."""
    if isinstance(valor, bool):
        return None
    try:
        n = int(valor)
    except (TypeError, ValueError):
        return None
    return n


def calc_natural(respostas_a):
    """Porte de calcNatural() — conta quantas vezes cada traço foi
    escolhido como Menos (o que exige menos esforço)."""
    scores = {'D': 0, 'I': 0, 'S': 0, 'C': 0}
    ra = respostas_a or {}
    for b_idx, bloco in enumerate(BLOCOS_A):
        r = ra.get(str(b_idx), ra.get(b_idx))
        if not r:
            continue
        mais = _word_index(r.get('mais'))
        menos = _word_index(r.get('menos'))
        if mais is None or menos is None or mais == menos:
            continue
        if 0 <= menos < len(bloco['words']):
            trait = bloco['words'][menos]['trait']
            scores[trait] = scores.get(trait, 0) + 1
    return scores


def calc_adaptado(respostas_a):
    """Porte de calcAdaptado() — conta quantas vezes cada traço foi
    escolhido como Mais (o que aparece quando o ambiente pede diferente)."""
    scores = {'D': 0, 'I': 0, 'S': 0, 'C': 0}
    ra = respostas_a or {}
    for b_idx, bloco in enumerate(BLOCOS_A):
        r = ra.get(str(b_idx), ra.get(b_idx))
        if not r:
            continue
        mais = _word_index(r.get('mais'))
        menos = _word_index(r.get('menos'))
        if mais is None or menos is None or mais == menos:
            continue
        if 0 <= mais < len(bloco['words']):
            trait = bloco['words'][mais]['trait']
            scores[trait] = scores.get(trait, 0) + 1
    return scores


def calc_intensidade(respostas_c):
    """Porte de calcIntensidade() — média por traço (3 perguntas cada),
    arredondada a 2 casas; 0 se nenhuma resposta válida pro traço."""
    scores = {'D': 0, 'I': 0, 'S': 0, 'C': 0}
    counts = {'D': 0, 'I': 0, 'S': 0, 'C': 0}
    rc = respostas_c or {}
    for a_idx, item in enumerate(INTENSIDADE_C):
        v = rc.get(str(a_idx), rc.get(a_idx))
        try:
            v = float(v)
        except (TypeError, ValueError):
            continue
        scores[item['trait']] += v
        counts[item['trait']] += 1
    for trait in scores:
        scores[trait] = round(scores[trait] / counts[trait], 2) if counts[trait] > 0 else 0
    return scores


def resolver_perfil_dominante(scores):
    """Porte de resolverPerfilDominante() — ranking D,I,S,C por escore
    decrescente; gap entre 1º e 2º menor que o limiar vira perfil
    combinado (2 traços), nunca desempata só pela ordem de checagem."""
    ordem = ['D', 'I', 'S', 'C']
    ranking = sorted(ordem, key=lambda t: scores.get(t, 0), reverse=True)
    gap = scores.get(ranking[0], 0) - scores.get(ranking[1], 0)
    empatado = gap < LIMIAR_EMPATE_TRACOS
    return {
        'traits': [ranking[0], ranking[1]] if empatado else [ranking[0]],
        'gap': gap,
        'empatado': empatado,
    }
