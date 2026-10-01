import json

import pytest
from rest_framework.test import APIClient

from apps.contas.factories import EmpresaFactory, SetorFactory, UsuarioFactory
from apps.contas.models import Usuario
from apps.disc.models import DiscResposta
from apps.disc.scoring import BLOCOS_A

# Todo bloco: mais=0 (D), menos=1 (I) -- mesma ordem D,I,S,C em todos os
# 28 blocos (ver scoring.py). natural = {D:0, I:28, S:0, C:0} (traço do
# Menos); adaptado = {D:28, I:0, S:0, C:0} (traço do Mais).
RESPOSTAS_A_COMPLETAS = {str(i): {'mais': 0, 'menos': 1} for i in range(len(BLOCOS_A))}
# 12 afirmações, todas nota 5 -- intensidade D=I=S=C=5.
RESPOSTAS_C_COMPLETAS = {str(i): 5 for i in range(12)}

PAYLOAD_VALIDO = {
    'respostas': {'a': RESPOSTAS_A_COMPLETAS, 'c': RESPOSTAS_C_COMPLETAS},
}

# shape pra criar direto via ORM nos testes de listagem/escopo/PDF, onde só
# a identidade/escopo importa, não o cálculo.
RESPOSTA_DIRETA = {
    'd_natural': 0, 'i_natural': 28, 's_natural': 0, 'c_natural': 0,
    'd_adaptado': 28, 'i_adaptado': 0, 's_adaptado': 0, 'c_adaptado': 0,
    'd_intensidade': 5, 'i_intensidade': 5, 's_intensidade': 5, 'c_intensidade': 5,
    'perfil_dominante': 'I', 'arquetipo': 'O Comunicador', 'respostas_json': '{}',
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

        resp = client.post('/api/disc/respostas/', PAYLOAD_VALIDO, format='json')

        assert resp.status_code == 201
        resposta = DiscResposta.objects.get(pk=resp.data['id'])
        assert resposta.usuario_id == colaborador.id
        assert resposta.nome_participante == 'Colaborador X'
        assert resposta.empresa == 'Tatica Teste'
        assert resposta.email == 'colab@example.com'
        assert resposta.criado_em

    def test_calcula_natural_adaptado_intensidade_a_partir_das_respostas_cruas(self):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.post('/api/disc/respostas/', PAYLOAD_VALIDO, format='json')

        assert resp.status_code == 201
        resposta = DiscResposta.objects.get(pk=resp.data['id'])
        assert (resposta.d_natural, resposta.i_natural, resposta.s_natural, resposta.c_natural) == (0, 28, 0, 0)
        assert (resposta.d_adaptado, resposta.i_adaptado, resposta.s_adaptado, resposta.c_adaptado) == (28, 0, 0, 0)
        assert resposta.d_intensidade == 5 and resposta.i_intensidade == 5
        assert resposta.perfil_dominante == 'I'
        assert resposta.arquetipo == 'O Comunicador'
        assert json.loads(resposta.respostas_json) == PAYLOAD_VALIDO['respostas']

    def test_recalcula_no_servidor_mesmo_com_valores_forjados_no_body(self):
        """Teste mais importante desta fatia: o cliente manda escores
        computados fabricados -- o servidor ignora e recalcula a partir
        das respostas cruas."""
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(
            PAYLOAD_VALIDO,
            d_natural=999, i_natural=999, s_natural=999, c_natural=999,
            perfil_dominante='C', arquetipo='O Analista',
        )
        resp = client.post('/api/disc/respostas/', payload, format='json')

        assert resp.status_code == 201
        resposta = DiscResposta.objects.get(pk=resp.data['id'])
        assert resposta.i_natural == 28
        assert resposta.d_natural == 0
        assert resposta.perfil_dominante == 'I'
        assert resposta.arquetipo == 'O Comunicador'

    def test_bloco_com_mais_igual_menos_e_ignorado_no_calculo(self):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        respostas_a = dict(RESPOSTAS_A_COMPLETAS)
        respostas_a['0'] = {'mais': 2, 'menos': 2}  # inválido -- não deveria contar
        payload = {'respostas': {'a': respostas_a, 'c': RESPOSTAS_C_COMPLETAS}}
        resp = client.post('/api/disc/respostas/', payload, format='json')

        assert resp.status_code == 201
        resposta = DiscResposta.objects.get(pk=resp.data['id'])
        # 27 blocos válidos em vez de 28 (bloco 0 foi descartado)
        assert resposta.i_natural == 27
        assert resposta.d_adaptado == 27

    def test_respostas_vazias_ainda_cria_resposta_com_escores_zerados(self):
        """Mesma permissividade do Node -- não valida completude das 40
        respostas no servidor (só o client-side faz essa checagem)."""
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.post('/api/disc/respostas/', {'respostas': {'a': {}, 'c': {}}}, format='json')

        assert resp.status_code == 201
        resposta = DiscResposta.objects.get(pk=resp.data['id'])
        assert (resposta.d_natural, resposta.i_natural, resposta.s_natural, resposta.c_natural) == (0, 0, 0, 0)
        # todos zerados -> ranking determinístico D,I,S,C -> combinado D+I
        assert resposta.perfil_dominante == 'D+I'

    def test_sem_autenticacao_retorna_401(self):
        client = APIClient()
        resp = client.post('/api/disc/respostas/', PAYLOAD_VALIDO, format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestEscopoListagem:
    def test_colaborador_ve_so_as_proprias_respostas(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        colaborador1 = UsuarioFactory(empresa=empresa, setor=setor)
        colaborador2 = UsuarioFactory(empresa=empresa, setor=setor)

        DiscResposta.objects.create(usuario=colaborador1, **RESPOSTA_DIRETA)
        DiscResposta.objects.create(usuario=colaborador2, **RESPOSTA_DIRETA)

        client = APIClient()
        autenticar(client, colaborador1)
        resp = client.get('/api/disc/respostas/')

        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_gerente_ve_respostas_do_seu_setor_mas_nao_de_outro_setor(self):
        empresa = EmpresaFactory()
        setor_comercial = SetorFactory(empresa=empresa, nome='Comercial')
        setor_financeiro = SetorFactory(empresa=empresa, nome='Financeiro')
        gerente = UsuarioFactory(papel=Usuario.Papel.GERENTE, empresa=empresa, setor=setor_comercial)
        colaborador_mesmo_setor = UsuarioFactory(empresa=empresa, setor=setor_comercial)
        colaborador_outro_setor = UsuarioFactory(empresa=empresa, setor=setor_financeiro)

        resposta_mesmo_setor = DiscResposta.objects.create(usuario=colaborador_mesmo_setor, **RESPOSTA_DIRETA)
        DiscResposta.objects.create(usuario=colaborador_outro_setor, **RESPOSTA_DIRETA)

        client = APIClient()
        autenticar(client, gerente)
        resp = client.get('/api/disc/respostas/')

        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data]
        assert ids == [resposta_mesmo_setor.id]


@pytest.mark.django_db
class TestPdf:
    def test_pdf_do_dono_retorna_200(self):
        colaborador = UsuarioFactory(nome='Fulano de Tal')
        resposta = DiscResposta.objects.create(
            usuario=colaborador, nome_participante=colaborador.nome, **RESPOSTA_DIRETA
        )
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/disc/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/pdf'
        assert 'Fulano de Tal perfil disc.pdf' in resp['Content-Disposition']
        assert resp.content.startswith(b'%PDF-')

    def test_pdf_sem_nome_participante_usa_nome_de_arquivo_padrao(self):
        colaborador = UsuarioFactory()
        resposta = DiscResposta.objects.create(usuario=colaborador, **RESPOSTA_DIRETA)  # nome_participante em branco
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/disc/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert 'Perfil DISC.pdf' in resp['Content-Disposition']

    def test_pdf_fora_do_escopo_retorna_404(self):
        empresa = EmpresaFactory()
        setor1 = SetorFactory(empresa=empresa)
        setor2 = SetorFactory(empresa=empresa)
        colaborador = UsuarioFactory(empresa=empresa, setor=setor1)
        outro_colaborador = UsuarioFactory(empresa=empresa, setor=setor2)
        resposta = DiscResposta.objects.create(usuario=outro_colaborador, **RESPOSTA_DIRETA)

        client = APIClient()
        autenticar(client, colaborador)
        resp = client.get(f'/api/disc/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 404
