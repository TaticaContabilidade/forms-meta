import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from apps.contas.factories import UsuarioFactory


@pytest.mark.django_db
class TestSolicitarRedefinicaoSenha:
    def test_email_existente_envia_link_e_retorna_resposta_generica(self):
        usuario = UsuarioFactory(email='existe@example.com')
        client = APIClient()

        resp = client.post('/api/auth/esqueci-senha/', {'email': usuario.email})

        assert resp.status_code == 200
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [usuario.email]
        assert '/redefinir-senha?uid=' in mail.outbox[0].body

    def test_email_inexistente_retorna_mesma_resposta_generica_sem_enviar_email(self):
        client = APIClient()

        resp = client.post('/api/auth/esqueci-senha/', {'email': 'ninguem@example.com'})

        assert resp.status_code == 200
        assert resp.data['detail'] == 'Se esse e-mail existir, enviamos um link de redefinição.'
        assert len(mail.outbox) == 0

    def test_email_invalido_retorna_400(self):
        client = APIClient()

        resp = client.post('/api/auth/esqueci-senha/', {'email': 'não é um e-mail'})

        assert resp.status_code == 400


@pytest.mark.django_db
class TestRedefinirSenha:
    def test_token_valido_redefine_senha_e_permite_login_com_a_nova(self):
        usuario = UsuarioFactory(email='redefine@example.com', senha='senhaAntiga123')
        uid = urlsafe_base64_encode(force_bytes(usuario.pk))
        token = default_token_generator.make_token(usuario)
        client = APIClient()

        resp = client.post('/api/auth/redefinir-senha/', {
            'uid': uid, 'token': token, 'nova_senha': 'senhaNovaSuperSegura123',
        })

        assert resp.status_code == 200
        login = client.post('/api/auth/login/', {
            'email': usuario.email, 'password': 'senhaNovaSuperSegura123',
        })
        assert login.status_code == 200

    def test_token_invalido_retorna_400_e_nao_muda_a_senha(self):
        usuario = UsuarioFactory(email='naoredefine@example.com', senha='senhaAntiga123')
        uid = urlsafe_base64_encode(force_bytes(usuario.pk))
        client = APIClient()

        resp = client.post('/api/auth/redefinir-senha/', {
            'uid': uid, 'token': 'token-invalido', 'nova_senha': 'outraSenhaQualquer123',
        })

        assert resp.status_code == 400
        login = client.post('/api/auth/login/', {
            'email': usuario.email, 'password': 'senhaAntiga123',
        })
        assert login.status_code == 200

    def test_uid_invalido_retorna_400(self):
        client = APIClient()

        resp = client.post('/api/auth/redefinir-senha/', {
            'uid': 'uid-que-nao-existe', 'token': 'qualquer-coisa', 'nova_senha': 'senhaQualquer123',
        })

        assert resp.status_code == 400

    def test_senha_curta_retorna_400(self):
        usuario = UsuarioFactory(email='senhacurta@example.com')
        uid = urlsafe_base64_encode(force_bytes(usuario.pk))
        token = default_token_generator.make_token(usuario)
        client = APIClient()

        resp = client.post('/api/auth/redefinir-senha/', {'uid': uid, 'token': token, 'nova_senha': 'curta'})

        assert resp.status_code == 400
