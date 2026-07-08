from fastapi import HTTPException, status


class BunkerException(HTTPException):
    """Base exception for all Bunker API errors."""
    pass


class NotFoundError(BunkerException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found.")


class ForbiddenError(BunkerException):
    def __init__(self, detail: str = "Insufficient permissions."):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class UnauthorizedError(BunkerException):
    def __init__(self, detail: str = "Authentication required."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ConflictError(BunkerException):
    def __init__(self, detail: str = "Resource already exists."):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class ValidationError(BunkerException):
    def __init__(self, detail: str = "Validation failed."):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class RateLimitError(BunkerException):
    def __init__(self, detail: str = "Rate limit exceeded."):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)
