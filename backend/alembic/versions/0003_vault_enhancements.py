"""
0003_vault_enhancements: resource_metadata, vault_statistics, processing pipeline,
indexes, RLS, and subjects seed data.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_vault_enhancements"
down_revision: Union[str, None] = "0002_squad_enhancements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Add processing pipeline columns to resources ───────────────────────
    op.add_column("resources", sa.Column(
        "processing_stage",
        sa.String(30),
        nullable=False,
        server_default="uploaded",
    ))
    op.add_column("resources", sa.Column(
        "is_ai_ready",
        sa.Boolean,
        nullable=False,
        server_default="false",
    ))

    # ── CHECK constraint on processing_stage ──────────────────────────────
    op.execute("""
        ALTER TABLE resources
        ADD CONSTRAINT chk_resources_processing_stage
        CHECK (processing_stage IN (
            'uploaded', 'validating', 'extracting',
            'chunking', 'embedding', 'complete', 'failed', 'cancelled'
        ));
    """)

    # ── resource_metadata table ───────────────────────────────────────────
    op.create_table(
        "resource_metadata",
        sa.Column(
            "resource_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resources.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("pages", sa.Integer),
        sa.Column("words", sa.Integer),
        sa.Column("images", sa.Integer),
        sa.Column("slides", sa.Integer),
        sa.Column("language", sa.String(10)),
        sa.Column("detected_title", sa.Text),
        sa.Column("author", sa.Text),
        sa.Column("pdf_version", sa.String(20)),
        sa.Column("reading_time_mins", sa.Integer),
        sa.Column("width_px", sa.Integer),   # for images
        sa.Column("height_px", sa.Integer),  # for images
        sa.Column("raw", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column(
            "extracted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # ── vault_statistics table ─────────────────────────────────────────────
    op.create_table(
        "vault_statistics",
        sa.Column(
            "vault_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vaults.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("resource_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("storage_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("pdf_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ppt_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("doc_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("image_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("other_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_upload_at", sa.DateTime(timezone=True)),
        sa.Column("contributor_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # ── Trigger: auto-init vault_statistics on vault insert ───────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_vault_statistics_init_fn()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO vault_statistics (vault_id)
            VALUES (NEW.id)
            ON CONFLICT DO NOTHING;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_vault_statistics_init ON vaults;
        CREATE TRIGGER trg_vault_statistics_init
            AFTER INSERT ON vaults
            FOR EACH ROW EXECUTE FUNCTION trg_vault_statistics_init_fn();
    """)

    # ── Trigger: maintain vault_statistics on resource changes ────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_vault_statistics_fn()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            v_id UUID;
        BEGIN
            -- Determine which vault to update
            IF TG_OP = 'DELETE' THEN
                v_id := OLD.vault_id;
            ELSE
                v_id := NEW.vault_id;
            END IF;

            -- Recalculate from scratch (safe for all operations)
            UPDATE vault_statistics SET
                resource_count = (
                    SELECT COUNT(*) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                ),
                storage_bytes = (
                    SELECT COALESCE(SUM(file_size_bytes), 0) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                ),
                pdf_count = (
                    SELECT COUNT(*) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                    AND file_type = 'pdf'
                ),
                ppt_count = (
                    SELECT COUNT(*) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                    AND file_type IN ('ppt', 'pptx')
                ),
                doc_count = (
                    SELECT COUNT(*) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                    AND file_type IN ('doc', 'docx')
                ),
                image_count = (
                    SELECT COUNT(*) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                    AND file_type IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg')
                ),
                other_count = (
                    SELECT COUNT(*) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                    AND file_type NOT IN (
                        'pdf', 'ppt', 'pptx', 'doc', 'docx',
                        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'
                    )
                ),
                last_upload_at = (
                    SELECT MAX(created_at) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                ),
                contributor_count = (
                    SELECT COUNT(DISTINCT uploaded_by) FROM resources
                    WHERE vault_id = v_id AND deleted_at IS NULL
                ),
                updated_at = NOW()
            WHERE vault_id = v_id;

            RETURN COALESCE(NEW, OLD);
        END;
        $$;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_vault_statistics ON resources;
        CREATE TRIGGER trg_vault_statistics
            AFTER INSERT OR UPDATE OR DELETE ON resources
            FOR EACH ROW EXECUTE FUNCTION trg_vault_statistics_fn();
    """)

    # ── Indexes ────────────────────────────────────────────────────────────
    op.create_index(
        "idx_vaults_squad_active",
        "vaults",
        ["squad_id", "is_archived"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_resources_vault_stage",
        "resources",
        ["vault_id", "processing_stage"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("idx_resources_uploaded_by", "resources", ["uploaded_by"])
    op.create_index("idx_resources_file_type", "resources", ["file_type"])
    op.execute(
        "CREATE INDEX idx_vaults_title_trgm ON vaults USING GIN (title gin_trgm_ops)"
    )

    # ── Additional RLS policies ────────────────────────────────────────────
    op.execute("ALTER TABLE resource_metadata ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE vault_statistics ENABLE ROW LEVEL SECURITY")

    op.execute("""
        CREATE POLICY "Members can upload resources"
        ON resources FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM vaults v
                JOIN squad_members sm ON sm.squad_id = v.squad_id
                WHERE v.id = vault_id
                AND sm.user_id = auth.uid()
                AND sm.removed_at IS NULL
                AND v.deleted_at IS NULL
                AND v.is_archived = false
            )
        );
    """)
    op.execute("""
        CREATE POLICY "Creator or admin can update resources"
        ON resources FOR UPDATE
        USING (
            uploaded_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM vaults v
                WHERE v.id = vault_id
                AND has_squad_role(v.squad_id, ARRAY['owner', 'admin'])
            )
        );
    """)
    op.execute("""
        CREATE POLICY "Creator or admin can delete resources"
        ON resources FOR DELETE
        USING (
            uploaded_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM vaults v
                WHERE v.id = vault_id
                AND has_squad_role(v.squad_id, ARRAY['owner', 'admin'])
            )
        );
    """)
    op.execute("""
        CREATE POLICY "Members can view resource metadata"
        ON resource_metadata FOR SELECT
        USING (
            resource_id IN (
                SELECT r.id FROM resources r
                JOIN vaults v ON v.id = r.vault_id
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
                AND v.deleted_at IS NULL
            )
        );
    """)
    op.execute("""
        CREATE POLICY "Members can view vault statistics"
        ON vault_statistics FOR SELECT
        USING (
            vault_id IN (
                SELECT v.id FROM vaults v
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
                AND v.deleted_at IS NULL
            )
        );
    """)

    # ── Subjects seed data ─────────────────────────────────────────────────
    op.execute("""
        INSERT INTO subjects (id, name, slug, icon) VALUES
        (gen_random_uuid(), 'Programming Fundamentals',   'programming-fundamentals',   '💻'),
        (gen_random_uuid(), 'Data Structures',            'data-structures',            '🌳'),
        (gen_random_uuid(), 'Algorithms',                 'algorithms',                 '⚡'),
        (gen_random_uuid(), 'Object Oriented Programming','oop',                        '🧱'),
        (gen_random_uuid(), 'Database Management Systems','dbms',                       '🗄️'),
        (gen_random_uuid(), 'Operating Systems',          'operating-systems',           '⚙️'),
        (gen_random_uuid(), 'Computer Networks',          'computer-networks',           '🌐'),
        (gen_random_uuid(), 'Software Engineering',       'software-engineering',        '🛠️'),
        (gen_random_uuid(), 'Artificial Intelligence',    'artificial-intelligence',     '🤖'),
        (gen_random_uuid(), 'Machine Learning',           'machine-learning',            '🧠'),
        (gen_random_uuid(), 'Deep Learning',              'deep-learning',              '🔮'),
        (gen_random_uuid(), 'Compiler Design',            'compiler-design',            '📐'),
        (gen_random_uuid(), 'Theory of Computation',      'theory-of-computation',      '∞'),
        (gen_random_uuid(), 'Computer Architecture',      'computer-architecture',       '🏗️'),
        (gen_random_uuid(), 'Cloud Computing',            'cloud-computing',            '☁️'),
        (gen_random_uuid(), 'Cybersecurity',              'cybersecurity',              '🔐'),
        (gen_random_uuid(), 'DevOps',                     'devops',                     '🔄'),
        (gen_random_uuid(), 'Web Development',            'web-development',            '🌍'),
        (gen_random_uuid(), 'Mobile Development',         'mobile-development',         '📱'),
        (gen_random_uuid(), 'Mathematics',                'mathematics',                '➕'),
        (gen_random_uuid(), 'Discrete Mathematics',       'discrete-mathematics',       '🔢'),
        (gen_random_uuid(), 'Probability & Statistics',   'probability-statistics',     '📊')
        ON CONFLICT (slug) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_vault_statistics ON resources")
    op.execute("DROP TRIGGER IF EXISTS trg_vault_statistics_init ON vaults")
    op.execute("DROP FUNCTION IF EXISTS trg_vault_statistics_fn()")
    op.execute("DROP FUNCTION IF EXISTS trg_vault_statistics_init_fn()")
    op.drop_table("vault_statistics")
    op.drop_table("resource_metadata")
    op.execute("ALTER TABLE resources DROP CONSTRAINT IF EXISTS chk_resources_processing_stage")
    op.drop_column("resources", "is_ai_ready")
    op.drop_column("resources", "processing_stage")
