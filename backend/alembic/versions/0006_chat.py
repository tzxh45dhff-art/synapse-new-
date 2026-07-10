"""Create chat_sessions, chat_messages, citations, chat_feedback.

Additive migration. The ChatSession/ChatMessage/Citation/ChatFeedback models
in app.models.chat existed without a matching DDL migration — the global
Ask AI chatbot needs these tables. chat_sessions.vault_id is nullable: NULL
means a global session that searches every vault the user can access; a set
value scopes the session to one vault, reserved for a future "Ask This
Vault" entry point.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_chat"
down_revision: Union[str, None] = "0005_activity_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_sessions",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "vault_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vaults.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(500)),
        sa.Column("message_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_chat_sessions_user", "chat_sessions", ["user_id"])
    op.create_index("idx_chat_sessions_vault", "chat_sessions", ["vault_id"])

    op.create_table(
        "chat_messages",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("token_count", sa.Integer),
        sa.Column("context_chunks", sa.dialects.postgresql.JSONB),
        sa.Column(
            "generation_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai_generations.id", ondelete="SET NULL"),
        ),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_chat_messages_session", "chat_messages", ["session_id"])

    op.create_table(
        "citations",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resource_chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("relevance_score", sa.Numeric(5, 4)),
        sa.Column("snippet", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_citations_message", "citations", ["message_id"])

    op.create_table(
        "chat_feedback",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rating", sa.SmallInteger, nullable=False),
        sa.Column("feedback_text", sa.Text),
        sa.Column("feedback_tags", sa.dialects.postgresql.ARRAY(sa.Text)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_chat_feedback_message", "chat_feedback", ["message_id"])

    for table in ("chat_sessions", "chat_messages", "citations", "chat_feedback"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    op.execute(
        """
        CREATE POLICY "Users can access their own chat sessions"
        ON chat_sessions FOR ALL
        USING (user_id = auth.uid());
        """
    )
    op.execute(
        """
        CREATE POLICY "Users can access messages in their own sessions"
        ON chat_messages FOR ALL
        USING (
            session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "Users can access citations on their own messages"
        ON citations FOR ALL
        USING (
            message_id IN (
                SELECT cm.id FROM chat_messages cm
                JOIN chat_sessions cs ON cs.id = cm.session_id
                WHERE cs.user_id = auth.uid()
            )
        );
        """
    )
    op.execute(
        """
        CREATE POLICY "Users can access their own feedback"
        ON chat_feedback FOR ALL
        USING (user_id = auth.uid());
        """
    )


def downgrade() -> None:
    op.drop_table("chat_feedback")
    op.drop_table("citations")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
