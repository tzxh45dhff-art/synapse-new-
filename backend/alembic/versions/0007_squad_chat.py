"""Create squad_messages and squad_message_reactions (WhatsApp-style squad chat).

Additive migration for the multi-user, per-squad group chat. Distinct from the
single-user Ask-AI chat tables (0006_chat). Both tables are added to the
`supabase_realtime` publication (when it exists) with REPLICA IDENTITY FULL so
clients receive INSERT/UPDATE/DELETE payloads over Supabase Realtime, gated by
RLS SELECT policies that only expose rows to active members of the squad.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_squad_chat"
down_revision: Union[str, None] = "0006_chat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "squad_messages",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "squad_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("squads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("message_type", sa.String(20), nullable=False, server_default="text"),
        sa.Column("attachment", sa.dialects.postgresql.JSONB),
        sa.Column(
            "reply_to_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("squad_messages.id", ondelete="SET NULL"),
        ),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("edited_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "idx_squad_messages_squad_created",
        "squad_messages",
        ["squad_id", "created_at"],
    )

    op.create_table(
        "squad_message_reactions",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("squad_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "squad_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("squads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("emoji", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("message_id", "user_id", "emoji", name="uq_squad_reaction"),
    )
    op.create_index(
        "idx_squad_reactions_message",
        "squad_message_reactions",
        ["message_id"],
    )

    # ── Row-level security: only active squad members may SELECT (this is what
    #    gates Supabase Realtime postgres_changes subscriptions). Writes go
    #    through the backend service role, which bypasses RLS. ────────────────
    for table in ("squad_messages", "squad_message_reactions"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    op.execute(
        """
        CREATE POLICY "Squad members can read messages"
        ON squad_messages FOR SELECT
        USING (
            squad_id IN (
                SELECT squad_id FROM squad_members
                WHERE user_id = auth.uid() AND removed_at IS NULL
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "Squad members can read reactions"
        ON squad_message_reactions FOR SELECT
        USING (
            squad_id IN (
                SELECT squad_id FROM squad_members
                WHERE user_id = auth.uid() AND removed_at IS NULL
            )
        );
        """
    )

    # ── Realtime: emit full row on every change so clients can render deletes
    #    and reaction removals; register the tables with the publication if the
    #    Supabase realtime publication exists (it won't on a bare local PG). ──
    op.execute("ALTER TABLE squad_messages REPLICA IDENTITY FULL")
    op.execute("ALTER TABLE squad_message_reactions REPLICA IDENTITY FULL")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE squad_messages;
                ALTER PUBLICATION supabase_realtime ADD TABLE squad_message_reactions;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                ALTER PUBLICATION supabase_realtime DROP TABLE squad_message_reactions;
                ALTER PUBLICATION supabase_realtime DROP TABLE squad_messages;
            END IF;
        END $$;
        """
    )
    op.drop_table("squad_message_reactions")
    op.drop_table("squad_messages")
