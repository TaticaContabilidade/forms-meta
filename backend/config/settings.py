"""
Configuração do projeto Django (backend/config) — ver o plano em
CHANGELOG.md / CLAUDE.md pra contexto da migração incremental
Node/Express -> Django REST + React.
"""

import os
import re
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-troque-isto')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'apps.contas',
    'apps.meu_porque',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Serve os estáticos (inclusive o CSS/JS do Django admin) direto pelo
    # próprio processo gunicorn — com DEBUG=False o Django não serve mais
    # estáticos sozinho (só o runserver de dev faz isso), e este projeto
    # não tem Nginx/S3/CDN na frente. Precisa vir logo depois do
    # SecurityMiddleware, e STORAGES abaixo precisa de `collectstatic`
    # rodado no build (ver backend/Dockerfile).
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database — mesma connection string/Postgres que o Node (src/db.js) já
# usa. SSL é ligado automaticamente só quando o host bate com
# `.render.com`, replicando a lógica de `src/db.js` (a "Internal Database
# URL" do Render, mesma região, não precisa de SSL; a externa, e conexões
# locais/Docker, seguem essa mesma regra).
DATABASE_URL = os.environ.get(
    'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5434/forms_meta'
)
DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        ssl_require=bool(re.search(r'\.render\.com', DATABASE_URL)),
    )
}

AUTH_USER_MODEL = 'contas.Usuario'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# DRF + JWT (djangorestframework-simplejwt)
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# CORS — o Node não tem CORS nenhum (tudo same-origin); aqui é
# obrigatório porque o React é uma origem separada.
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',') if o.strip()
]
CORS_ALLOW_CREDENTIALS = False  # JWT vai no header Authorization, não em cookie
