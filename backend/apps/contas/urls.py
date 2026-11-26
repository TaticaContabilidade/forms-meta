from django.urls import path

from .jwt import LoginView, RefreshView
from .views import (
    AceitarConviteView,
    CriarConviteView,
    EmpresaListView,
    ListarConvitesView,
    MeView,
    RedefinirSenhaView,
    RevogarConviteView,
    SetorListView,
    SolicitarRedefinicaoSenhaView,
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/esqueci-senha/', SolicitarRedefinicaoSenhaView.as_view(), name='esqueci-senha'),
    path('auth/redefinir-senha/', RedefinirSenhaView.as_view(), name='redefinir-senha'),
    path('auth/convites/', CriarConviteView.as_view(), name='criar-convite'),
    path('auth/convites/lista/', ListarConvitesView.as_view(), name='listar-convites'),
    path('auth/convites/<int:pk>/revogar/', RevogarConviteView.as_view(), name='revogar-convite'),
    path('auth/convites/aceitar/', AceitarConviteView.as_view(), name='aceitar-convite'),
    path('contas/empresas/', EmpresaListView.as_view(), name='empresas'),
    path('contas/setores/', SetorListView.as_view(), name='setores'),
]
