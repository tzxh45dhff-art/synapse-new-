"""Squad system enhancements: member_count, invitation columns, triggers, indexes, RLS."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_squad_enhancements"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New columns ───────────────────────────────────────────────────────
    op.add_column("squads", sa.Column("member_count", sa.Integer, nullable=False, server_default="0"))

    op.add_column("invitations", sa.Column("accepted_by", sa.dialects.postgresql.UUID(as_uuid=True),
                                           sa.ForeignKey("auth.users.id", ondelete="SET NULL")))
    op.add_column("invitations", sa.Column("accepted_at", sa.DateTime(timezone=True)))

    # ── CHECK constraints ─────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE squad_members
        ADD CONSTRAINT chk_squad_member_role
        CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
    """)

    op.execute("""
        ALTER TABLE invitations
        ADD CONSTRAINT chk_invitation_status
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked'));
    """)

    op.execute("""
        ALTER TABLE invitations
        ADD CONSTRAINT chk_invitation_role
        CHECK (role IN ('admin', 'member', 'viewer'));
    """)

    # ── Indexes ───────────────────────────────────────────────────────────
    op.create_index("idx_squads_invite_code", "squads", ["invite_code"])
    op.create_index("idx_squads_created_by", "squads", ["created_by"])
    op.create_index("idx_invitations_squad", "invitations", ["squad_id"])
    op.create_index("idx_invitations_token", "invitations", ["token"])
    op.create_index("idx_invitations_status", "invitations", ["status"],
                    postgresql_where=sa.text("status = 'pending'"))
    op.create_index("idx_invitations_invited_email", "invitations", ["invited_email"],
                    postgresql_where=sa.text("status = 'pending'"))

    # ── Trigger: keep squads.member_count in sync ─────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION update_squad_member_count()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE squads SET member_count = (
                    SELECT COUNT(*) FROM squad_members
                    WHERE squad_id = NEW.squad_id AND removed_at IS NULL
                ), updated_at = NOW()
                WHERE id = NEW.squad_id;
            ELSIF TG_OP = 'UPDATE' THEN
                -- Handle soft-remove (removed_at set) or role change
                UPDATE squads SET member_count = (
                    SELECT COUNT(*) FROM squad_members
                    WHERE squad_id = NEW.squad_id AND removed_at IS NULL
                ), updated_at = NOW()
                WHERE id = NEW.squad_id;
                -- If squad_id changed (shouldn't happen, but safety)
                IF OLD.squad_id IS DISTINCT FROM NEW.squad_id THEN
                    UPDATE squads SET member_count = (
                        SELECT COUNT(*) FROM squad_members
                        WHERE squad_id = OLD.squad_id AND removed_at IS NULL
                    ), updated_at = NOW()
                    WHERE id = OLD.squad_id;
                END IF;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE squads SET member_count = (
                    SELECT COUNT(*) FROM squad_members
                    WHERE squad_id = OLD.squad_id AND removed_at IS NULL
                ), updated_at = NOW()
                WHERE id = OLD.squad_id;
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$;
    """)

    op.execute("""
        CREATE TRIGGER trg_squad_member_count
        AFTER INSERT OR UPDATE OR DELETE ON squad_members
        FOR EACH ROW EXECUTE FUNCTION update_squad_member_count();
    """)

    # ── Backfill existing member counts ───────────────────────────────────
    op.execute("""
        UPDATE squads SET member_count = (
            SELECT COUNT(*) FROM squad_members sm
            WHERE sm.squad_id = squads.id AND sm.removed_at IS NULL
        );
    """)

    # ── RLS on invitations ────────────────────────────────────────────────
    op.execute("ALTER TABLE invitations ENABLE ROW LEVEL SECURITY")

    op.execute("""
        CREATE POLICY "Invitees can view own invitations"
        ON invitations FOR SELECT
        USING (
            invited_user_id = auth.uid()
            OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        );
    """)

    op.execute("""
        CREATE POLICY "Squad admins can view squad invitations"
        ON invitations FOR SELECT
        USING (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)

    op.execute("""
        CREATE POLICY "Squad admins can create invitations"
        ON invitations FOR INSERT
        WITH CHECK (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)

    op.execute("""
        CREATE POLICY "Invitees can update own invitations"
        ON invitations FOR UPDATE
        USING (
            invited_user_id = auth.uid()
            OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        );
    """)

    op.execute("""
        CREATE POLICY "Squad admins can update invitations"
        ON invitations FOR UPDATE
        USING (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)

    # ── RLS policies for squad_members INSERT/UPDATE/DELETE ────────────────
    op.execute("""
        CREATE POLICY "Admins can insert squad members"
        ON squad_members FOR INSERT
        WITH CHECK (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)

    op.execute("""
        CREATE POLICY "Admins can update squad members"
        ON squad_members FOR UPDATE
        USING (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)

    op.execute("""
        CREATE POLICY "Admins can delete squad members"
        ON squad_members FOR DELETE
        USING (has_squad_role(squad_id, ARRAY['owner', 'admin']));
    """)


def downgrade() -> None:
    # Drop RLS policies
    for policy in [
        "Admins can delete squad members",
        "Admins can update squad members",
        "Admins can insert squad members",
        "Squad admins can update invitations",
        "Invitees can update own invitations",
        "Squad admins can create invitations",
        "Squad admins can view squad invitations",
        "Invitees can view own invitations",
    ]:
        op.execute(f'DROP POLICY IF EXISTS "{policy}" ON invitations')

    op.execute("DROP TRIGGER IF EXISTS trg_squad_member_count ON squad_members")
    op.execute("DROP FUNCTION IF EXISTS update_squad_member_count()")

    op.drop_index("idx_invitations_invited_email")
    op.drop_index("idx_invitations_status")
    op.drop_index("idx_invitations_token")
    op.drop_index("idx_invitations_squad")
    op.drop_index("idx_squads_created_by")
    op.drop_index("idx_squads_invite_code")

    op.execute("ALTER TABLE invitations DROP CONSTRAINT IF EXISTS chk_invitation_role")
    op.execute("ALTER TABLE invitations DROP CONSTRAINT IF EXISTS chk_invitation_status")
    op.execute("ALTER TABLE squad_members DROP CONSTRAINT IF EXISTS chk_squad_member_role")

    op.drop_column("invitations", "accepted_at")
    op.drop_column("invitations", "accepted_by")
    op.drop_column("squads", "member_count")
