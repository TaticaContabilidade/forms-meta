import json

from rest_framework import serializers

from .models import DiscResposta
from .scoring import ARQUETIPO_MAP, calc_adaptado, calc_intensidade, calc_natural, resolver_perfil_dominante


class DiscRespostaSerializer(serializers.ModelSerializer):
    # Dict cru {a: {...}, c: {...}} — sem serializer aninhado tipado,
    # porque o próprio Node não valida a forma interna de respostas.a/.c,
    # só é defensivo campo a campo dentro do cálculo (ver scoring.py). Não
    # inventamos validação mais estrita que o original.
    respostas = serializers.JSONField(write_only=True)

    class Meta:
        model = DiscResposta
        fields = (
            'id', 'criado_em', 'respostas',
            'd_natural', 'i_natural', 's_natural', 'c_natural',
            'd_adaptado', 'i_adaptado', 's_adaptado', 'c_adaptado',
            'd_intensidade', 'i_intensidade', 's_intensidade', 'c_intensidade',
            'perfil_dominante', 'arquetipo',
        )
        read_only_fields = (
            'id', 'criado_em',
            'd_natural', 'i_natural', 's_natural', 'c_natural',
            'd_adaptado', 'i_adaptado', 's_adaptado', 'c_adaptado',
            'd_intensidade', 'i_intensidade', 's_intensidade', 'c_intensidade',
            'perfil_dominante', 'arquetipo',
        )

    def create(self, validated_data):
        usuario = self.context['request'].user
        respostas = validated_data.pop('respostas') or {}
        natural = calc_natural(respostas.get('a') or {})
        adaptado = calc_adaptado(respostas.get('a') or {})
        intensidade = calc_intensidade(respostas.get('c') or {})
        perfil = resolver_perfil_dominante(natural)
        infos = [ARQUETIPO_MAP[t] for t in perfil['traits']]

        return DiscResposta.objects.create(
            usuario=usuario,
            nome_participante=usuario.nome,
            empresa=usuario.empresa.nome,
            email=usuario.email,
            d_natural=natural['D'], i_natural=natural['I'], s_natural=natural['S'], c_natural=natural['C'],
            d_adaptado=adaptado['D'], i_adaptado=adaptado['I'], s_adaptado=adaptado['S'], c_adaptado=adaptado['C'],
            d_intensidade=intensidade['D'], i_intensidade=intensidade['I'],
            s_intensidade=intensidade['S'], c_intensidade=intensidade['C'],
            perfil_dominante='+'.join(perfil['traits']),
            arquetipo=' + '.join(info['nome'] for info in infos),
            respostas_json=json.dumps(respostas),
        )
