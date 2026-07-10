"""Create study_sessions, study_streaks, topic_mastery, flashcards, flashcard_reviews, spaced_repetition_state.

These six models existed in app.models (intelligence.py, flashcard.py) with zero
migrations — dead tables nothing ever wrote to. This creates the subset actually
wired up by intelligence_service.py / flashcard_service.py to back the dashboard's
streak, activity heatmap, topic mastery, practice-score trend, and Quick Recall
flashcard widgets with real data. exam_readiness/readiness_history/exams are left
for a future pass — nothing reads or writes them yet.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_intelligence_flashcards"
down_revision: Union[str, None] = "0007_squad_chat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "study_sessions",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "vault_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vaults.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "squad_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("squads.id", ondelete="SET NULL"),
        ),
        sa.Column("session_type", sa.String(30), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("duration_secs", sa.Integer),
        sa.Column("focus_score", sa.Numeric(5, 2)),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
    )
    op.create_index("idx_study_sessions_user_started", "study_sessions", ["user_id", "started_at"])

    op.create_table(
        "study_streaks",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False, unique=True,
        ),
        sa.Column("current_streak", sa.Integer, nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_study_date", sa.Date, nullable=False, server_default=sa.func.current_date()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "topic_mastery",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "vault_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("topic", sa.String(300), nullable=False),
        sa.Column("mastery_score", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Numeric(5, 2), server_default="0"),
        sa.Column("quiz_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("flashcard_reviews", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_assessed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "vault_id", "topic", name="uq_topic_mastery"),
    )
    op.create_index("idx_topic_mastery_user", "topic_mastery", ["user_id"])

    op.create_table(
        "flashcards",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "vault_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vaults.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "created_by", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("front", sa.Text, nullable=False),
        sa.Column("back", sa.Text, nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False, server_default="ai_generated"),
        sa.Column("difficulty", sa.String(20), server_default="medium"),
        sa.Column(
            "source_chunk_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resource_chunks.id", ondelete="SET NULL"),
        ),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_flashcards_vault", "flashcards", ["vault_id"])

    op.create_table(
        "flashcard_reviews",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "flashcard_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("rating", sa.SmallInteger, nullable=False),
        sa.Column("response_time_ms", sa.Integer),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_flashcard_reviews_flashcard", "flashcard_reviews", ["flashcard_id"])

    op.create_table(
        "spaced_repetition_state",
        sa.Column(
            "id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "flashcard_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("ease_factor", sa.Numeric(4, 2), nullable=False, server_default="2.50"),
        sa.Column("interval_days", sa.Numeric(7, 2), nullable=False, server_default="0"),
        sa.Column("repetitions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("next_review_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.UniqueConstraint("flashcard_id", "user_id", name="uq_srs_flashcard_user"),
    )
    op.create_index(
        "idx_srs_user_next_review", "spaced_repetition_state", ["user_id", "next_review_at"]
    )

    for table in (
        "study_sessions", "study_streaks", "topic_mastery",
        "flashcards", "flashcard_reviews", "spaced_repetition_state",
    ):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    op.execute(
        """CREATE POLICY "Users can access their own study sessions"
        ON study_sessions FOR ALL USING (user_id = auth.uid());"""
    )
    op.execute(
        """CREATE POLICY "Users can access their own streak"
        ON study_streaks FOR ALL USING (user_id = auth.uid());"""
    )
    op.execute(
        """CREATE POLICY "Users can access their own topic mastery"
        ON topic_mastery FOR ALL USING (user_id = auth.uid());"""
    )
    op.execute(
        """CREATE POLICY "Squad members can access vault flashcards"
        ON flashcards FOR ALL USING (
            vault_id IN (
                SELECT v.id FROM vaults v
                JOIN squad_members sm ON sm.squad_id = v.squad_id
                WHERE sm.user_id = auth.uid() AND sm.removed_at IS NULL
            )
        );"""
    )
    op.execute(
        """CREATE POLICY "Users can access their own flashcard reviews"
        ON flashcard_reviews FOR ALL USING (user_id = auth.uid());"""
    )
    op.execute(
        """CREATE POLICY "Users can access their own SRS state"
        ON spaced_repetition_state FOR ALL USING (user_id = auth.uid());"""
    )


def downgrade() -> None:
    op.drop_table("spaced_repetition_state")
    op.drop_table("flashcard_reviews")
    op.drop_table("flashcards")
    op.drop_table("topic_mastery")
    op.drop_table("study_streaks")
    op.drop_table("study_sessions")
