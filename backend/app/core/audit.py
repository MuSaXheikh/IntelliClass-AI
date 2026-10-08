"""Audit logging: who did what to whose data."""

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record_audit(
    db: Session,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    target_user_id: str | None = None,
) -> AuditLog:
    """Append an audit row. Caller commits."""
    row = AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_user_id=target_user_id,
    )
    db.add(row)
    return row
