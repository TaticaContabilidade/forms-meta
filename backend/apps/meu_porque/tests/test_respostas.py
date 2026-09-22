import pytest
from rest_framework.test import APIClient

from apps.contas.factories import EmpresaFactory, SetorFactory, UsuarioFactory
from apps.contas.models import Usuario
from apps.meu_porque.models import MeuPorqueResposta

PAYLOAD_VALIDO = {
    'objetivo': 'Crescer o comercial',
    'sonho': 'Ter uma equipe estruturada',
    'mudanca': 'Ser mais disciplinado',
    'visao_futuro': 'Empresa referência no setor',
}


def autenticar(client, usuario, senha='senha12345'):
    login = client.post('/api/auth/login/', {'email': usuario.email, 'password': senha})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')


@pytest.mark.django_db
class TestCriarResposta:
    def test_cria_resposta_com_identidade_derivada_do_usuario_logado(self):
        empresa = EmpresaFactory(nome='Tatica Teste')
        setor = SetorFactory(empresa=empresa)
        colaborador = UsuarioFactory(nome='Colaborador X', email='colab@example.com', empresa=empresa, setor=setor)
        client = APIClient()
        autenticar(client, colaborador)

        # tenta injetar nome/empresa/email diferentes no body -- devem ser ignorados
        payload = dict(PAYLOAD_VALIDO, nome_participante='Outro Nome', empresa='Outra Empresa', email='outro@x.com')
        resp = client.post('/api/meu-porque/respostas/', payload)

        assert resp.status_code == 201
        resposta = MeuPorqueResposta.objects.get(pk=resp.data['id'])
        assert resposta.usuario_id == colaborador.id
        assert resposta.nome_participante == 'Colaborador X'
        assert resposta.empresa == 'Tatica Teste'
        assert resposta.email == 'colab@example.com'
        assert resposta.criado_em  # veio do DEFAULT do Postgres, não vazio

    def test_pergunta_em_branco_e_rejeitada(self):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(PAYLOAD_VALIDO, objetivo='')
        resp = client.post('/api/meu-porque/respostas/', payload)

        assert resp.status_code == 400
        assert 'objetivo' in resp.data

    def test_sem_autenticacao_retorna_401(self):
        client = APIClient()
        resp = client.post('/api/meu-porque/respostas/', PAYLOAD_VALIDO)
        assert resp.status_code == 401


@pytest.mark.django_db
class TestEscopoListagem:
    def test_colaborador_ve_so_as_proprias_respostas(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        colaborador1 = UsuarioFactory(empresa=empresa, setor=setor)
        colaborador2 = UsuarioFactory(empresa=empresa, setor=setor)

        MeuPorqueResposta.objects.create(usuario=colaborador1, **PAYLOAD_VALIDO)
        MeuPorqueResposta.objects.create(usuario=colaborador2, **PAYLOAD_VALIDO)

        client = APIClient()
        autenticar(client, colaborador1)
        resp = client.get('/api/meu-porque/respostas/')

        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_gerente_ve_respostas_do_seu_setor_mas_nao_de_outro_setor(self):
        empresa = EmpresaFactory()
        setor_comercial = SetorFactory(empresa=empresa, nome='Comercial')
        setor_financeiro = SetorFactory(empresa=empresa, nome='Financeiro')
        gerente = UsuarioFactory(papel=Usuario.Papel.GERENTE, empresa=empresa, setor=setor_comercial)
        colaborador_mesmo_setor = UsuarioFactory(empresa=empresa, setor=setor_comercial)
        colaborador_outro_setor = UsuarioFactory(empresa=empresa, setor=setor_financeiro)

        resposta_mesmo_setor = MeuPorqueResposta.objects.create(usuario=colaborador_mesmo_setor, **PAYLOAD_VALIDO)
        MeuPorqueResposta.objects.create(usuario=colaborador_outro_setor, **PAYLOAD_VALIDO)

        client = APIClient()
        autenticar(client, gerente)
        resp = client.get('/api/meu-porque/respostas/')

        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data]
        assert ids == [resposta_mesmo_setor.id]


@pytest.mark.django_db
class TestPdf:
    def test_pdf_do_dono_retorna_200(self):
        colaborador = UsuarioFactory(nome='Fulano de Tal')
        resposta = MeuPorqueResposta.objects.create(
            usuario=colaborador, nome_participante=colaborador.nome, **PAYLOAD_VALIDO
        )
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/meu-porque/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/pdf'
        assert 'Fulano de Tal meu porque.pdf' in resp['Content-Disposition']
        assert resp.content.startswith(b'%PDF-')

    def test_pdf_sem_nome_participante_usa_nome_de_arquivo_padrao(self):
        colaborador = UsuarioFactory()
        resposta = MeuPorqueResposta.objects.create(usuario=colaborador, **PAYLOAD_VALIDO)  # nome_participante em branco de propósito
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/meu-porque/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert 'Meu Porque.pdf' in resp['Content-Disposition']

    def test_pdf_fora_do_escopo_retorna_404(self):
        empresa = EmpresaFactory()
        setor1 = SetorFactory(empresa=empresa)
        setor2 = SetorFactory(empresa=empresa)
        colaborador = UsuarioFactory(empresa=empresa, setor=setor1)
        outro_colaborador = UsuarioFactory(empresa=empresa, setor=setor2)
        resposta = MeuPorqueResposta.objects.create(usuario=outro_colaborador, **PAYLOAD_VALIDO)

        client = APIClient()
        autenticar(client, colaborador)
        resp = client.get(f'/api/meu-porque/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 404
