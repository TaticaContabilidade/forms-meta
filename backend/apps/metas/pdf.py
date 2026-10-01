import re
import unicodedata
from datetime import datetime

from django.template.loader import render_to_string
from weasyprint import HTML


def sanitize_for_filename(nome):
    """Mesma ideia de sanitizeForFilename() em src/reports/pdfLayout.js —
    duplicada de apps/meu_porque/pdf.py de propósito (cada app migrado
    fica autocontido)."""
    if not nome:
        return ''
    limpo = re.sub(r'[\\/:*?"<>|]', '', nome)
    limpo = re.sub(r'\s+', ' ', limpo).strip()
    return limpo


def meta_comercial_filename(nome_participante):
    nome = sanitize_for_filename(nome_participante)
    base = f'{nome} meta comercial' if nome else 'Meta comercial'
    return f'{base}.pdf'


def ascii_fallback(filename):
    normalizado = unicodedata.normalize('NFKD', filename)
    ascii_only = normalizado.encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^\x20-\x7e]', '_', ascii_only) or 'arquivo.pdf'


def content_disposition_filename(filename):
    from urllib.parse import quote
    return f'attachment; filename="{ascii_fallback(filename)}"; filename*=UTF-8\'\'{quote(filename)}'


MESES_PT_BR = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]


def formatar_data_pt_br(data):
    """Escrito à mão (não depende do locale do sistema) — mesmo padrão de
    apps/meu_porque/pdf.py."""
    return f'{data.day:02d} de {MESES_PT_BR[data.month - 1]} de {data.year}'


def fmt_brl(v):
    """R$ 1.234,56 — separador de milhar '.', decimal ','."""
    return 'R$ ' + f'{v:,.2f}'.replace(',', '#').replace('.', ',').replace('#', '.')


def fmt_pct(v):
    """10% ou 12,5% — sem casa decimal se for inteiro."""
    texto = f'{v:.1f}'.rstrip('0').rstrip('.')
    return f'{texto}%'


def gerar_pdf(resposta):
    equipe = resposta.equipe
    soma_equipe = sum(p.get('meta', 0) for p in equipe)
    diff_equipe = resposta.meta_mensal - soma_equipe
    callout_equipe = None
    if equipe and resposta.meta_mensal:
        if abs(diff_equipe) < 1:
            callout_equipe = {
                'tone': 'ok',
                'texto': f'Fecha: {fmt_brl(soma_equipe)} de {fmt_brl(resposta.meta_mensal)} distribuídos entre a equipe.',
            }
        elif diff_equipe > 0:
            callout_equipe = {
                'tone': 'alert',
                'texto': f'Falta distribuir {fmt_brl(diff_equipe)} para fechar a meta mensal da área ({fmt_brl(resposta.meta_mensal)}).',
            }
        else:
            callout_equipe = {
                'tone': 'alert',
                'texto': f'A soma das metas individuais está {fmt_brl(abs(diff_equipe))} acima da meta mensal da área ({fmt_brl(resposta.meta_mensal)}).',
            }

    callout_contatos = None
    if resposta.contatos_mes_passado > 0 and resposta.contatos_necessarios > 0:
        razao = resposta.contatos_mes_passado / resposta.contatos_necessarios
        if razao < 0.7:
            callout_contatos = {
                'tone': 'alert',
                'texto': (
                    f'O problema não é o vendedor. Você precisa de {int(resposta.contatos_necessarios)} '
                    f'contatos por mês e só entraram {round(resposta.contatos_mes_passado)}.'
                ),
            }
        else:
            callout_contatos = {
                'tone': 'ok',
                'texto': (
                    f'Entraram {round(resposta.contatos_mes_passado)} de {int(resposta.contatos_necessarios)} '
                    'contatos necessários. O volume de entrada sustenta essa meta.'
                ),
            }

    callout_hunter = None
    if resposta.hunter_valor > resposta.meta_mensal > 0:
        callout_hunter = (
            f'O valor de hunter ({fmt_brl(resposta.hunter_valor)}) é maior que a meta mensal da área '
            f'({fmt_brl(resposta.meta_mensal)}). Revise a divisão entre hunter e farmer.'
        )

    html = render_to_string('metas/pdf.html', {
        'resposta': resposta,
        'data_formatada': formatar_data_pt_br(datetime.now()),
        'stat_cards': [
            {'label': 'Meta mensal', 'value': fmt_brl(resposta.meta_mensal), 'destaque': True},
            {'label': 'Meta trimestral', 'value': fmt_brl(resposta.meta_trimestral)},
            {'label': 'Meta anual', 'value': fmt_brl(resposta.meta_anual)},
        ],
        'fatos_empresa': [
            {'label': 'Faturamento mensal atual', 'value': fmt_brl(resposta.faturamento)},
            {
                'label': f'Crescimento desejado no ano ({fmt_pct(resposta.crescimento_pct)})',
                'value': fmt_brl(resposta.faturamento * resposta.crescimento_pct / 100),
            },
            {
                'label': f'Perda estimada por churn no ano ({fmt_pct(resposta.churn_pct)})',
                'value': fmt_brl(resposta.faturamento * resposta.churn_pct / 100),
            },
            {'label': 'Meta anual (corporativa)', 'value': fmt_brl(resposta.meta_anual), 'destaque': True},
            {'label': 'Meta trimestral', 'value': fmt_brl(resposta.meta_trimestral)},
            {'label': 'Meta mensal (área comercial)', 'value': fmt_brl(resposta.meta_mensal), 'destaque': True},
        ],
        'fatos_contatos': [
            {'label': 'Ticket médio mensal', 'value': fmt_brl(resposta.ticket)},
            {'label': 'Contratos novos necessários por mês', 'value': f'{resposta.contratos_mes} contratos'},
            {'label': 'Taxa de conversão', 'value': fmt_pct(resposta.conversao_pct)},
            {'label': 'Contatos necessários por mês', 'value': f'{int(resposta.contatos_necessarios)} contatos'},
        ],
        'callout_contatos': callout_contatos,
        'fatos_pessoa': [
            {'label': 'Clientes novos (hunter)', 'value': fmt_brl(resposta.hunter_valor)},
            {'label': 'Base — upsell e cross-sell (farmer)', 'value': fmt_brl(resposta.farmer_valor)},
        ],
        'callout_hunter': callout_hunter,
        'equipe': equipe,
        'soma_equipe': soma_equipe,
        'callout_equipe': callout_equipe,
    })
    return HTML(string=html).write_pdf()
