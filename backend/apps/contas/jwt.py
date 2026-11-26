"""JWT com claims próprias (CLAUDE.md, "Redesenho do login") — o
dashboard-financeiro (e qualquer outro consumidor) decide acesso só
pelo token, sem consultar o forms-meta de volta. Ver a wiki daquele
repo, página "Validação do JWT", pro contrato completo das claims.
"""

from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def claims_do_usuario(usuario):
    return {
        'papel': usuario.papel,
        'empresa_id': usuario.empresa_id,
        'setor_id': usuario.setor_id,
        'empresa_interna': bool(usuario.empresa_id and usuario.empresa.empresa_interna),
        'setor_financeiro': bool(usuario.setor_id and usuario.setor.setor_financeiro),
    }


class TokenObtainPairComClaimsSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        for claim, valor in claims_do_usuario(user).items():
            token[claim] = valor
        return token


class TokenRefreshComClaimsSerializer(TokenRefreshSerializer):
    """Por padrão, o simplejwt copia pro access token novo as claims que
    já estavam no refresh token (emitidas no login) — uma mudança de
    papel/setor só valeria depois que o refresh token expirasse (7
    dias). Reescreve as claims aqui a partir do usuário relido no banco
    — o próprio simplejwt já busca esse usuário pra checar
    `USER_AUTHENTICATION_RULE` (is_active), reaproveitado em vez de
    consultar duas vezes.
    """

    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])

        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
        usuario = get_user_model().objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first() if user_id else None
        if not usuario or not api_settings.USER_AUTHENTICATION_RULE(usuario):
            raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')

        # Grava no refresh ANTES de gerar o access token: a property
        # `access_token` copia as claims do payload atual do refresh, e
        # (se ROTATE_REFRESH_TOKENS) o refresh re-serializado abaixo
        # também sai com as claims já atualizadas, não só o access.
        for claim, valor in claims_do_usuario(usuario).items():
            refresh[claim] = valor

        data = {'access': str(refresh.access_token)}

        if api_settings.ROTATE_REFRESH_TOKENS:
            if api_settings.BLACKLIST_AFTER_ROTATION:
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            refresh.outstand()
            data['refresh'] = str(refresh)

        return data


class LoginView(TokenObtainPairView):
    serializer_class = TokenObtainPairComClaimsSerializer


class RefreshView(TokenRefreshView):
    serializer_class = TokenRefreshComClaimsSerializer
