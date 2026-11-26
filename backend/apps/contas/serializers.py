from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Convite, Empresa, Setor, Usuario


class EmpresaListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ('id', 'nome')


class SetorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setor
        fields = ('id', 'nome')


class CriarConviteSerializer(serializers.ModelSerializer):
    empresa_id = serializers.PrimaryKeyRelatedField(source='empresa', queryset=Empresa.objects.all(), required=False)
    setor_id = serializers.PrimaryKeyRelatedField(
        source='setor', queryset=Setor.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = Convite
        fields = ('id', 'empresa_id', 'setor_id', 'papel', 'email', 'criado_em', 'expira_em')
        read_only_fields = ('id', 'criado_em', 'expira_em')

    def validate(self, attrs):
        usuario = self.context['request'].user
        papel = attrs.get('papel')

        if usuario.papel == Usuario.Papel.DIRETOR:
            # Empresa nunca confia no body pra quem não é ADM — sempre a
            # do próprio Diretor (Diretor só convida na própria empresa).
            attrs['empresa'] = usuario.empresa
            if papel not in (Usuario.Papel.DIRETOR, Usuario.Papel.GERENTE, Usuario.Papel.COLABORADOR):
                raise serializers.ValidationError(
                    {'papel': 'Diretor só convida Diretor, Gerente ou Colaborador.'}
                )
        else:  # ADM — únicos 2 papéis que passam da permission PodeConvidar
            if 'empresa' not in attrs:
                raise serializers.ValidationError({'empresa_id': 'Obrigatório.'})
            if papel == Usuario.Papel.ADM:
                raise serializers.ValidationError({'papel': 'ADM nunca é convidado — só criado pelo Django admin.'})

        empresa = attrs['empresa']
        setor = attrs.get('setor')

        if papel == Usuario.Papel.DIRETOR:
            if setor is not None:
                raise serializers.ValidationError({'setor_id': 'Convite de Diretor não tem setor específico.'})
        else:
            if setor is None:
                raise serializers.ValidationError({'setor_id': 'Obrigatório pra esse papel.'})
            if setor.empresa_id != empresa.id:
                raise serializers.ValidationError({'setor_id': 'O setor não pertence à empresa selecionada.'})

        return attrs

    def create(self, validated_data):
        return Convite.objects.create(
            criado_por=self.context['request'].user,
            expira_em=timezone.now() + timedelta(days=7),
            **validated_data,
        )


class ConviteListSerializer(serializers.ModelSerializer):
    empresa = EmpresaListSerializer(read_only=True)
    setor = SetorListSerializer(read_only=True)
    criado_por_nome = serializers.CharField(source='criado_por.nome', read_only=True)
    pendente = serializers.BooleanField(read_only=True)

    class Meta:
        model = Convite
        fields = (
            'id', 'empresa', 'setor', 'papel', 'email', 'criado_por_nome', 'criado_em', 'expira_em',
            'aceito_em', 'revogado_em', 'pendente',
        )


class AceitarConviteSerializer(serializers.Serializer):
    token = serializers.CharField()
    nome = serializers.CharField(max_length=200)
    senha = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        convite = Convite.objects.filter(token=attrs['token']).select_related('empresa', 'setor').first()
        if convite is None or not convite.pendente:
            raise serializers.ValidationError({'token': 'Convite inválido ou expirado.'})
        attrs['convite'] = convite
        return attrs

    def create(self, validated_data):
        convite = validated_data['convite']
        usuario = Usuario.objects.create_user(
            email=convite.email,
            senha=validated_data['senha'],
            nome=validated_data['nome'],
            papel=convite.papel,
            empresa=convite.empresa,
            setor=convite.setor,
        )
        convite.aceito_em = timezone.now()
        convite.save(update_fields=['aceito_em'])
        return usuario


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ('id', 'nome', 'empresa_interna')


class SetorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setor
        fields = ('id', 'nome', 'setor_financeiro')


class SolicitarRedefinicaoSenhaSerializer(serializers.Serializer):
    email = serializers.EmailField()


class RedefinirSenhaSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    nova_senha = serializers.CharField(min_length=8)


class UsuarioMeSerializer(serializers.ModelSerializer):
    empresa = EmpresaSerializer(read_only=True)
    setor = SetorSerializer(read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'nome', 'email', 'papel', 'empresa', 'setor')
