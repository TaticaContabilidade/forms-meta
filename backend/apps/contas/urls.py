from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    CadastroColaboradorView,
    EmpresaListView,
    MeView,
    RedefinirSenhaView,
    SetorListView,
    SolicitarRedefinicaoSenhaView,
)

urlpatterns = [
    path('auth/cadastro/colaborador/', CadastroColaboradorView.as_view(), name='cadastro-colaborador'),
    path('auth/login/', TokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/esqueci-senha/', SolicitarRedefinicaoSenhaView.as_view(), name='esqueci-senha'),
    path('auth/redefinir-senha/', RedefinirSenhaView.as_view(), name='redefinir-senha'),
    path('contas/empresas/', EmpresaListView.as_view(), name='empresas'),
    path('contas/setores/', SetorListView.as_view(), name='setores'),
]
