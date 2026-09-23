import re
import unicodedata
from datetime import datetime

from django.template.loader import render_to_string
from weasyprint import HTML

PERGUNTAS = [
    {
        'campo': 'objetivo',
        'titulo': '1. Qual é o seu objetivo?',
        'subtitulo': 'O que você quer conquistar — de forma clara e específica.',
    },
    {
        'campo': 'sonho',
        'titulo': '2. Qual é o seu sonho?',
        'subtitulo': 'Aquilo que você quer de verdade, não o que acham que você deveria querer.',
    },
    {
        'campo': 'mudanca',
        'titulo': '3. Qual é a sua mudança?',
        'subtitulo': 'O que precisa mudar em você, hoje, pra esse sonho ser possível.',
    },
    {
        'campo': 'visao_futuro',
        'titulo': '4. Qual é a sua visão de futuro?',
        'subtitulo': 'Como é a sua vida e a sua empresa quando isso acontecer.',
    },
]


def sanitize_for_filename(nome):
    """Mesma ideia de sanitizeForFilename() em src/reports/pdfLayout.js:
    tira caracteres inválidos em nome de arquivo, colapsa espaços, tira as
    pontas."""
    if not nome:
        return ''
    limpo = re.sub(r'[\\/:*?"<>|]', '', nome)
    limpo = re.sub(r'\s+', ' ', limpo).strip()
    return limpo


def meu_porque_filename(nome_participante):
    nome = sanitize_for_filename(nome_participante)
    base = f'{nome} meu porque' if nome else 'Meu Porque'
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
    """Mesmo formato que o Node produz via toLocaleDateString('pt-BR', {day:
    '2-digit', month:'long', year:'numeric'}) — escrito à mão em vez de
    depender do locale do sistema (indisponível neste ambiente, dava
    'September' em vez de 'setembro')."""
    return f'{data.day:02d} de {MESES_PT_BR[data.month - 1]} de {data.year}'


def gerar_pdf(resposta):
    data_formatada = formatar_data_pt_br(datetime.now())
    perguntas = [
        {
            'titulo': p['titulo'],
            'subtitulo': p['subtitulo'],
            'resposta': getattr(resposta, p['campo']),
        }
        for p in PERGUNTAS
    ]
    html = render_to_string('meu_porque/pdf.html', {
        'resposta': resposta,
        'perguntas': perguntas,
        'data_formatada': data_formatada,
    })
    return HTML(string=html).write_pdf()
