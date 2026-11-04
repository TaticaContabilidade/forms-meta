import pytest


@pytest.fixture(autouse=True)
def _nunca_usa_smtp_de_verdade(settings):
    """Mesma regra do Node (ver CLAUDE.md: "Testes automatizados nunca
    podem usar SMTP de verdade") — mesmo que backend/.env tenha
    SMTP_HOST/SMTP_USER/SMTP_PASS reais configurados pra testar manualmente,
    a suíte força o backend "locmem" (guarda em django.core.mail.outbox,
    não manda nada de verdade)."""
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
