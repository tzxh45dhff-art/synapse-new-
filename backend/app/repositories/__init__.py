"""Data-access layer. No SQL lives in services — it lives here.

Repositories are thin, session-scoped objects: instantiate with an
``AsyncSession`` and call methods. Transaction control (commit/rollback) stays
with the caller (service / request lifecycle).
"""
