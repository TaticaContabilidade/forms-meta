from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models


class Empresa(models.Model):
    nome = models.CharField(max_length=200)
    cnpj = models.CharField(max_length=18, unique=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'empresas'

    def __str__(self):
        return self.nome


class Setor(models.Model):
    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='setores')
    nome = models.CharField(max_length=120)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'setores'
        constraints = [
            models.UniqueConstraint(fields=['empresa', 'nome'], name='uniq_setor_por_empresa'),
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
        extra_fields.setdefault('papel', Usuario.Papel.GERENTE)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superusuário precisa de is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superusuário precisa de is_superuser=True.')
        return self.create_user(email, senha, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    class Papel(models.TextChoices):
        GERENTE = 'GERENTE', 'Gerente'
        COLABORADOR = 'COLABORADOR', 'Colaborador'

    email = models.EmailField(unique=True)
    nome = models.CharField(max_length=200)
    papel = models.CharField(max_length=20, choices=Papel.choices)
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='usuarios')
    setor = models.ForeignKey(Setor, on_delete=models.PROTECT, related_name='usuarios')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nome', 'papel', 'empresa_id', 'setor_id']

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return f'{self.nome} <{self.email}>'

    def clean(self):
        super().clean()
        if self.setor_id and self.empresa_id and self.setor.empresa_id != self.empresa_id:
            raise ValidationError('O setor selecionado não pertence à empresa selecionada.')
