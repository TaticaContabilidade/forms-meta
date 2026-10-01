import json

import pytest
from rest_framework.test import APIClient

from apps.contas.factories import EmpresaFactory, SetorFactory, UsuarioFactory
from apps.contas.models import Usuario
from apps.metas.models import MetaComercial

PAYLOAD_VALIDO = {
    'faturamento': 100000,
    'crescimento_pct': 20,
    'churn_pct': 10,
    'ticket': 2000,
    'conversao_pct': 25,
    'contatos_mes_passado': 10,
    'hunter_valor': 1000,
    'equipe': [{'nome': 'Vendedor 1', 'tipo': 'Hunter', 'meta': 500}],
}

# shape pra criar direto via ORM (bypass do calculo.py) nos testes de
# listagem/escopo/PDF, onde só a identidade/escopo importa, não a conta.
RESPOSTA_DIRETA = {
    'faturamento': 100000, 'crescimento_pct': 20, 'churn_pct': 10,
    'meta_anual': 30000, 'meta_trimestral': 7500, 'meta_mensal': 2500,
    'ticket': 2000, 'contratos_mes': 1.2, 'conversao_pct': 25,
    'contatos_necessarios': 5, 'contatos_mes_passado': 10,
    'hunter_valor': 1000, 'farmer_valor': 1500, 'equipe_json': '[]',
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

        payload = dict(PAYLOAD_VALIDO, nome_participante='Outro Nome', empresa='Outra Empresa', email='outro@x.com')
        resp = client.post('/api/metas/respostas/', payload, format='json')

        assert resp.status_code == 201
        resposta = MetaComercial.objects.get(pk=resp.data['id'])
        assert resposta.usuario_id == colaborador.id
        assert resposta.nome_participante == 'Colaborador X'
        assert resposta.empresa == 'Tatica Teste'
        assert resposta.email == 'colab@example.com'
        assert resposta.criado_em

    def test_recalcula_no_servidor_mesmo_com_valores_forjados_no_body(self):
        """Teste mais importante desta fatia: o cliente manda valores
        computados fabricados -- o servidor ignora e recalcula a partir
        dos campos brutos."""
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(
            PAYLOAD_VALIDO,
            meta_anual=999999, meta_trimestral=999999, meta_mensal=999999,
            contratos_mes=999999, contatos_necessarios=999999, farmer_valor=999999,
        )
        resp = client.post('/api/metas/respostas/', payload, format='json')

        assert resp.status_code == 201
        resposta = MetaComercial.objects.get(pk=resp.data['id'])
        assert resposta.meta_anual == 30000  # 100000*0.20 + 100000*0.10
        assert resposta.meta_mensal == 2500
        assert resposta.contratos_mes == 1.2
        assert resposta.contatos_necessarios == 5
        assert resposta.farmer_valor == 1500  # 2500 - 1000

    def test_equipe_sem_nome_e_descartada_no_banco(self):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(PAYLOAD_VALIDO, equipe=[
            {'nome': '', 'tipo': 'Hunter', 'meta': 500},
            {'nome': 'Fulano', 'tipo': 'Farmer', 'meta': 300},
        ])
        resp = client.post('/api/metas/respostas/', payload, format='json')

        assert resp.status_code == 201
        resposta = MetaComercial.objects.get(pk=resp.data['id'])
        equipe = json.loads(resposta.equipe_json)
        assert len(equipe) == 1
        assert equipe[0]['nome'] == 'Fulano'

    @pytest.mark.parametrize('campo,valor', [
        ('faturamento', None),
        ('faturamento', 0),
        ('faturamento', -100),
        ('ticket', None),
        ('ticket', 0),
        ('conversao_pct', None),
        ('conversao_pct', 0),
        ('conversao_pct', 150),
        ('crescimento_pct', 501),
        ('churn_pct', 101),
    ])
    def test_regras_obrigatorias_rejeitadas_com_400(self, campo, valor):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(PAYLOAD_VALIDO)
        if valor is None:
            del payload[campo]
        else:
            payload[campo] = valor
        resp = client.post('/api/metas/respostas/', payload, format='json')

        assert resp.status_code == 400
        assert campo in resp.data

    @pytest.mark.parametrize('campo', ['crescimento_pct', 'churn_pct'])
    def test_percentual_zero_e_valido(self, campo):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(PAYLOAD_VALIDO, **{campo: 0})
        resp = client.post('/api/metas/respostas/', payload, format='json')

        assert resp.status_code == 201

    def test_contatos_mes_passado_e_hunter_valor_negativos_viram_zero(self):
        colaborador = UsuarioFactory()
        client = APIClient()
        autenticar(client, colaborador)

        payload = dict(PAYLOAD_VALIDO, contatos_mes_passado=-5, hunter_valor=-10)
        resp = client.post('/api/metas/respostas/', payload, format='json')

        assert resp.status_code == 201
        resposta = MetaComercial.objects.get(pk=resp.data['id'])
        assert resposta.contatos_mes_passado == 0
        assert resposta.hunter_valor == 0

    def test_sem_autenticacao_retorna_401(self):
        client = APIClient()
        resp = client.post('/api/metas/respostas/', PAYLOAD_VALIDO, format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestEscopoListagem:
    def test_colaborador_ve_so_as_proprias_respostas(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        colaborador1 = UsuarioFactory(empresa=empresa, setor=setor)
        colaborador2 = UsuarioFactory(empresa=empresa, setor=setor)

        MetaComercial.objects.create(usuario=colaborador1, **RESPOSTA_DIRETA)
        MetaComercial.objects.create(usuario=colaborador2, **RESPOSTA_DIRETA)

        client = APIClient()
        autenticar(client, colaborador1)
        resp = client.get('/api/metas/respostas/')

        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_gerente_ve_respostas_do_seu_setor_mas_nao_de_outro_setor(self):
        empresa = EmpresaFactory()
        setor_comercial = SetorFactory(empresa=empresa, nome='Comercial')
        setor_financeiro = SetorFactory(empresa=empresa, nome='Financeiro')
        gerente = UsuarioFactory(papel=Usuario.Papel.GERENTE, empresa=empresa, setor=setor_comercial)
        colaborador_mesmo_setor = UsuarioFactory(empresa=empresa, setor=setor_comercial)
        colaborador_outro_setor = UsuarioFactory(empresa=empresa, setor=setor_financeiro)

        resposta_mesmo_setor = MetaComercial.objects.create(usuario=colaborador_mesmo_setor, **RESPOSTA_DIRETA)
        MetaComercial.objects.create(usuario=colaborador_outro_setor, **RESPOSTA_DIRETA)

        client = APIClient()
        autenticar(client, gerente)
        resp = client.get('/api/metas/respostas/')

        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data]
        assert ids == [resposta_mesmo_setor.id]


@pytest.mark.django_db
class TestPdf:
    def test_pdf_do_dono_retorna_200(self):
        colaborador = UsuarioFactory(nome='Fulano de Tal')
        resposta = MetaComercial.objects.create(
            usuario=colaborador, nome_participante=colaborador.nome, **RESPOSTA_DIRETA
        )
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/metas/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/pdf'
        assert 'Fulano de Tal meta comercial.pdf' in resp['Content-Disposition']
        assert resp.content.startswith(b'%PDF-')

    def test_pdf_sem_nome_participante_usa_nome_de_arquivo_padrao(self):
        colaborador = UsuarioFactory()
        resposta = MetaComercial.objects.create(usuario=colaborador, **RESPOSTA_DIRETA)
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/metas/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert 'Meta comercial.pdf' in resp['Content-Disposition']

    def test_pdf_com_equipe_e_callouts(self):
        colaborador = UsuarioFactory(nome='Fulano de Tal')
        dados = dict(RESPOSTA_DIRETA, equipe_json=json.dumps([
            {'nome': 'Vendedor 1', 'tipo': 'Hunter', 'meta': 1000},
            {'nome': 'Vendedor 2', 'tipo': 'Farmer', 'meta': 1000},
        ]))
        resposta = MetaComercial.objects.create(usuario=colaborador, **dados)
        client = APIClient()
        autenticar(client, colaborador)

        resp = client.get(f'/api/metas/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 200
        assert resp.content.startswith(b'%PDF-')

    def test_pdf_fora_do_escopo_retorna_404(self):
        empresa = EmpresaFactory()
        setor1 = SetorFactory(empresa=empresa)
        setor2 = SetorFactory(empresa=empresa)
        colaborador = UsuarioFactory(empresa=empresa, setor=setor1)
        outro_colaborador = UsuarioFactory(empresa=empresa, setor=setor2)
        resposta = MetaComercial.objects.create(usuario=outro_colaborador, **RESPOSTA_DIRETA)

        client = APIClient()
        autenticar(client, colaborador)
        resp = client.get(f'/api/metas/respostas/{resposta.id}/pdf/')

        assert resp.status_code == 404
