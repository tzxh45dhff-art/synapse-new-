"""Main API v1 router — aggregates all endpoint routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import squads, invitations, vaults, resources

api_router = APIRouter()


# Health / ping (always available)
@api_router.get("/ping", tags=["system"])
async def ping():
    return {"message": "pong"}


# ── Feature routers ──────────────────────────────────────────────────────
api_router.include_router(squads.router, prefix="/squads", tags=["squads"])
api_router.include_router(invitations.router, tags=["invitations"])
api_router.include_router(vaults.router, tags=["vaults"])
api_router.include_router(resources.router, tags=["resources"])

# Future routers:
# api_router.include_router(notes.router, prefix="/notes", tags=["notes"])
# api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
# api_router.include_router(flashcards.router, prefix="/flashcards", tags=["flashcards"])
# api_router.include_router(chat.router, prefix="/chat", tags=["chat"])

