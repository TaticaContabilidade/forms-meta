import factory

from .models import Empresa, Setor, Usuario


def _cnpj_fake(n):
    """CNPJ fake de teste, sempre com exatamente 14 dígitos (formato
    NN.NNN.NNN/NNNN-NN, 18 caracteres, igual ao max_length de Empresa.cnpj)
    — independe de quantos dígitos `n` (sequência do factory_boy) tenha."""
    digitos = f'{n:014d}'
    return f'{digitos[0:2]}.{digitos[2:5]}.{digitos[5:8]}/{digitos[8:12]}-{digitos[12:14]}'


class EmpresaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Empresa

    nome = factory.Sequence(lambda n: f'Empresa Teste {n}')
    cnpj = factory.Sequence(lambda n: _cnpj_fake(n))


class SetorFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Setor

    empresa = factory.SubFactory(EmpresaFactory)
    nome = factory.Sequence(lambda n: f'Setor Teste {n}')


class UsuarioFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Usuario
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f'usuario{n}@example.com')
    nome = factory.Sequence(lambda n: f'Usuario Teste {n}')
    papel = Usuario.Papel.COLABORADOR
    empresa = factory.SubFactory(EmpresaFactory)
    setor = factory.SubFactory(SetorFactory, empresa=factory.SelfAttribute('..empresa'))

    @factory.post_generation
    def senha(self, create, extracted, **kwargs):
        self.set_password(extracted or 'senha12345')
        if create:
            self.save()
