from django.db import migrations


class Migration(migrations.Migration):
    """Mesmo racional de apps/meu_porque/migrations/0002_usuario_fk.py e
    apps/metas/migrations/0002_usuario_fk.py — ver lá pra contexto
    completo. CREATE TABLE IF NOT EXISTS é no-op em prod/dev (tabela
    `disc_respostas` já existe, criada pelo Node via src/db.js); só
    importa pro banco efêmero do pytest-django, que nasce vazio."""

    dependencies = [
        ('disc', '0001_initial'),
        ('contas', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS disc_respostas (
                    id SERIAL PRIMARY KEY,
                    criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    nome_participante TEXT,
                    empresa TEXT,
                    email TEXT,
                    d_natural DOUBLE PRECISION,
                    i_natural DOUBLE PRECISION,
                    s_natural DOUBLE PRECISION,
                    c_natural DOUBLE PRECISION,
                    d_adaptado DOUBLE PRECISION,
                    i_adaptado DOUBLE PRECISION,
                    s_adaptado DOUBLE PRECISION,
                    c_adaptado DOUBLE PRECISION,
                    d_intensidade DOUBLE PRECISION,
                    i_intensidade DOUBLE PRECISION,
                    s_intensidade DOUBLE PRECISION,
                    c_intensidade DOUBLE PRECISION,
                    perfil_dominante TEXT,
                    arquetipo TEXT,
                    respostas_json TEXT,
                    notificado_em TEXT
                );

                ALTER TABLE disc_respostas ADD COLUMN IF NOT EXISTS usuario_id INTEGER;

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'disc_respostas_usuario_id_fkey'
                    ) THEN
                        ALTER TABLE disc_respostas
                            ADD CONSTRAINT disc_respostas_usuario_id_fkey
                            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
                            ON DELETE SET NULL;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS disc_respostas_usuario_id_idx
                    ON disc_respostas (usuario_id);
            """,
            reverse_sql="""
                ALTER TABLE disc_respostas DROP COLUMN IF EXISTS usuario_id;
            """,
        ),
    ]
