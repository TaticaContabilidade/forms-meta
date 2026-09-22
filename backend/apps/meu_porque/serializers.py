from rest_framework import serializers

from .models import MeuPorqueResposta


class MeuPorqueRespostaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeuPorqueResposta
        fields = ('id', 'objetivo', 'sonho', 'mudanca', 'visao_futuro', 'criado_em')
        read_only_fields = ('id', 'criado_em')
        extra_kwargs = {
            'objetivo': {'required': True, 'allow_blank': False, 'max_length': 4000},
            'sonho': {'required': True, 'allow_blank': False, 'max_length': 4000},
            'mudanca': {'required': True, 'allow_blank': False, 'max_length': 4000},
            'visao_futuro': {'required': True, 'allow_blank': False, 'max_length': 4000},
        }

    def create(self, validated_data):
        usuario = self.context['request'].user
        return MeuPorqueResposta.objects.create(
            usuario=usuario,
            nome_participante=usuario.nome,
            empresa=usuario.empresa.nome,
            email=usuario.email,
            **validated_data,
        )
