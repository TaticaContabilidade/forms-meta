import secrets

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Empresa(models.Model):
    nome = models.CharField(max_length=200)
    cnpj = models.CharField(max_length=18, unique=True)
    # Marca a Tática mesma (sempre 1 só) — nunca usar pra decidir acesso
    # ao Financeiro, que virou multiempresa (ver CLAUDE.md, D-32 no repo
    # dashboard-financeiro): cada empresa cliente acessa só o próprio
    # Omie. `empresa_interna` hoje só identifica qual linha é a Tática.
    empresa_interna = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'empresas'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa_interna'], condition=Q(empresa_interna=True), name='uniq_empresa_interna',
            ),
        ]

    def __str__(self):
        return self.nome


class Setor(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='setores')
    nome = models.CharField(max_length=120)
    # Marcador fixo, nunca por nome (ver CLAUDE.md) — decide quem acessa
    # o Financeiro da empresa (junto com o papel do usuário).
    setor_financeiro = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'setores'
        constraints = [
            models.UniqueConstraint(fields=['empresa', 'nome'], name='uniq_setor_por_empresa'),
            models.UniqueConstraint(
                fields=['empresa'], condition=Q(setor_financeiro=True), name='uniq_setor_financeiro_por_empresa',
            ),
        ]

    def __str__(self):
        return f'{self.nome} ({self.empresa.nome})'


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, senha=None, **extra_fields):
        if not email:
            raise ValueError('email é obrigatório.')
        usuario = self.model(email=self.normalize_email(email), **extra_fields)
        usuario.set_password(senha)
        usuario.full_clean(exclude=['password'])
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, senha=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        # ADM substitui a ideia antiga de "superusuário = Gerente" — é o
        # único papel que não pertence a nenhuma empresa/setor (ver
        # Usuario.clean() abaixo e CLAUDE.md, seção "Redesenho do login").
        extra_fields.setdefault('papel', Usuario.Papel.ADM)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superusuário precisa de is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superusuário precisa de is_superuser=True.')
        return self.create_user(email, senha, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    class Papel(models.TextChoices):
        ADM = 'ADM', 'Admin'
        DIRETOR = 'DIRETOR', 'Diretor'
        GERENTE = 'GERENTE', 'Gerente'
        COLABORADOR = 'COLABORADOR', 'Colaborador'

    email = models.EmailField(unique=True)
    nome = models.CharField(max_length=200)
    papel = models.CharField(max_length=20, choices=Papel.choices)
    # Nullable pra caber o ADM (não pertence a nenhuma empresa/setor) e o
    # Diretor (pertence a uma empresa, mas administra ela inteira, não um
    # setor específico) — a obrigatoriedade por papel é imposta em
    # clean(), não no banco, porque "obrigatório pra esses 2 papéis, não
    # pros outros 2" não dá pra expressar só com null=False.
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='usuarios', null=True, blank=True)
    setor = models.ForeignKey(Setor, on_delete=models.PROTECT, related_name='usuarios', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nome']

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return f'{self.nome} <{self.email}>'

    def clean(self):
        super().clean()

        if self.papel == self.Papel.ADM:
            if self.empresa_id or self.setor_id:
                raise ValidationError('ADM é acesso master à plataforma — não pertence a empresa nem setor.')
            return

        if not self.empresa_id:
            raise ValidationError({'empresa': 'Obrigatório pra esse papel.'})

        if self.papel == self.Papel.DIRETOR:
            if self.setor_id:
                raise ValidationError({'setor': 'Diretor administra a empresa inteira, não um setor específico.'})
            return

        # GERENTE / COLABORADOR
        if not self.setor_id:
            raise ValidationError({'setor': 'Obrigatório pra esse papel.'})
        if self.setor.empresa_id != self.empresa_id:
            raise ValidationError({'setor': 'O setor selecionado não pertence à empresa selecionada.'})


def gerar_token_convite():
    return secrets.token_urlsafe(32)


class Convite(models.Model):
    """Única porta de entrada na plataforma (ver CLAUDE.md, "Redesenho do
    login") — substitui o cadastro aberto por lista pública de empresas.

    Token aleatório simples (`secrets.token_urlsafe`), não o
    `default_token_generator` stateless que a redefinição de senha usa:
    aquele gerador deriva o hash de um `Usuario` já existente (pk, senha,
    last_login) — aqui ainda não existe usuário nenhum até o convite ser
    aceito. Como o próprio `Convite` já é uma linha de banco com estado
    (`aceito_em`/`revogado_em`/`expira_em`), um token aleatório simples
    validado contra esse estado é mais natural do que forçar o gerador
    de senha a caber num formato que ele não foi pensado pra resolver.
    """

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='convites')
    # Nulo quando papel=DIRETOR (administra a empresa inteira, sem setor
    # específico) — mesma regra de Usuario.setor.
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='convites', null=True, blank=True)
    papel = models.CharField(max_length=20, choices=Usuario.Papel.choices)
    email = models.EmailField()
    token = models.CharField(max_length=64, unique=True, editable=False, default=gerar_token_convite)
    criado_por = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='convites_criados')
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()
    aceito_em = models.DateTimeField(null=True, blank=True)
    revogado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'convites'

    def __str__(self):
        return f'Convite {self.papel} · {self.email} · {self.empresa.nome}'

    @property
    def pendente(self):
        return self.aceito_em is None and self.revogado_em is None and timezone.now() < self.expira_em

    def clean(self):
        super().clean()
        if self.papel == Usuario.Papel.ADM:
            raise ValidationError({'papel': 'ADM nunca é convidado — só criado pelo Django admin.'})
        if self.papel == Usuario.Papel.DIRETOR:
            if self.setor_id:
                raise ValidationError({'setor': 'Convite de Diretor não tem setor (administra a empresa inteira).'})
        else:
            if not self.setor_id:
                raise ValidationError({'setor': 'Obrigatório pra esse papel.'})
            if self.setor.empresa_id != self.empresa_id:
                raise ValidationError({'setor': 'O setor não pertence à empresa do convite.'})
