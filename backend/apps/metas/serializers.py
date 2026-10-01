from rest_framework import serializers

from .calculo import calcular_meta
from .models import MetaComercial


class EquipeItemSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=60, required=False, allow_blank=True, default='')
    tipo = serializers.ChoiceField(choices=['Hunter', 'Farmer'], required=False, default='Hunter')
    meta = serializers.FloatField(required=False, default=0)


class MetaComercialSerializer(serializers.ModelSerializer):
    equipe = EquipeItemSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = MetaComercial
        fields = (
            'id', 'criado_em',
            'faturamento', 'crescimento_pct', 'churn_pct',
            'ticket', 'conversao_pct', 'contatos_mes_passado', 'hunter_valor',
            'equipe',
            'meta_anual', 'meta_trimestral', 'meta_mensal',
            'contratos_mes', 'contatos_necessarios', 'farmer_valor',
        )
        read_only_fields = (
            'id', 'criado_em',
            'meta_anual', 'meta_trimestral', 'meta_mensal',
            'contratos_mes', 'contatos_necessarios', 'farmer_valor',
        )
        extra_kwargs = {
            # O model declara blank=True em todos os FloatField (pra
            # managed=False refletir colunas nullable do Postgres) — isso
            # faria o ModelSerializer inferir required=False sozinho pros
            # 5 campos obrigatórios também, se não forçar explicitamente
            # aqui. Sem isso, omitir "faturamento" do body inteiramente
            # (não só mandar 0) pularia validate_faturamento() e salvaria
            # 0 silenciosamente — um bypass de validação real.
            'faturamento': {'required': True},
            'crescimento_pct': {'required': True},
            'churn_pct': {'required': True},
            'ticket': {'required': True},
            'conversao_pct': {'required': True},
            'contatos_mes_passado': {'required': False, 'default': 0},
            'hunter_valor': {'required': False, 'default': 0},
        }

    def validate_faturamento(self, value):
        if value <= 0:
            raise serializers.ValidationError('Obrigatório e precisa ser maior que zero.')
        return value

    def validate_crescimento_pct(self, value):
        if value > 500:
            raise serializers.ValidationError('Máximo é 500%.')
        return value

    def validate_churn_pct(self, value):
        if value > 100:
            raise serializers.ValidationError('Máximo é 100%.')
        return value

    def validate_ticket(self, value):
        if value <= 0:
            raise serializers.ValidationError('Obrigatório e precisa ser maior que zero.')
        return value

    def validate_conversao_pct(self, value):
        if value <= 0:
            raise serializers.ValidationError('Precisa ser maior que zero.')
        if value > 100:
            raise serializers.ValidationError('Máximo é 100%.')
        return value

    def create(self, validated_data):
        usuario = self.context['request'].user
        calculados = calcular_meta(validated_data)
        return MetaComercial.objects.create(
            usuario=usuario,
            nome_participante=usuario.nome,
            empresa=usuario.empresa.nome,
            email=usuario.email,
            **calculados,
        )
