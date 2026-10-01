import json

from django.db import models
from django.db.models import Func


class ToCharNow(Func):
    """Duplicada de apps/meu_porque/models.py de propósito — cada app
    migrado fica autocontido, mesmo padrão de duplicação deliberada já
    usado no Node (ARQUETIPO_MAP/BLOCOS_A, ver CLAUDE.md)."""

    template = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"


class MetaComercial(models.Model):
    """Aponta pra `metas`, tabela cujo DDL continua sendo dono o Node
    (src/db.js). managed=False — mesmo racional de MeuPorqueResposta.
    Todos os campos derivados (meta_anual, meta_mensal, contratos_mes,
    etc.) vêm SEMPRE recalculados no servidor a partir dos campos brutos
    (ver calculo.calcular_meta) — nunca persistimos um valor computado que
    o cliente tenha mandado pronto no body.
    """

    criado_em = models.CharField(max_length=32, editable=False, db_default=ToCharNow())
    nome_participante = models.CharField(max_length=200, blank=True)
    empresa = models.CharField(max_length=200, blank=True)
    email = models.CharField(max_length=200, blank=True)

    # campos brutos (entrada do usuário)
    faturamento = models.FloatField(null=True, blank=True, default=0)
    crescimento_pct = models.FloatField(null=True, blank=True, default=0)
    churn_pct = models.FloatField(null=True, blank=True, default=0)
    ticket = models.FloatField(null=True, blank=True, default=0)
    conversao_pct = models.FloatField(null=True, blank=True, default=0)
    contatos_mes_passado = models.FloatField(null=True, blank=True, default=0)
    hunter_valor = models.FloatField(null=True, blank=True, default=0)

    # campos derivados — sempre recalculados no servidor
    meta_anual = models.FloatField(null=True, blank=True, default=0)
    meta_trimestral = models.FloatField(null=True, blank=True, default=0)
    meta_mensal = models.FloatField(null=True, blank=True, default=0)
    contratos_mes = models.FloatField(null=True, blank=True, default=0)
    contatos_necessarios = models.FloatField(null=True, blank=True, default=0)
    farmer_valor = models.FloatField(null=True, blank=True, default=0)

    # coluna real é TEXT contendo JSON serializado, não jsonb — por isso
    # TextField, não JSONField.
    equipe_json = models.TextField(blank=True, default='[]')

    notificado_em = models.CharField(max_length=32, null=True, blank=True, editable=False)
    usuario = models.ForeignKey(
        'contas.Usuario',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column='usuario_id',
        related_name='metas_respostas',
    )

    class Meta:
        db_table = 'metas'
        managed = False

    def __str__(self):
        return f'Meta comercial #{self.pk} — {self.nome_participante}'

    @property
    def equipe(self):
        """Só leitura, usado pelo pdf.py — não exposto via serializer
        (o campo `equipe` do serializer é write_only, ver serializers.py)."""
        try:
            return json.loads(self.equipe_json or '[]')
        except (TypeError, ValueError):
            return []
