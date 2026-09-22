from rest_framework import serializers

from .models import Empresa, Setor, Usuario


class EmpresaListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ('id', 'nome')


class SetorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setor
        fields = ('id', 'nome')


class CadastroColaboradorSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True, min_length=8)
    empresa_id = serializers.PrimaryKeyRelatedField(source='empresa', queryset=Empresa.objects.all())
    setor_id = serializers.PrimaryKeyRelatedField(source='setor', queryset=Setor.objects.all())

    class Meta:
        model = Usuario
        fields = ('id', 'nome', 'email', 'senha', 'empresa_id', 'setor_id')

    def validate(self, attrs):
        empresa = attrs.get('empresa')
        setor = attrs.get('setor')
        if setor.empresa_id != empresa.id:
            raise serializers.ValidationError(
                {'setor_id': 'O setor selecionado não pertence à empresa selecionada.'}
            )
        return attrs

    def create(self, validated_data):
        senha = validated_data.pop('senha')
        return Usuario.objects.create_user(
            email=validated_data['email'],
            senha=senha,
            nome=validated_data['nome'],
            papel=Usuario.Papel.COLABORADOR,
            empresa=validated_data['empresa'],
            setor=validated_data['setor'],
        )


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ('id', 'nome')


class SetorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setor
        fields = ('id', 'nome')


class UsuarioMeSerializer(serializers.ModelSerializer):
    empresa = EmpresaSerializer(read_only=True)
    setor = SetorSerializer(read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'nome', 'email', 'papel', 'empresa', 'setor')
