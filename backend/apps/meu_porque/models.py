from django.db import models
from django.db.models import Func


class ToCharNow(Func):
    """to_char(now(), 'YYYY-MM-DD HH24:MI:SS') — mesmo DEFAULT que o
    Node já usa na tabela (ver src/db.js). Usar db_default (em vez de
    deixar o Django mandar '' /NULL no INSERT) pra não mascarar o DEFAULT
    que já existe no Postgres."""

    template = "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')"


class MeuPorqueResposta(models.Model):
    """Aponta pra `meu_porque_respostas`, tabela cujo DDL continua sendo
    dono o Node (src/db.js, CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD
    COLUMN IF NOT EXISTS) — por isso managed=False: o Django nunca tenta
    criar/dropar essa tabela, só lê/escreve nela. A única exceção é a
    coluna `usuario_id` (FK nova), adicionada por uma migration RunSQL
    idempotente (0002) que espelha o mesmo estilo `IF NOT EXISTS` que o
    Node já usa, pra nunca conflitar com o boot do Node.
    """

    criado_em = models.CharField(max_length=32, editable=False, db_default=ToCharNow())
    nome_participante = models.CharField(max_length=200, blank=True)
    empresa = models.CharField(max_length=200, blank=True)
    email = models.CharField(max_length=200, blank=True)
    objetivo = models.TextField(blank=True)
    sonho = models.TextField(blank=True)
    mudanca = models.TextField(blank=True)
    visao_futuro = models.TextField(blank=True)
    notificado_em = models.CharField(max_length=32, null=True, blank=True, editable=False)
    usuario = models.ForeignKey(
        'contas.Usuario',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column='usuario_id',
        related_name='meu_porque_respostas',
    )

    class Meta:
        db_table = 'meu_porque_respostas'
        managed = False

    def __str__(self):
        return f'Meu Porquê #{self.pk} — {self.nome_participante}'
