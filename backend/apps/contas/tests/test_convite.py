from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.contas.factories import (
    EmpresaFactory,
    SetorFactory,
    UsuarioAdmFactory,
    UsuarioDiretorFactory,
    UsuarioFactory,
)
from apps.contas.models import Convite, Usuario


def autenticar(client, usuario, senha='senha12345'):
    resp = client.post('/api/auth/login/', {'email': usuario.email, 'password': senha})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')


@pytest.mark.django_db
class TestCriarConvite:
    def test_colaborador_nao_pode_convidar(self):
        usuario = UsuarioFactory(senha='senha12345')
        client = APIClient()
        autenticar(client, usuario)

        resp = client.post('/api/auth/convites/', {
            'email': 'novo@example.com', 'papel': Usuario.Papel.COLABORADOR, 'setor_id': usuario.setor_id,
        })

        assert resp.status_code == 403

    def test_gerente_nao_pode_convidar(self):
        setor = SetorFactory()
        gerente = UsuarioFactory(papel=Usuario.Papel.GERENTE, empresa=setor.empresa, setor=setor, senha='senha12345')
        client = APIClient()
        autenticar(client, gerente)

        resp = client.post('/api/auth/convites/', {
            'email': 'novo@example.com', 'papel': Usuario.Papel.COLABORADOR, 'setor_id': setor.id,
        })

        assert resp.status_code == 403

    def test_diretor_convida_colaborador_do_proprio_setor(self):
        setor = SetorFactory()
        diretor = UsuarioDiretorFactory(empresa=setor.empresa, senha='senha12345')
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post('/api/auth/convites/', {
            'email': 'novo@example.com', 'papel': Usuario.Papel.COLABORADOR, 'setor_id': setor.id,
        })

        assert resp.status_code == 201
        convite = Convite.objects.get(email='novo@example.com')
        assert convite.empresa_id == setor.empresa_id
        assert convite.setor_id == setor.id
        assert convite.criado_por_id == diretor.id
        assert convite.expira_em - timezone.now() > timedelta(days=6)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['novo@example.com']

    def test_diretor_nao_consegue_convidar_pra_outra_empresa(self):
        """Mesmo mandando o empresa_id de outra empresa no body, o convite
        tem que sair com a empresa do próprio Diretor — nunca confia no
        body pra decidir o tenant (mesmo princípio do EscopoEmpresaMixin
        do dashboard-financeiro)."""
        empresa_do_diretor = EmpresaFactory()
        outra_empresa = EmpresaFactory()
        setor_da_outra_empresa = SetorFactory(empresa=outra_empresa)
        diretor = UsuarioDiretorFactory(empresa=empresa_do_diretor, senha='senha12345')
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post('/api/auth/convites/', {
            'email': 'tentativa@example.com',
            'papel': Usuario.Papel.COLABORADOR,
            'empresa_id': outra_empresa.id,
            'setor_id': setor_da_outra_empresa.id,
        })

        # O setor pertence à "outra_empresa", mas o convite é forçado pra
        # empresa do Diretor — setor de empresa diferente vira inválido.
        assert resp.status_code == 400
        assert 'setor_id' in resp.data

    def test_diretor_nao_pode_convidar_adm(self):
        setor = SetorFactory()
        diretor = UsuarioDiretorFactory(empresa=setor.empresa, senha='senha12345')
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post('/api/auth/convites/', {'email': 'novo@example.com', 'papel': Usuario.Papel.ADM})

        assert resp.status_code == 400
        assert 'papel' in resp.data

    def test_convite_de_diretor_nao_pode_ter_setor(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        diretor = UsuarioDiretorFactory(empresa=empresa, senha='senha12345')
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post('/api/auth/convites/', {
            'email': 'novodiretor@example.com', 'papel': Usuario.Papel.DIRETOR, 'setor_id': setor.id,
        })

        assert resp.status_code == 400
        assert 'setor_id' in resp.data

    def test_diretor_convida_outro_diretor_sem_setor(self):
        empresa = EmpresaFactory()
        diretor = UsuarioDiretorFactory(empresa=empresa, senha='senha12345')
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post('/api/auth/convites/', {'email': 'novodiretor@example.com', 'papel': Usuario.Papel.DIRETOR})

        assert resp.status_code == 201
        convite = Convite.objects.get(email='novodiretor@example.com')
        assert convite.setor_id is None

    def test_adm_convida_diretor_em_qualquer_empresa(self):
        empresa = EmpresaFactory()
        adm = UsuarioAdmFactory(senha='senha12345')
        client = APIClient()
        autenticar(client, adm)

        resp = client.post('/api/auth/convites/', {
            'email': 'diretornovo@example.com', 'papel': Usuario.Papel.DIRETOR, 'empresa_id': empresa.id,
        })

        assert resp.status_code == 201
        assert Convite.objects.get(email='diretornovo@example.com').empresa_id == empresa.id

    def test_adm_nao_pode_convidar_adm(self):
        adm = UsuarioAdmFactory(senha='senha12345')
        empresa = EmpresaFactory()
        client = APIClient()
        autenticar(client, adm)

        resp = client.post('/api/auth/convites/', {
            'email': 'outroadm@example.com', 'papel': Usuario.Papel.ADM, 'empresa_id': empresa.id,
        })

        assert resp.status_code == 400
        assert 'papel' in resp.data

    def test_colaborador_sem_setor_e_rejeitado(self):
        setor = SetorFactory()
        diretor = UsuarioDiretorFactory(empresa=setor.empresa, senha='senha12345')
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post('/api/auth/convites/', {'email': 'semsetor@example.com', 'papel': Usuario.Papel.COLABORADOR})

        assert resp.status_code == 400
        assert 'setor_id' in resp.data


@pytest.mark.django_db
class TestListarERevogarConvite:
    def test_diretor_ve_so_convites_da_propria_empresa(self):
        empresa = EmpresaFactory()
        outra_empresa = EmpresaFactory()
        diretor = UsuarioDiretorFactory(empresa=empresa, senha='senha12345')
        Convite.objects.create(
            empresa=empresa, papel=Usuario.Papel.DIRETOR, email='a@example.com',
            criado_por=diretor, expira_em=timezone.now() + timedelta(days=7),
        )
        Convite.objects.create(
            empresa=outra_empresa, papel=Usuario.Papel.DIRETOR, email='b@example.com',
            criado_por=UsuarioDiretorFactory(empresa=outra_empresa), expira_em=timezone.now() + timedelta(days=7),
        )
        client = APIClient()
        autenticar(client, diretor)

        resp = client.get('/api/auth/convites/lista/')

        emails = [c['email'] for c in resp.data]
        assert emails == ['a@example.com']

    def test_colaborador_nao_lista_convites(self):
        usuario = UsuarioFactory(senha='senha12345')
        client = APIClient()
        autenticar(client, usuario)

        resp = client.get('/api/auth/convites/lista/')

        assert resp.status_code == 403

    def test_revogar_convite_pendente(self):
        setor = SetorFactory()
        diretor = UsuarioDiretorFactory(empresa=setor.empresa, senha='senha12345')
        convite = Convite.objects.create(
            empresa=setor.empresa, setor=setor, papel=Usuario.Papel.COLABORADOR, email='a@example.com',
            criado_por=diretor, expira_em=timezone.now() + timedelta(days=7),
        )
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post(f'/api/auth/convites/{convite.id}/revogar/')

        assert resp.status_code == 200
        convite.refresh_from_db()
        assert convite.revogado_em is not None
        assert convite.pendente is False

    def test_diretor_nao_revoga_convite_de_outra_empresa(self):
        empresa = EmpresaFactory()
        outra_empresa = EmpresaFactory()
        diretor = UsuarioDiretorFactory(empresa=empresa, senha='senha12345')
        convite_alheio = Convite.objects.create(
            empresa=outra_empresa, papel=Usuario.Papel.DIRETOR, email='alheio@example.com',
            criado_por=UsuarioDiretorFactory(empresa=outra_empresa), expira_em=timezone.now() + timedelta(days=7),
        )
        client = APIClient()
        autenticar(client, diretor)

        resp = client.post(f'/api/auth/convites/{convite_alheio.id}/revogar/')

        assert resp.status_code == 404


@pytest.mark.django_db
class TestAceitarConvite:
    def _convite(self, **kwargs):
        setor = kwargs.pop('setor', None)
        empresa = kwargs.pop('empresa', None) or (setor.empresa if setor else EmpresaFactory())
        papel = kwargs.pop('papel', Usuario.Papel.COLABORADOR)
        if setor is None and papel != Usuario.Papel.DIRETOR:
            setor = SetorFactory(empresa=empresa)
        defaults = {
            'empresa': empresa, 'setor': setor, 'papel': papel, 'email': 'convidado@example.com',
            'criado_por': UsuarioAdmFactory(), 'expira_em': timezone.now() + timedelta(days=7),
        }
        defaults.update(kwargs)
        return Convite.objects.create(**defaults)

    def test_aceita_convite_valido_e_cria_usuario(self):
        convite = self._convite()
        client = APIClient()

        resp = client.post('/api/auth/convites/aceitar/', {
            'token': convite.token, 'nome': 'Fulano', 'senha': 'senhaNova123',
        })

        assert resp.status_code == 201
        usuario = Usuario.objects.get(email='convidado@example.com')
        assert usuario.nome == 'Fulano'
        assert usuario.papel == convite.papel
        assert usuario.empresa_id == convite.empresa_id
        assert usuario.setor_id == convite.setor_id
        assert usuario.check_password('senhaNova123')
        convite.refresh_from_db()
        assert convite.aceito_em is not None

        login = client.post('/api/auth/login/', {'email': 'convidado@example.com', 'password': 'senhaNova123'})
        assert login.status_code == 200

    def test_token_ja_aceito_e_rejeitado(self):
        convite = self._convite()
        client = APIClient()
        client.post('/api/auth/convites/aceitar/', {'token': convite.token, 'nome': 'Fulano', 'senha': 'senhaNova123'})

        resp = client.post('/api/auth/convites/aceitar/', {
            'token': convite.token, 'nome': 'Outro', 'senha': 'outraSenha123',
        })

        assert resp.status_code == 400

    def test_token_revogado_e_rejeitado(self):
        convite = self._convite(revogado_em=timezone.now())
        client = APIClient()

        resp = client.post('/api/auth/convites/aceitar/', {
            'token': convite.token, 'nome': 'Fulano', 'senha': 'senhaNova123',
        })

        assert resp.status_code == 400

    def test_token_expirado_e_rejeitado(self):
        convite = self._convite(expira_em=timezone.now() - timedelta(seconds=1))
        client = APIClient()

        resp = client.post('/api/auth/convites/aceitar/', {
            'token': convite.token, 'nome': 'Fulano', 'senha': 'senhaNova123',
        })

        assert resp.status_code == 400

    def test_token_invalido_e_rejeitado(self):
        client = APIClient()

        resp = client.post('/api/auth/convites/aceitar/', {
            'token': 'token-que-nao-existe', 'nome': 'Fulano', 'senha': 'senhaNova123',
        })

        assert resp.status_code == 400

    def test_aceita_convite_de_diretor_sem_setor(self):
        convite = self._convite(papel=Usuario.Papel.DIRETOR, setor=None)
        client = APIClient()

        resp = client.post('/api/auth/convites/aceitar/', {
            'token': convite.token, 'nome': 'Diretora Nova', 'senha': 'senhaNova123',
        })

        assert resp.status_code == 201
        usuario = Usuario.objects.get(email='convidado@example.com')
        assert usuario.papel == Usuario.Papel.DIRETOR
        assert usuario.setor_id is None
