"""Authentication dependencies and role-based access control."""

from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import Role, User

_bearer = HTTPBearer(auto_error=False)


def user_from_token(token: str | None, db: Session) -> User | None:
    """Resolve a JWT to a User row (used by HTTP and WebSocket auth)."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    return db.get(User, user_id) if isinstance(user_id, str) else None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Require a valid bearer token and return the user."""
    token = credentials.credentials if credentials else None
    user = user_from_token(token, db)
    if user is None:
        raise ApiError(401, "UNAUTHORIZED", "Missing or invalid token")
    return user


def require_roles(*roles: Role) -> Callable[..., User]:
    """Dependency factory: allow only the given roles."""

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ApiError(403, "FORBIDDEN", "This action is not allowed for your role")
        return user

    return _check
