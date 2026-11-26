from rest_framework.permissions import BasePermission

from .models import Usuario


class PodeConvidar(BasePermission):
    """Só ADM e Diretor convidam — Gerente e Colaborador não convidam
    ninguém (ver CLAUDE.md, "Redesenho do login", e a wiki do repo
    dashboard-financeiro, página Papéis: "Quem convida quem")."""

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.papel in (Usuario.Papel.ADM, Usuario.Papel.DIRETOR))
