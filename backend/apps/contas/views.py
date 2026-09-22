from rest_framework import generics, permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Empresa, Setor
from .serializers import (
    CadastroColaboradorSerializer,
    EmpresaListSerializer,
    SetorListSerializer,
    UsuarioMeSerializer,
)


class CadastroColaboradorView(generics.CreateAPIView):
    serializer_class = CadastroColaboradorSerializer
    permission_classes = [permissions.AllowAny]


class EmpresaListView(generics.ListAPIView):
    queryset = Empresa.objects.order_by('nome')
    serializer_class = EmpresaListSerializer
    permission_classes = [permissions.AllowAny]


class SetorListView(generics.ListAPIView):
    serializer_class = SetorListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Setor.objects.order_by('nome')
        empresa_id = self.request.query_params.get('empresa_id')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request):
        return Response(UsuarioMeSerializer(request.user).data)
