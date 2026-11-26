from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Convite, Empresa, Setor, Usuario
from .permissions import PodeConvidar
from .serializers import (
    AceitarConviteSerializer,
    ConviteListSerializer,
    CriarConviteSerializer,
    EmpresaListSerializer,
    RedefinirSenhaSerializer,
    SetorListSerializer,
    SolicitarRedefinicaoSenhaSerializer,
    UsuarioMeSerializer,
)


class EmpresaListView(generics.ListAPIView):
    """Nunca pública (CLAUDE.md, "Redesenho do login") — quem não é ADM só
    enxerga a própria empresa, nunca a carteira de clientes inteira."""

    serializer_class = EmpresaListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        usuario = self.request.user
        if usuario.papel == Usuario.Papel.ADM:
            return Empresa.objects.order_by('nome')
        return Empresa.objects.filter(pk=usuario.empresa_id)


class SetorListView(generics.ListAPIView):
    serializer_class = SetorListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        usuario = self.request.user
        qs = Setor.objects.order_by('nome')
        if usuario.papel == Usuario.Papel.ADM:
            empresa_id = self.request.query_params.get('empresa_id')
            return qs.filter(empresa_id=empresa_id) if empresa_id else qs
        # Pra quem não é ADM, a empresa nunca vem da query string — ela
        # sempre recusaria listar o setor de outra empresa a troco de
        # nada, então nem vale a pena honrar o parâmetro pra esse papel.
        return qs.filter(empresa_id=usuario.empresa_id)


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


class CriarConviteView(generics.CreateAPIView):
    """Única porta de entrada na plataforma — o cadastro aberto antigo
    (`CadastroColaboradorView`) foi removido (CLAUDE.md, "Redesenho do
    login"). Só ADM e Diretor convidam (`PodeConvidar`); a regra de quem
    convida qual papel/empresa está em `CriarConviteSerializer.validate`.
    """

    serializer_class = CriarConviteSerializer
    permission_classes = [permissions.IsAuthenticated, PodeConvidar]

    def perform_create(self, serializer):
        convite = serializer.save()
        link = f'{settings.FRONTEND_URL}/aceitar-convite?token={convite.token}'
        setor_txt = f' no setor {convite.setor.nome}' if convite.setor else ''
        send_mail(
            subject='Convite — Tática',
            message=(
                f'Você foi convidado a entrar na plataforma da Tática, como '
                f'{convite.get_papel_display()}{setor_txt} em {convite.empresa.nome}.\n\n'
                f'Pra aceitar, acesse o link abaixo (expira em 7 dias):\n{link}\n\n'
                'Se você não esperava esse convite, pode ignorar este e-mail.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[convite.email],
            fail_silently=True,
        )


class ListarConvitesView(generics.ListAPIView):
    """ADM vê os convites de qualquer empresa; Diretor só os da própria
    (nunca confia em `?empresa_id=` — a empresa do convite já é a do
    próprio Diretor, forçada em `CriarConviteSerializer`)."""

    serializer_class = ConviteListSerializer
    permission_classes = [permissions.IsAuthenticated, PodeConvidar]

    def get_queryset(self):
        usuario = self.request.user
        qs = Convite.objects.select_related('empresa', 'setor', 'criado_por').order_by('-criado_em')
        if usuario.papel == Usuario.Papel.ADM:
            return qs
        return qs.filter(empresa_id=usuario.empresa_id)


class RevogarConviteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, PodeConvidar]
    queryset = Convite.objects.all()

    def get_queryset(self):
        usuario = self.request.user
        qs = Convite.objects.all()
        if usuario.papel == Usuario.Papel.ADM:
            return qs
        return qs.filter(empresa_id=usuario.empresa_id)

    def post(self, request: Request, pk=None):
        convite = self.get_object()  # já aplica o escopo de get_queryset() -> 404 se fora
        if not convite.pendente:
            return Response({'detail': 'Convite já não está pendente.'}, status=400)
        convite.revogado_em = timezone.now()
        convite.save(update_fields=['revogado_em'])
        return Response({'detail': 'Convite revogado.'})


class AceitarConviteView(generics.GenericAPIView):
    serializer_class = AceitarConviteSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Conta criada. Faça login.'}, status=201)
