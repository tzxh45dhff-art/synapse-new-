"""Create activity_logs.

Additive migration. squad_service/vault_service/resource_service/
invitation_service all write to ``activity_logs`` (an append-only audit
table) on every mutation, but no prior migration ever created the physical
table — the model in ``app.models.system`` existed without a matching DDL
migration, so every squad/vault/resource/invitation mutation raised
``UndefinedTableError`` at insert time.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_activity_logs"
down_revision: Union[str, None] = "0004_notes_and_embeddings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="SET NULL")),
        sa.Column("squad_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("squads.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50)),
        sa.Column("entity_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.dialects.postgresql.INET),
        sa.Column("user_agent", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_activity_logs_user", "activity_logs", ["user_id"])
    op.create_index("idx_activity_logs_squad", "activity_logs", ["squad_id"])
    op.create_index("idx_activity_logs_created_at", "activity_logs", ["created_at"])

    op.execute("ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY "Members can view their squad's activity"
        ON activity_logs FOR SELECT
        USING (
            squad_id IN (SELECT get_user_squad_ids())
            OR user_id = auth.uid()
        );
        """
    )


def downgrade() -> None:
    op.drop_table("activity_logs")
