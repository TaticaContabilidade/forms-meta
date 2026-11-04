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
    'apps.metas',
    'apps.disc',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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

# Sem isso, Content-Disposition não está na lista de "response headers
# simples" do CORS — o axios do React recebe a resposta, mas
# resp.headers['content-disposition'] vem sempre vazio (não é erro de
# rede, o header só não é visível a JS cross-origin). As 3 rotas /pdf
# dependem desse header pro nome de arquivo (ver *Filename() de cada
# app) — sem isso, todo download no React cai no fallback genérico.
CORS_EXPOSE_HEADERS = ['Content-Disposition']

# E-mail (redefinição de senha) — mesmas variáveis SMTP_* que o Node já usa
# (ver .env.example na raiz / src/email.js), pra não duplicar configuração
# de SMTP entre os dois backends que rodam lado a lado. Sem SMTP_HOST
# configurado, cai no backend "console" (imprime o e-mail no terminal do
# `runserver`) — dá pra testar o fluxo de redefinição localmente sem SMTP
# de verdade, só olhando o console.
SMTP_HOST = os.environ.get('SMTP_HOST')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_SECURE = os.environ.get('SMTP_SECURE', 'false').lower() == 'true'
SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PASS = os.environ.get('SMTP_PASS')
SMTP_FROM = os.environ.get('SMTP_FROM') or SMTP_USER or 'no-reply@taticacontabilidade.com'

if SMTP_HOST:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = SMTP_HOST
    EMAIL_PORT = SMTP_PORT
    EMAIL_HOST_USER = SMTP_USER
    EMAIL_HOST_PASSWORD = SMTP_PASS
    # SMTP_SECURE=true -> SSL direto (porta 465); false -> STARTTLS (587),
    # mesma semântica que o nodemailer já usa pro Node (ver .env.example).
    EMAIL_USE_SSL = SMTP_SECURE
    EMAIL_USE_TLS = not SMTP_SECURE
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DEFAULT_FROM_EMAIL = SMTP_FROM

# Base do React, pra montar o link de redefinição de senha mandado por
# e-mail (FRONTEND_URL + "/redefinir-senha?uid=...&token=...").
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
