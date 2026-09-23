import pytest
from rest_framework.test import APIClient

from apps.contas.factories import UsuarioFactory


@pytest.mark.django_db
class TestLogin:
    def test_login_com_credenciais_validas(self):
        usuario = UsuarioFactory(email='login@example.com', senha='senha12345')
        client = APIClient()

        resp = client.post('/api/auth/login/', {'email': usuario.email, 'password': 'senha12345'})

        assert resp.status_code == 200
        assert 'access' in resp.data
        assert 'refresh' in resp.data

    def test_login_com_senha_errada(self):
        usuario = UsuarioFactory(email='login2@example.com', senha='senha12345')
        client = APIClient()

        resp = client.post('/api/auth/login/', {'email': usuario.email, 'password': 'errada'})

        assert resp.status_code == 401

    def test_refresh_gera_novo_access_token(self):
        UsuarioFactory(email='login3@example.com', senha='senha12345')
        client = APIClient()
        login = client.post('/api/auth/login/', {'email': 'login3@example.com', 'password': 'senha12345'})

        resp = client.post('/api/auth/refresh/', {'refresh': login.data['refresh']})

        assert resp.status_code == 200
        assert 'access' in resp.data


@pytest.mark.django_db
class TestMe:
    def test_me_sem_token(self):
        client = APIClient()
        resp = client.get('/api/auth/me/')
        assert resp.status_code == 401

    def test_me_com_token_retorna_dados_do_usuario_logado(self):
        usuario = UsuarioFactory(nome='Fulano de Tal', email='me@example.com', senha='senha12345')
        client = APIClient()
        login = client.post('/api/auth/login/', {'email': usuario.email, 'password': 'senha12345'})
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')

        resp = client.get('/api/auth/me/')

        assert resp.status_code == 200
        assert resp.data['email'] == 'me@example.com'
        assert resp.data['nome'] == 'Fulano de Tal'
        assert resp.data['papel'] == usuario.papel
        assert resp.data['empresa']['id'] == usuario.empresa_id
        assert resp.data['setor']['id'] == usuario.setor_id
