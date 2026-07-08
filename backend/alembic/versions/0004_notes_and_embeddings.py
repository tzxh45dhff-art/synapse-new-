"""Notes tables + embedding dimension fix.

Additive migration for the AI Notes Generator + the embedding pipeline it
depends on.

Two things happen here:

1.  Create ``notes``, ``note_versions`` and ``note_generations`` — the models
    already existed in ``app.models.note`` but no migration ever created the
    physical tables.

2.  Fix ``resource_chunks.embedding``. The initial migration declared the
    column as ``vector(3072)`` with an HNSW index. pgvector cannot build an
    HNSW/IVFFlat index on a column with more than 2000 dimensions, and the
    chosen embedding model (``text-embedding-3-small``) emits 1536-dim
    vectors which will not even INSERT into a ``vector(3072)`` column. The
    table is currently empty (nothing has ever embedded), so we can safely
    retype it to ``vector(1536)`` and rebuild the index.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0004_notes_and_embeddings"
down_revision: Union[str, None] = "0003_vault_enhancements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EMBEDDING_DIMS = 1536


def upgrade() -> None:
    # ── 1. Fix resource_chunks.embedding dimension + index ───────────────────
    # Guarded so the migration is idempotent-ish and safe on partially-built DBs.
    op.execute("DROP INDEX IF EXISTS idx_chunks_embedding")
    op.execute(f"ALTER TABLE resource_chunks ALTER COLUMN embedding TYPE vector({EMBEDDING_DIMS})")
    op.execute(
        f"""
        CREATE INDEX idx_chunks_embedding ON resource_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 200);
        """
    )
    # Align the recorded default with the model we actually use.
    op.execute("ALTER TABLE resource_chunks ALTER COLUMN embedding_dimensions SET DEFAULT 1536")

    # ── 2. notes ─────────────────────────────────────────────────────────────
    op.create_table(
        "notes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vault_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("content_format", sa.String(20), nullable=False, server_default="markdown"),
        sa.Column("source_type", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("is_pinned", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("word_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    # ── 3. note_versions ─────────────────────────────────────────────────────
    op.create_table(
        "note_versions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("note_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("change_summary", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("note_id", "version_number", name="uq_note_versions_note_version"),
    )

    # ── 4. note_generations ──────────────────────────────────────────────────
    op.create_table(
        "note_generations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("note_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("notes.id", ondelete="CASCADE"), nullable=False),
        # SET NULL on delete → column must be nullable.
        sa.Column("generation_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_generations.id", ondelete="SET NULL")),
        sa.Column("source_resource_ids", sa.dialects.postgresql.ARRAY(sa.dialects.postgresql.UUID(as_uuid=True)), server_default="{}"),
        sa.Column("prompt_template", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Indexes ──────────────────────────────────────────────────────────────
    op.create_index("idx_notes_vault", "notes", ["vault_id"], postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_notes_created_by", "notes", ["created_by"])
    op.create_index("idx_note_versions_note", "note_versions", ["note_id"])
    op.create_index("idx_note_generations_note", "note_generations", ["note_id"])
    op.execute("CREATE INDEX idx_notes_title_trgm ON notes USING GIN (title gin_trgm_ops)")

    # ── RLS ──────────────────────────────────────────────────────────────────
    for table in ["notes", "note_versions", "note_generations"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    op.execute(
        """
        CREATE POLICY "Members can view vault notes"
        ON notes FOR SELECT
        USING (
            vault_id IN (
                SELECT v.id FROM vaults v
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
                AND v.deleted_at IS NULL
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "Members can manage vault notes"
        ON notes FOR ALL
        USING (
            vault_id IN (
                SELECT v.id FROM vaults v
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
                AND v.deleted_at IS NULL
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "Members can view note versions"
        ON note_versions FOR SELECT
        USING (
            note_id IN (
                SELECT n.id FROM notes n
                JOIN vaults v ON v.id = n.vault_id
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "Members can view note generations"
        ON note_generations FOR SELECT
        USING (
            note_id IN (
                SELECT n.id FROM notes n
                JOIN vaults v ON v.id = n.vault_id
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
            )
        );
        """
    )


def downgrade() -> None:
    for table in ["note_generations", "note_versions", "notes"]:
        op.drop_table(table)

    # Restore the original (albeit un-indexable) 3072-dim column definition.
    op.execute("DROP INDEX IF EXISTS idx_chunks_embedding")
    op.execute("ALTER TABLE resource_chunks ALTER COLUMN embedding TYPE vector(3072)")
