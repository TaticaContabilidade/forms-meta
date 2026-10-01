from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action

from apps.contas.models import Usuario

from .models import MetaComercial
from .pdf import content_disposition_filename, gerar_pdf, meta_comercial_filename
from .serializers import MetaComercialSerializer


class MetaComercialViewSet(viewsets.ModelViewSet):
    serializer_class = MetaComercialSerializer
    http_method_names = ['get', 'post']

    def get_queryset(self):
        user = self.request.user
        qs = MetaComercial.objects.select_related('usuario').order_by('-id')
        if user.papel == Usuario.Papel.GERENTE:
            return qs.filter(usuario__setor=user.setor)
        return qs.filter(usuario=user)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        resposta = self.get_object()  # já aplica o escopo de get_queryset() -> 404 se fora
        pdf_bytes = gerar_pdf(resposta)
        filename = meta_comercial_filename(resposta.nome_participante)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = content_disposition_filename(filename)
        return response
