FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev \
    shared-mime-info fonts-dejavu-core libpq-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
# `migrate` roda aqui (no start do container, não no build) porque só
# nesse momento o serviço tem acesso de rede ao Postgres interno do
# Render — em build time (`RUN`) essa conexão normalmente não existe.
# Não roda `makemigrations` aqui: isso gera arquivo de migration novo, é
# comando de dev, tem que ser revisado e commitado no git manualmente,
# nunca gerado (e descartado) dentro de um container efêmero.
CMD ["sh", "-c", "python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:8000"]
