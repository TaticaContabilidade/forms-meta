from django.db import migrations


class Migration(migrations.Migration):
    """Mesmo racional de apps/meu_porque/migrations/0002_usuario_fk.py —
    ver lá pra contexto completo. CREATE TABLE IF NOT EXISTS é no-op em
    prod/dev (tabela `metas` já existe, criada pelo Node via src/db.js);
    só importa pro banco efêmero do pytest-django, que nasce vazio."""

    dependencies = [
        ('metas', '0001_initial'),
        ('contas', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS metas (
                    id SERIAL PRIMARY KEY,
                    criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    nome_participante TEXT,
                    empresa TEXT,
                    email TEXT,
                    faturamento DOUBLE PRECISION,
                    crescimento_pct DOUBLE PRECISION,
                    churn_pct DOUBLE PRECISION,
                    meta_anual DOUBLE PRECISION,
                    meta_trimestral DOUBLE PRECISION,
                    meta_mensal DOUBLE PRECISION,
                    ticket DOUBLE PRECISION,
                    contratos_mes DOUBLE PRECISION,
                    conversao_pct DOUBLE PRECISION,
                    contatos_necessarios DOUBLE PRECISION,
                    contatos_mes_passado DOUBLE PRECISION,
                    hunter_valor DOUBLE PRECISION,
                    farmer_valor DOUBLE PRECISION,
                    equipe_json TEXT,
                    notificado_em TEXT
                );

                ALTER TABLE metas ADD COLUMN IF NOT EXISTS usuario_id INTEGER;

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'metas_usuario_id_fkey'
                    ) THEN
                        ALTER TABLE metas
                            ADD CONSTRAINT metas_usuario_id_fkey
                            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
                            ON DELETE SET NULL;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS metas_usuario_id_idx
                    ON metas (usuario_id);
            """,
            reverse_sql="""
                ALTER TABLE metas DROP COLUMN IF EXISTS usuario_id;
            """,
        ),
    ]
