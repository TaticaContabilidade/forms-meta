from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Empresa, Setor, Usuario
from .serializers import (
    CadastroColaboradorSerializer,
    EmpresaListSerializer,
    RedefinirSenhaSerializer,
    SetorListSerializer,
    SolicitarRedefinicaoSenhaSerializer,
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


class SolicitarRedefinicaoSenhaView(generics.GenericAPIView):
    serializer_class = SolicitarRedefinicaoSenhaSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = Usuario.objects.filter(email__iexact=serializer.validated_data['email']).first()

        # Resposta genérica sempre, exista ou não o e-mail — não dá pra
        # alguém usar esse endpoint pra descobrir quem tem conta aqui.
        if usuario is not None:
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            token = default_token_generator.make_token(usuario)
            link = f'{settings.FRONTEND_URL}/redefinir-senha?uid={uid}&token={token}'
            send_mail(
                subject='Redefinição de senha — Tática',
                message=(
                    f'Oi, {usuario.nome}!\n\n'
                    'Alguém (provavelmente você) pediu pra redefinir a senha da sua conta.\n'
                    f'Pra escolher uma nova senha, acesse o link abaixo:\n{link}\n\n'
                    'Se não foi você, pode ignorar este e-mail — sua senha continua a mesma.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[usuario.email],
                fail_silently=True,
            )

        return Response({'detail': 'Se esse e-mail existir, enviamos um link de redefinição.'})


class RedefinirSenhaView(generics.GenericAPIView):
    serializer_class = RedefinirSenhaSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            pk = force_str(urlsafe_base64_decode(serializer.validated_data['uid']))
            usuario = Usuario.objects.get(pk=pk)
        except (TypeError, ValueError, OverflowError, Usuario.DoesNotExist):
            usuario = None

        if usuario is None or not default_token_generator.check_token(usuario, serializer.validated_data['token']):
            return Response({'detail': 'Link inválido ou expirado.'}, status=400)

        usuario.set_password(serializer.validated_data['nova_senha'])
        usuario.save()
        return Response({'detail': 'Senha redefinida com sucesso.'})
