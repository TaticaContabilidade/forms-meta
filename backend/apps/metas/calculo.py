import json
import math


def _clamp(valor, minimo, maximo):
    v = float(valor or 0)
    return min(max(v, minimo), maximo)


def calcular_meta(dados):
    """Espelha recalc() de public/calculadora.html linha a linha, incluindo
    a ordem de arredondamento (F-04 do Node: arredonda 1x só, aqui
    reaproveitado em tudo — banco, listagem, PDF). `dados` é um dict com as
    chaves brutas (faturamento, crescimento_pct, churn_pct, ticket,
    conversao_pct, contatos_mes_passado, hunter_valor, equipe) já
    validadas pelo serializer (presença/teto) — esta função só faz
    clamp-pra-zero de negativo + a matemática, nunca rejeita nada.
    """
    faturamento = max(float(dados.get('faturamento') or 0), 0)
    crescimento_pct = _clamp(dados.get('crescimento_pct'), 0, 500)
    churn_pct = _clamp(dados.get('churn_pct'), 0, 100)
    ticket = max(float(dados.get('ticket') or 0), 0)
    conversao_pct = _clamp(dados.get('conversao_pct'), 0, 100)
    contatos_mes_passado = max(float(dados.get('contatos_mes_passado') or 0), 0)
    hunter_valor = max(float(dados.get('hunter_valor') or 0), 0)

    cresc = crescimento_pct / 100
    churn = churn_pct / 100
    conv = conversao_pct / 100

    crescimento_reais = faturamento * cresc
    churn_reais = faturamento * churn
    meta_anual = crescimento_reais + churn_reais
    meta_trimestral = meta_anual / 4
    meta_mensal = meta_anual / 12

    contratos_mes_raw = (meta_mensal / ticket) if ticket > 0 else 0
    contatos_necessarios_raw = (contratos_mes_raw / conv) if conv > 0 else 0

    contratos_mes = round(contratos_mes_raw, 1)  # 1 casa, arredonda 1x só
    contatos_necessarios = math.ceil(contatos_necessarios_raw)

    farmer_valor = max(meta_mensal - hunter_valor, 0)

    # F-08 do Node: linha sem nome não entra na soma nem é persistida.
    equipe_valida = [
        {
            'nome': (pessoa.get('nome') or '').strip(),
            'tipo': pessoa.get('tipo') or 'Hunter',
            'meta': max(float(pessoa.get('meta') or 0), 0),
        }
        for pessoa in (dados.get('equipe') or [])
        if (pessoa.get('nome') or '').strip()
    ]

    return {
        'faturamento': faturamento,
        'crescimento_pct': crescimento_pct,
        'churn_pct': churn_pct,
        'meta_anual': meta_anual,
        'meta_trimestral': meta_trimestral,
        'meta_mensal': meta_mensal,
        'ticket': ticket,
        'contratos_mes': contratos_mes,
        'conversao_pct': conversao_pct,
        'contatos_necessarios': contatos_necessarios,
        'contatos_mes_passado': contatos_mes_passado,
        'hunter_valor': hunter_valor,
        'farmer_valor': farmer_valor,
        'equipe_json': json.dumps(equipe_valida),
    }
