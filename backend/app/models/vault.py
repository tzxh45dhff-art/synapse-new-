"""SQLAlchemy models: Vault, Subject, VaultStatistics."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    icon: Mapped[str | None] = mapped_column(String(50))
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    children: Mapped[list["Subject"]] = relationship("Subject")


class Vault(Base):
    __tablename__ = "vaults"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    squad_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("squads.id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL")
    )
    created_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(7))
    icon: Mapped[str | None] = mapped_column(String(50))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    squad: Mapped["Squad"] = relationship(back_populates="vaults")  # type: ignore
    resources: Mapped[list] = relationship("Resource", back_populates="vault")
    statistics: Mapped["VaultStatistics | None"] = relationship(back_populates="vault", uselist=False)


class VaultStatistics(Base):
    """Trigger-maintained stats table. Never write manually — let the trigger do it."""
    __tablename__ = "vault_statistics"

    vault_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("vaults.id", ondelete="CASCADE"), primary_key=True)
    resource_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    storage_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    pdf_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ppt_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    doc_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    image_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    other_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_upload_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    contributor_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    vault: Mapped["Vault"] = relationship(back_populates="statistics")
