from apps.metas.calculo import calcular_meta


def test_calculo_ponta_a_ponta():
    resultado = calcular_meta({
        'faturamento': 100000,
        'crescimento_pct': 20,
        'churn_pct': 10,
        'ticket': 2000,
        'conversao_pct': 25,
        'contatos_mes_passado': 10,
        'hunter_valor': 1000,
        'equipe': [],
    })

    assert resultado['meta_anual'] == 100000 * 0.20 + 100000 * 0.10  # 30000
    assert resultado['meta_trimestral'] == resultado['meta_anual'] / 4
    assert resultado['meta_mensal'] == resultado['meta_anual'] / 12
    # meta_mensal = 2500; contratos_mes_raw = 2500/2000 = 1.25 -> round(,1) = 1.2
    assert resultado['contratos_mes'] == 1.2
    # contatos_necessarios_raw = 1.25 / 0.25 = 5.0 -> ceil = 5
    assert resultado['contatos_necessarios'] == 5
    assert resultado['farmer_valor'] == resultado['meta_mensal'] - 1000


def test_contratos_mes_arredonda_apenas_uma_vez():
    resultado = calcular_meta({
        'faturamento': 100000, 'crescimento_pct': 7, 'churn_pct': 0,
        'ticket': 333, 'conversao_pct': 100,
    })
    # meta_mensal = 100000*0.07/12 = 583.333...; /333 = 1.7517...
    assert resultado['contratos_mes'] == round(583.3333333333334 / 333, 1)


def test_contatos_necessarios_sempre_ceil():
    resultado = calcular_meta({
        'faturamento': 120000, 'crescimento_pct': 10, 'churn_pct': 0,
        'ticket': 1000, 'conversao_pct': 100,
    })
    # meta_mensal = 1000; contratos_mes_raw = 1.0; conv=1 -> contatos_necessarios_raw = 1.0 -> ceil = 1
    assert resultado['contatos_necessarios'] == 1

    resultado2 = calcular_meta({
        'faturamento': 120000, 'crescimento_pct': 10, 'churn_pct': 0,
        'ticket': 1000, 'conversao_pct': 99,
    })
    # contatos_necessarios_raw = 1.0 / 0.99 = 1.0101... -> ceil = 2
    assert resultado2['contatos_necessarios'] == 2


def test_ticket_zero_nao_quebra():
    resultado = calcular_meta({
        'faturamento': 100000, 'crescimento_pct': 10, 'churn_pct': 0,
        'ticket': 0, 'conversao_pct': 50,
    })
    assert resultado['contratos_mes'] == 0
    assert resultado['contatos_necessarios'] == 0


def test_conversao_zero_nao_quebra():
    resultado = calcular_meta({
        'faturamento': 100000, 'crescimento_pct': 10, 'churn_pct': 0,
        'ticket': 500, 'conversao_pct': 0,
    })
    assert resultado['contatos_necessarios'] == 0


def test_hunter_maior_que_meta_mensal_farmer_fica_zero():
    resultado = calcular_meta({
        'faturamento': 10000, 'crescimento_pct': 1, 'churn_pct': 0,
        'ticket': 100, 'conversao_pct': 50, 'hunter_valor': 999999,
    })
    assert resultado['farmer_valor'] == 0


def test_percentuais_acima_do_teto_sao_clampados():
    resultado = calcular_meta({
        'faturamento': 1000, 'crescimento_pct': 999, 'churn_pct': 999,
        'ticket': 100, 'conversao_pct': 999,
    })
    assert resultado['crescimento_pct'] == 500
    assert resultado['churn_pct'] == 100
    assert resultado['conversao_pct'] == 100


def test_valores_negativos_sao_clampados_a_zero():
    resultado = calcular_meta({
        'faturamento': -100, 'crescimento_pct': -5, 'churn_pct': -5,
        'ticket': -50, 'conversao_pct': -5,
        'contatos_mes_passado': -3, 'hunter_valor': -10,
    })
    assert resultado['faturamento'] == 0
    assert resultado['crescimento_pct'] == 0
    assert resultado['churn_pct'] == 0
    assert resultado['ticket'] == 0
    assert resultado['conversao_pct'] == 0
    assert resultado['contatos_mes_passado'] == 0
    assert resultado['hunter_valor'] == 0


def test_equipe_sem_nome_e_descartada():
    resultado = calcular_meta({
        'faturamento': 1000, 'crescimento_pct': 10, 'churn_pct': 0,
        'ticket': 100, 'conversao_pct': 50,
        'equipe': [
            {'nome': '', 'tipo': 'Hunter', 'meta': 500},
            {'nome': '   ', 'tipo': 'Hunter', 'meta': 500},
            {'nome': 'Fulano', 'tipo': 'Farmer', 'meta': 0},
        ],
    })
    import json
    equipe = json.loads(resultado['equipe_json'])
    assert len(equipe) == 1
    assert equipe[0]['nome'] == 'Fulano'
    assert equipe[0]['meta'] == 0
