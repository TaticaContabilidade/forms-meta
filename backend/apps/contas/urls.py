from django.urls import path

from .jwt import LoginView, RefreshView
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
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/esqueci-senha/', SolicitarRedefinicaoSenhaView.as_view(), name='esqueci-senha'),
    path('auth/redefinir-senha/', RedefinirSenhaView.as_view(), name='redefinir-senha'),
    path('contas/empresas/', EmpresaListView.as_view(), name='empresas'),
    path('contas/setores/', SetorListView.as_view(), name='setores'),
]
