"""Import all models here so Alembic can detect them for autogenerate."""

from app.db.session import Base  # noqa: F401

# Core Models
from app.models.profile import Profile  # noqa: F401
from app.models.squad import Squad, SquadMember, Invitation  # noqa: F401
from app.models.vault import Vault, Subject  # noqa: F401
from app.models.resource import Resource, ResourceChunk, ResourceProcessingJob  # noqa: F401
from app.models.note import Note, NoteVersion, NoteGeneration  # noqa: F401
from app.models.quiz import Quiz, QuizQuestion, QuizSession, QuizAnswer  # noqa: F401
from app.models.flashcard import Flashcard, FlashcardReview, SpacedRepetitionState  # noqa: F401
from app.models.intelligence import (  # noqa: F401
    TopicMastery,
    StudySession,
    StudyStreak,
    ExamReadiness,
    ReadinessHistory,
    Exam,
)
from app.models.roadmap import Roadmap, RoadmapTask, RoadmapProgress  # noqa: F401
from app.models.chat import ChatSession, ChatMessage, Citation, ChatFeedback  # noqa: F401
from app.models.ai_generation import AIGeneration  # noqa: F401
from app.models.expense import Expense, ExpenseSplit, Settlement  # noqa: F401
from app.models.system import ActivityLog, Notification, UserPreference  # noqa: F401
from app.models.tag import Tag, ResourceTag, NoteTag, QuizTag, FlashcardTag  # noqa: F401
