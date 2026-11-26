import pytest
from rest_framework.test import APIClient

from apps.contas.factories import EmpresaFactory, SetorFactory, UsuarioAdmFactory, UsuarioFactory


def autenticar(client, usuario, senha='senha12345'):
    resp = client.post('/api/auth/login/', {'email': usuario.email, 'password': senha})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')


@pytest.mark.django_db
class TestEmpresaListView:
    def test_sem_autenticacao_retorna_401(self):
        client = APIClient()
        resp = client.get('/api/contas/empresas/')
        assert resp.status_code == 401

    def test_colaborador_ve_so_a_propria_empresa(self):
        empresa = EmpresaFactory(nome='Minha Empresa')
        outra_empresa = EmpresaFactory(nome='Empresa Alheia')
        setor = SetorFactory(empresa=empresa)
        usuario = UsuarioFactory(empresa=empresa, setor=setor, senha='senha12345')
        client = APIClient()
        autenticar(client, usuario)

        resp = client.get('/api/contas/empresas/')

        assert resp.status_code == 200
        nomes = [e['nome'] for e in resp.data]
        assert nomes == ['Minha Empresa']
        assert outra_empresa.nome not in nomes

    def test_adm_ve_todas_as_empresas(self):
        EmpresaFactory(nome='Empresa X')
        EmpresaFactory(nome='Empresa Y')
        adm = UsuarioAdmFactory(senha='senha12345')
        client = APIClient()
        autenticar(client, adm)

        resp = client.get('/api/contas/empresas/')

        nomes = {e['nome'] for e in resp.data}
        assert {'Empresa X', 'Empresa Y'} <= nomes


@pytest.mark.django_db
class TestSetorListView:
    def test_colaborador_so_ve_setores_da_propria_empresa_mesmo_pedindo_outra(self):
        empresa = EmpresaFactory()
        outra_empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa, nome='Meu Setor')
        SetorFactory(empresa=outra_empresa, nome='Setor Alheio')
        usuario = UsuarioFactory(empresa=empresa, setor=setor, senha='senha12345')
        client = APIClient()
        autenticar(client, usuario)

        # Mesmo pedindo explicitamente a empresa alheia via query string,
        # quem não é ADM nunca sai do escopo da própria empresa.
        resp = client.get(f'/api/contas/setores/?empresa_id={outra_empresa.id}')

        nomes = [s['nome'] for s in resp.data]
        assert nomes == ['Meu Setor']

    def test_adm_filtra_por_empresa_id_quando_informado(self):
        empresa1 = EmpresaFactory()
        empresa2 = EmpresaFactory()
        SetorFactory(empresa=empresa1, nome='Comercial')
        SetorFactory(empresa=empresa2, nome='Financeiro')
        adm = UsuarioAdmFactory(senha='senha12345')
        client = APIClient()
        autenticar(client, adm)

        resp = client.get(f'/api/contas/setores/?empresa_id={empresa1.id}')

        nomes = [s['nome'] for s in resp.data]
        assert nomes == ['Comercial']
