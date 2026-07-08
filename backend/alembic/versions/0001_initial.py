"""Initial migration: enable extensions, create all tables, indexes, and RLS policies."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extensions ─────────────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')

    # ── RLS Helper Functions ────────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION get_user_squad_ids()
        RETURNS SETOF UUID
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
            SELECT squad_id FROM public.squad_members
            WHERE user_id = auth.uid()
            AND removed_at IS NULL;
        $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION has_squad_role(target_squad_id UUID, required_roles TEXT[])
        RETURNS BOOLEAN
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM public.squad_members
                WHERE user_id = auth.uid()
                AND squad_id = target_squad_id
                AND role = ANY(required_roles)
                AND removed_at IS NULL
            );
        $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION handle_new_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            INSERT INTO public.profiles (id, email, full_name, avatar_url)
            VALUES (
                new.id,
                new.email,
                new.raw_user_meta_data->>'full_name',
                new.raw_user_meta_data->>'avatar_url'
            );
            RETURN new;
        END;
        $$;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    """)

    # ── Tables ─────────────────────────────────────────────────────────────

    op.create_table(
        "profiles",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("full_name", sa.String(200)),
        sa.Column("display_name", sa.String(100)),
        sa.Column("avatar_url", sa.Text),
        sa.Column("bio", sa.Text),
        sa.Column("university", sa.String(255)),
        sa.Column("year_of_study", sa.SmallInteger),
        sa.Column("timezone", sa.String(50), server_default="UTC"),
        sa.Column("onboarding_completed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "subjects",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True),
        sa.Column("icon", sa.String(50)),
        sa.Column("parent_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("subjects.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "squads",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("avatar_url", sa.Text),
        sa.Column("invite_code", sa.String(20), nullable=False, unique=True),
        sa.Column("is_personal", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("max_members", sa.Integer, nullable=False, server_default="50"),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "squad_members",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("squad_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("squads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(30), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("squad_id", "user_id", name="uq_squad_members"),
    )

    op.create_table(
        "invitations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("squad_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("squads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invited_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invited_email", sa.String(320)),
        sa.Column("invited_user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="CASCADE")),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("role", sa.String(30), nullable=False, server_default="member"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "vaults",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("squad_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("squads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("subjects.id", ondelete="SET NULL")),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("color", sa.String(7)),
        sa.Column("icon", sa.String(50)),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "resources",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vault_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("file_url", sa.Text, nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger, nullable=False),
        sa.Column("mime_type", sa.String(255)),
        sa.Column("page_count", sa.Integer),
        sa.Column("processing_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("processing_error", sa.Text),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "resource_processing_jobs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("resource_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("resources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default="3"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text),
        sa.Column("error_stack", sa.Text),
        sa.Column("worker_id", sa.String(100)),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "resource_chunks",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("resource_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("resources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vault_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("token_count", sa.Integer, nullable=False),
        sa.Column("page_number", sa.Integer),
        sa.Column("heading", sa.String(500)),
        sa.Column("embedding", Vector(3072)),
        sa.Column("embedding_model", sa.String(100), server_default="text-embedding-3-small"),
        sa.Column("embedding_dimensions", sa.Integer, server_default="1536"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("resource_id", "chunk_index", name="uq_chunks_resource_index"),
    )

    op.create_table("ai_generations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vault_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("vaults.id", ondelete="SET NULL")),
        sa.Column("generation_type", sa.String(30), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(10, 6), server_default="0"),
        sa.Column("latency_ms", sa.Integer),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Indexes ────────────────────────────────────────────────────────────
    op.create_index("idx_squad_members_user_active", "squad_members", ["user_id", "squad_id"],
                    postgresql_where=sa.text("removed_at IS NULL"))
    op.create_index("idx_squad_members_squad_active", "squad_members", ["squad_id"],
                    postgresql_where=sa.text("removed_at IS NULL"))
    op.create_index("idx_vaults_squad", "vaults", ["squad_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_resources_vault", "resources", ["vault_id"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_resources_status", "resources", ["processing_status"],
                    postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("idx_chunks_vault", "resource_chunks", ["vault_id"])
    op.create_index("idx_chunks_resource", "resource_chunks", ["resource_id"])
    op.create_index("idx_processing_jobs_status", "resource_processing_jobs", ["status"],
                    postgresql_where=sa.text("status IN ('queued', 'running')"))

    # HNSW vector index — most critical index for RAG performance
    op.execute("""
        CREATE INDEX idx_chunks_embedding ON resource_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 200);
    """)

    # Trigram indexes for fuzzy search
    op.execute("CREATE INDEX idx_resources_title_trgm ON resources USING GIN (title gin_trgm_ops)")

    # ── RLS Policies ───────────────────────────────────────────────────────
    for table in ["profiles", "squads", "squad_members", "vaults", "resources", "resource_chunks"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    op.execute("""
        CREATE POLICY "Users can view own profile"
        ON profiles FOR SELECT USING (id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Users can update own profile"
        ON profiles FOR UPDATE USING (id = auth.uid());
    """)
    op.execute("""
        CREATE POLICY "Users can insert own profile"
        ON profiles FOR INSERT WITH CHECK (id = auth.uid());
    """)

    op.execute("""
        CREATE POLICY "Members can view their squads"
        ON squads FOR SELECT
        USING (id IN (SELECT get_user_squad_ids()));
    """)
    op.execute("""
        CREATE POLICY "Authenticated users can create squads"
        ON squads FOR INSERT
        WITH CHECK (auth.uid() = created_by);
    """)
    op.execute("""
        CREATE POLICY "Admins can update squads"
        ON squads FOR UPDATE
        USING (has_squad_role(id, ARRAY['owner', 'admin']));
    """)
    op.execute("""
        CREATE POLICY "Owners can delete squads"
        ON squads FOR DELETE
        USING (has_squad_role(id, ARRAY['owner']));
    """)

    op.execute("""
        CREATE POLICY "Members can view squad roster"
        ON squad_members FOR SELECT
        USING (squad_id IN (SELECT get_user_squad_ids()));
    """)

    op.execute("""
        CREATE POLICY "Members can view squad vaults"
        ON vaults FOR SELECT
        USING (squad_id IN (SELECT get_user_squad_ids()));
    """)
    op.execute("""
        CREATE POLICY "Members can create vaults"
        ON vaults FOR INSERT
        WITH CHECK (has_squad_role(squad_id, ARRAY['owner', 'admin', 'member']));
    """)
    op.execute("""
        CREATE POLICY "Admins can update vaults"
        ON vaults FOR UPDATE
        USING (
            has_squad_role(squad_id, ARRAY['owner', 'admin'])
            OR created_by = auth.uid()
        );
    """)
    op.execute("""
        CREATE POLICY "Admins can delete vaults"
        ON vaults FOR DELETE
        USING (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)

    op.execute("""
        CREATE POLICY "Members can view vault resources"
        ON resources FOR SELECT
        USING (
            vault_id IN (
                SELECT v.id FROM vaults v
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
                AND v.deleted_at IS NULL
            )
        );
    """)

    # CRITICAL: vault_id denormalized — direct filter, no JOIN needed
    op.execute("""
        CREATE POLICY "Members can view vault chunks"
        ON resource_chunks FOR SELECT
        USING (
            vault_id IN (
                SELECT v.id FROM vaults v
                WHERE v.squad_id IN (SELECT get_user_squad_ids())
                AND v.deleted_at IS NULL
            )
        );
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute("DROP FUNCTION IF EXISTS handle_new_user()")
    op.execute("DROP FUNCTION IF EXISTS has_squad_role(UUID, TEXT[])")
    op.execute("DROP FUNCTION IF EXISTS get_user_squad_ids()")

    for table in [
        "resource_chunks", "resource_processing_jobs", "resources",
        "vaults", "invitations", "squad_members", "squads",
        "subjects", "profiles", "ai_generations",
    ]:
        op.drop_table(table)
