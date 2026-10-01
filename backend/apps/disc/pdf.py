import re
import unicodedata
from datetime import datetime

from django.template.loader import render_to_string
from weasyprint import HTML

from .scoring import ARQUETIPO_MAP, TRAIT_LABELS, resolver_perfil_dominante

TRAITS = ['D', 'I', 'S', 'C']
TRAIT_COLORS = {'D': '#D64545', 'I': '#C98423', 'S': '#1E9A66', 'C': '#3E76D6'}
TRAIT_BG = {'D': '#FBEAEA', 'I': '#FDF3E2', 'S': '#E4F5EC', 'C': '#E7F0FD'}


def sanitize_for_filename(nome):
    """Mesma ideia de sanitizeForFilename() em src/reports/pdfLayout.js —
    duplicada de apps/meu_porque/pdf.py e apps/metas/pdf.py de propósito
    (cada app migrado fica autocontido)."""
    if not nome:
        return ''
    limpo = re.sub(r'[\\/:*?"<>|]', '', nome)
    limpo = re.sub(r'\s+', ' ', limpo).strip()
    return limpo


def disc_filename(nome_participante):
    nome = sanitize_for_filename(nome_participante)
    base = f'{nome} perfil disc' if nome else 'Perfil DISC'
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
    apps/meu_porque/pdf.py e apps/metas/pdf.py."""
    return f'{data.day:02d} de {MESES_PT_BR[data.month - 1]} de {data.year}'


def fmt_decimal_pt_br(n):
    """D-10 da auditoria do Node: 1 casa decimal, vírgula em vez de ponto."""
    return f'{(n or 0):.1f}'.replace('.', ',')


def frase_intensidade(trait, valor):
    """D-05: modula o texto de "como você performa" pela intensidade
    medida na Parte C — porte de fraseIntensidade() em discReport.js."""
    label = TRAIT_LABELS[trait]
    fmt = fmt_decimal_pt_br(valor)
    if valor >= 4:
        return f'Sua intensidade de {label} é alta ({fmt} de 5) — esse traço aparece com força no seu dia a dia.'
    if valor <= 2:
        return f'Sua intensidade de {label} é baixa ({fmt} de 5) — esse traço aparece de forma mais moderada no seu comportamento.'
    return f'Sua intensidade de {label} é moderada ({fmt} de 5).'


def gerar_pdf(resposta):
    natural = {
        'D': resposta.d_natural or 0, 'I': resposta.i_natural or 0,
        'S': resposta.s_natural or 0, 'C': resposta.c_natural or 0,
    }
    adaptado = {
        'D': resposta.d_adaptado or 0, 'I': resposta.i_adaptado or 0,
        'S': resposta.s_adaptado or 0, 'C': resposta.c_adaptado or 0,
    }
    intensidade = {
        'D': resposta.d_intensidade or 0, 'I': resposta.i_intensidade or 0,
        'S': resposta.s_intensidade or 0, 'C': resposta.c_intensidade or 0,
    }

    # Sempre recalculado a partir dos escores brutos já salvos — nunca
    # confia num perfil_dominante/arquetipo já gravado, que pode ter sido
    # salvo por uma versão anterior.
    perfil = resolver_perfil_dominante(natural)
    infos = [ARQUETIPO_MAP[t] for t in perfil['traits']]

    if not perfil['empatado']:
        hero_descricao = infos[0]['descricao']
    else:
        gap = perfil['gap']
        plural = '' if gap == 1 else 's'
        hero_descricao = (
            f"Empate técnico entre {perfil['traits'][0]} e {perfil['traits'][1]} — diferença de só {gap} "
            f"ponto{plural} no perfil natural. Considere as duas descrições abaixo, não apenas uma."
        )

    bars_natural = [
        {'trait': t, 'label': TRAIT_LABELS[t], 'color': TRAIT_COLORS[t],
         'pct': (natural[t] / 28 * 100) if 28 else 0, 'valor': int(natural[t])}
        for t in TRAITS
    ]
    bars_adaptado = [
        {'trait': t, 'label': TRAIT_LABELS[t], 'color': TRAIT_COLORS[t],
         'pct': (adaptado[t] / 28 * 100) if 28 else 0, 'valor': int(adaptado[t])}
        for t in TRAITS
    ]
    bars_intensidade = [
        {'trait': t, 'label': TRAIT_LABELS[t], 'color': TRAIT_COLORS[t],
         'pct': (intensidade[t] / 5 * 100), 'valor': fmt_decimal_pt_br(intensidade[t])}
        for t in TRAITS
    ]

    # D-05: quando as 4 intensidades saem muito parecidas, é sinal de
    # respostas pouco diferenciadas na Parte C.
    valores_intensidade = [intensidade[t] for t in TRAITS]
    spread = max(valores_intensidade) - min(valores_intensidade)
    intensidade_aviso = None
    if spread < 1:
        intensidade_aviso = (
            f'Suas quatro intensidades ficaram bem parecidas (diferença de só {fmt_decimal_pt_br(spread)} '
            'ponto entre a maior e a menor). Isso pode ser porque os quatro traços realmente pesam parecido '
            'em você, ou porque as respostas da Parte C foram pouco diferenciadas.'
        )

    cards = [
        {'trait': t, 'nome': ARQUETIPO_MAP[t]['nome'], 'resumo': ARQUETIPO_MAP[t]['resumo'],
         'color': TRAIT_COLORS[t], 'bg': TRAIT_BG[t], 'is_own': t in perfil['traits']}
        for t in TRAITS
    ]

    insights_performa = [
        {'nome': info['nome'], 'texto': f"{frase_intensidade(t, intensidade[t])} {info['performa']}"}
        for t, info in zip(perfil['traits'], infos)
    ]
    insights_derail = [
        {'nome': info['nome'], 'texto': info['derail']}
        for info in infos
    ]

    dados_empresa = resposta.empresa
    html = render_to_string('disc/pdf.html', {
        'resposta': resposta,
        'data_formatada': formatar_data_pt_br(datetime.now()),
        'titulo': f'Perfil comportamental — {dados_empresa}' if dados_empresa else 'Perfil comportamental',
        'arquetipo_nome': infos[0]['nome'] if not perfil['empatado'] else ' + '.join(i['nome'] for i in infos),
        'empatado': perfil['empatado'],
        'hero_descricao': hero_descricao,
        'bars_natural': bars_natural,
        'bars_adaptado': bars_adaptado,
        'bars_intensidade': bars_intensidade,
        'intensidade_aviso': intensidade_aviso,
        'cards': cards,
        'insights_performa': insights_performa,
        'insights_derail': insights_derail,
    })
    return HTML(string=html).write_pdf()
