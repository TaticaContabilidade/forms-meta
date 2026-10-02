from django.db import models
from django.db.models import Func


class ToCharNow(Func):
    """Duplicada de apps/meu_porque/models.py e apps/metas/models.py de
    propósito — cada app migrado fica autocontido, mesmo padrão de
    duplicação deliberada já usado no Node (ver CLAUDE.md)."""

    template = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"


class DiscResposta(models.Model):
    """Aponta pra `disc_respostas`, tabela cujo DDL continua sendo dono o
    Node (src/db.js). managed=False — mesmo racional de MeuPorqueResposta/
    MetaComercial. Todos os escores (d_natural, i_natural, ..., perfil_
    dominante, arquetipo) vêm SEMPRE recalculados no servidor a partir de
    `respostas_json` (ver apps.disc.scoring) — nunca persistimos um valor
    computado que o cliente tenha mandado pronto no body.
    """

    criado_em = models.CharField(max_length=32, editable=False, db_default=ToCharNow())
    nome_participante = models.CharField(max_length=200, blank=True)
    empresa = models.CharField(max_length=200, blank=True)
    email = models.CharField(max_length=200, blank=True)

    d_natural = models.FloatField(null=True, blank=True, default=0)
    i_natural = models.FloatField(null=True, blank=True, default=0)
    s_natural = models.FloatField(null=True, blank=True, default=0)
    c_natural = models.FloatField(null=True, blank=True, default=0)

    d_adaptado = models.FloatField(null=True, blank=True, default=0)
    i_adaptado = models.FloatField(null=True, blank=True, default=0)
    s_adaptado = models.FloatField(null=True, blank=True, default=0)
    c_adaptado = models.FloatField(null=True, blank=True, default=0)

    d_intensidade = models.FloatField(null=True, blank=True, default=0)
    i_intensidade = models.FloatField(null=True, blank=True, default=0)
    s_intensidade = models.FloatField(null=True, blank=True, default=0)
    c_intensidade = models.FloatField(null=True, blank=True, default=0)

    perfil_dominante = models.CharField(max_length=16, blank=True)
    arquetipo = models.CharField(max_length=200, blank=True)

    # coluna real é TEXT contendo JSON serializado, não jsonb — por isso
    # TextField, não JSONField (mesmo motivo de equipe_json em MetaComercial).
    respostas_json = models.TextField(blank=True, default='{}')

    notificado_em = models.CharField(max_length=32, null=True, blank=True, editable=False)
    usuario = models.ForeignKey(
        'contas.Usuario',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column='usuario_id',
        related_name='disc_respostas',
    )

    class Meta:
        db_table = 'disc_respostas'
        managed = False

    def __str__(self):
        return f'DISC #{self.pk} — {self.nome_participante}'
