import pytest
from rest_framework.test import APIClient

from apps.contas.factories import EmpresaFactory, SetorFactory
from apps.contas.models import Usuario


@pytest.mark.django_db
class TestCadastroColaborador:
    def test_cadastro_valido_cria_usuario_colaborador(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        client = APIClient()

        resp = client.post('/api/auth/cadastro/colaborador/', {
            'nome': 'Fulano',
            'email': 'fulano@example.com',
            'senha': 'senha12345',
            'empresa_id': empresa.id,
            'setor_id': setor.id,
        })

        assert resp.status_code == 201
        usuario = Usuario.objects.get(email='fulano@example.com')
        assert usuario.papel == Usuario.Papel.COLABORADOR
        assert usuario.empresa_id == empresa.id
        assert usuario.setor_id == setor.id
        assert usuario.check_password('senha12345')

    def test_setor_de_outra_empresa_e_rejeitado(self):
        empresa = EmpresaFactory()
        setor_de_outra_empresa = SetorFactory()  # empresa diferente (SubFactory novo)
        client = APIClient()

        resp = client.post('/api/auth/cadastro/colaborador/', {
            'nome': 'Fulano',
            'email': 'fulano2@example.com',
            'senha': 'senha12345',
            'empresa_id': empresa.id,
            'setor_id': setor_de_outra_empresa.id,
        })

        assert resp.status_code == 400
        assert 'setor_id' in resp.data
        assert not Usuario.objects.filter(email='fulano2@example.com').exists()

    def test_email_duplicado_e_rejeitado(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        client = APIClient()
        payload = {
            'nome': 'Fulano',
            'email': 'duplicado@example.com',
            'senha': 'senha12345',
            'empresa_id': empresa.id,
            'setor_id': setor.id,
        }
        assert client.post('/api/auth/cadastro/colaborador/', payload).status_code == 201
        resp2 = client.post('/api/auth/cadastro/colaborador/', payload)
        assert resp2.status_code == 400


@pytest.mark.django_db
class TestListagemEmpresaSetor:
    def test_lista_empresas(self):
        EmpresaFactory(nome='Empresa X')
        client = APIClient()
        resp = client.get('/api/contas/empresas/')
        assert resp.status_code == 200
        assert any(e['nome'] == 'Empresa X' for e in resp.data)

    def test_lista_setores_filtrados_por_empresa(self):
        empresa1 = EmpresaFactory()
        empresa2 = EmpresaFactory()
        SetorFactory(empresa=empresa1, nome='Comercial')
        SetorFactory(empresa=empresa2, nome='Financeiro')
        client = APIClient()

        resp = client.get(f'/api/contas/setores/?empresa_id={empresa1.id}')

        assert resp.status_code == 200
        nomes = [s['nome'] for s in resp.data]
        assert nomes == ['Comercial']
