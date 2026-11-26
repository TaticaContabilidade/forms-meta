from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.contas.factories import EmpresaFactory, SetorFactory, UsuarioAdmFactory, UsuarioDiretorFactory, UsuarioFactory
from apps.contas.models import Convite, Usuario


@pytest.mark.django_db
class TestUsuarioClean:
    def test_adm_nao_pode_ter_empresa_nem_setor(self):
        adm = UsuarioAdmFactory.build(empresa=EmpresaFactory())
        with pytest.raises(ValidationError):
            adm.full_clean(exclude=['password'])

    def test_adm_sem_empresa_e_setor_e_valido(self):
        adm = UsuarioAdmFactory.build()
        adm.full_clean(exclude=['password'])  # não levanta

    def test_diretor_precisa_de_empresa(self):
        diretor = UsuarioDiretorFactory.build(empresa=None)
        with pytest.raises(ValidationError):
            diretor.full_clean(exclude=['password'])

    def test_diretor_nao_pode_ter_setor(self):
        setor = SetorFactory()
        diretor = UsuarioDiretorFactory.build(empresa=setor.empresa, setor=setor)
        with pytest.raises(ValidationError):
            diretor.full_clean(exclude=['password'])

    def test_diretor_com_so_empresa_e_valido(self):
        # Precisa de uma empresa já persistida: com .build() em cascata, o
        # SubFactory da empresa também ficaria só "montado" (sem pk), e
        # self.empresa_id leria None mesmo com self.empresa setado.
        diretor = UsuarioDiretorFactory.build(empresa=EmpresaFactory())
        diretor.full_clean(exclude=['password'])  # não levanta

    def test_gerente_precisa_de_setor(self):
        usuario = UsuarioFactory.build(papel=Usuario.Papel.GERENTE, empresa=EmpresaFactory(), setor=None)
        with pytest.raises(ValidationError) as exc:
            usuario.full_clean(exclude=['password'])
        assert 'setor' in exc.value.message_dict

    def test_colaborador_com_setor_de_outra_empresa_e_invalido(self):
        setor_de_outra_empresa = SetorFactory()
        usuario = UsuarioFactory.build(empresa=EmpresaFactory(), setor=setor_de_outra_empresa)
        with pytest.raises(ValidationError):
            usuario.full_clean(exclude=['password'])


@pytest.mark.django_db
class TestEmpresaSetorMarcadores:
    def test_so_uma_empresa_interna_por_vez(self):
        EmpresaFactory(empresa_interna=True)
        with pytest.raises(IntegrityError):
            EmpresaFactory(empresa_interna=True)

    def test_varias_empresas_sem_marcador_e_permitido(self):
        EmpresaFactory(empresa_interna=False)
        EmpresaFactory(empresa_interna=False)  # não levanta

    def test_so_um_setor_financeiro_por_empresa(self):
        empresa = EmpresaFactory()
        SetorFactory(empresa=empresa, setor_financeiro=True)
        with pytest.raises(IntegrityError):
            SetorFactory(empresa=empresa, setor_financeiro=True)

    def test_setor_financeiro_em_empresas_diferentes_e_permitido(self):
        SetorFactory(setor_financeiro=True)
        SetorFactory(setor_financeiro=True)  # empresas diferentes (SubFactory) — não levanta


@pytest.mark.django_db
class TestConviteClean:
    def _convite(self, **kwargs):
        empresa = kwargs.pop('empresa', None) or EmpresaFactory()
        criado_por = kwargs.pop('criado_por', None) or UsuarioDiretorFactory(empresa=empresa)
        papel = kwargs.get('papel', Usuario.Papel.COLABORADOR)
        # Default de setor só entra se o teste não passou nada e o papel
        # exige um (ver Convite.clean()) — DIRETOR não tem setor.
        if 'setor' not in kwargs and papel in (Usuario.Papel.GERENTE, Usuario.Papel.COLABORADOR):
            kwargs['setor'] = SetorFactory(empresa=empresa)
        defaults = {
            'empresa': empresa,
            'papel': papel,
            'email': 'convidado@example.com',
            'criado_por': criado_por,
            'expira_em': timezone.now() + timedelta(days=7),
        }
        defaults.update(kwargs)
        return Convite(**defaults)

    def test_convite_para_adm_e_rejeitado(self):
        convite = self._convite(papel=Usuario.Papel.ADM)
        with pytest.raises(ValidationError):
            convite.full_clean()

    def test_convite_de_diretor_nao_aceita_setor(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        convite = self._convite(empresa=empresa, papel=Usuario.Papel.DIRETOR, setor=setor)
        with pytest.raises(ValidationError):
            convite.full_clean()

    def test_convite_de_colaborador_precisa_de_setor(self):
        convite = self._convite(papel=Usuario.Papel.COLABORADOR, setor=None)
        with pytest.raises(ValidationError):
            convite.full_clean()

    def test_convite_de_colaborador_com_setor_de_outra_empresa_e_invalido(self):
        empresa = EmpresaFactory()
        setor_de_outra_empresa = SetorFactory()
        convite = self._convite(empresa=empresa, papel=Usuario.Papel.COLABORADOR, setor=setor_de_outra_empresa)
        with pytest.raises(ValidationError):
            convite.full_clean()

    def test_convite_valido_de_colaborador(self):
        empresa = EmpresaFactory()
        setor = SetorFactory(empresa=empresa)
        convite = self._convite(empresa=empresa, papel=Usuario.Papel.COLABORADOR, setor=setor)
        convite.full_clean()  # não levanta

    def test_token_gerado_automaticamente_e_unico(self):
        c1 = self._convite()
        c1.full_clean()
        c1.save()
        c2 = self._convite(email='outro@example.com')
        c2.full_clean()
        c2.save()
        assert c1.token != c2.token

    def test_pendente_fica_falso_apos_aceito_ou_revogado(self):
        convite = self._convite()
        convite.full_clean()
        convite.save()
        assert convite.pendente is True

        convite.aceito_em = timezone.now()
        assert convite.pendente is False

        convite.aceito_em = None
        convite.revogado_em = timezone.now()
        assert convite.pendente is False

    def test_pendente_fica_falso_apos_expirar(self):
        convite = self._convite(expira_em=timezone.now() - timedelta(seconds=1))
        convite.full_clean()
        convite.save()
        assert convite.pendente is False
