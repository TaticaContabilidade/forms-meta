from django.db import migrations


class Migration(migrations.Migration):
    """Adiciona a coluna usuario_id (FK) na tabela meu_porque_respostas,
    que continua sendo criada/dona pelo Node (src/db.js). Postgres não tem
    `ADD CONSTRAINT IF NOT EXISTS` nativo (só `ADD COLUMN IF NOT EXISTS`,
    que o Node já usa) — o bloco DO $$ ... $$ reproduz a mesma
    idempotência pra constraint, pra nunca conflitar com o boot do Node
    (que roda ALTER TABLE ... ADD COLUMN IF NOT EXISTS a cada start).

    O `CREATE TABLE IF NOT EXISTS` abaixo espelha exatamente o schema que
    `src/db.js` já cria — é um no-op no banco de dev/prod real (onde o
    Node já criou a tabela), mas garante que o banco de teste efêmero do
    pytest-django (criado do zero, sem o Node nunca ter rodado nele)
    também tenha a tabela antes desta migration tentar alterá-la."""

    dependencies = [
        ('meu_porque', '0001_initial'),
        ('contas', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS meu_porque_respostas (
                    id SERIAL PRIMARY KEY,
                    criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    nome_participante TEXT,
                    empresa TEXT,
                    email TEXT,
                    objetivo TEXT,
                    sonho TEXT,
                    mudanca TEXT,
                    visao_futuro TEXT,
                    notificado_em TEXT
                );

                ALTER TABLE meu_porque_respostas ADD COLUMN IF NOT EXISTS usuario_id INTEGER;

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'meu_porque_respostas_usuario_id_fkey'
                    ) THEN
                        ALTER TABLE meu_porque_respostas
                            ADD CONSTRAINT meu_porque_respostas_usuario_id_fkey
                            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
                            ON DELETE SET NULL;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS meu_porque_respostas_usuario_id_idx
                    ON meu_porque_respostas (usuario_id);
            """,
            reverse_sql="""
                ALTER TABLE meu_porque_respostas DROP COLUMN IF EXISTS usuario_id;
            """,
        ),
    ]
