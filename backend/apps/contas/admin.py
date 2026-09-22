from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import Empresa, Setor, Usuario


class UsuarioCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = Usuario
        fields = ('email', 'nome', 'papel', 'empresa', 'setor')
        field_classes = {}


class UsuarioChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = Usuario
        fields = '__all__'
        field_classes = {}


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cnpj', 'criado_em')
    search_fields = ('nome', 'cnpj')


@admin.register(Setor)
class SetorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'empresa', 'criado_em')
    list_filter = ('empresa',)
    search_fields = ('nome', 'empresa__nome')


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    model = Usuario
    add_form = UsuarioCreationForm
    form = UsuarioChangeForm
    ordering = ('email',)
    list_display = ('email', 'nome', 'papel', 'empresa', 'setor', 'is_active', 'is_staff')
    list_filter = ('papel', 'empresa', 'is_active', 'is_staff')
    search_fields = ('email', 'nome', 'empresa__nome')
    filter_horizontal = ('groups', 'user_permissions')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Identidade', {'fields': ('nome', 'papel', 'empresa', 'setor')}),
        ('Permissões', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nome', 'papel', 'empresa', 'setor', 'password1', 'password2', 'is_staff', 'is_active'),
        }),
    )
