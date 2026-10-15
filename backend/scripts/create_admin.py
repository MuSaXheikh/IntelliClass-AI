"""Create (or promote to) an admin account: the only way to reach GET /audit.

From backend/:  uv run python -m scripts.create_admin --email admin@uni.edu --name "Audit Admin"
The password comes from --password or ADMIN_PASSWORD, or is generated and printed once.
"""

import argparse
import logging
import os
import secrets
import sys

from sqlalchemy import select

from app import models  # noqa: F401
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import Role, User
from app.schemas.common import bcrypt_safe

logger = logging.getLogger("create_admin")


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"), required=False)
    parser.add_argument("--name", default=os.environ.get("ADMIN_NAME", "Administrator"))
    parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD"))
    args = parser.parse_args(argv)
    if not args.email:
        parser.error("--email (or ADMIN_EMAIL) is required")
    generated = not args.password
    password = bcrypt_safe(args.password or secrets.token_urlsafe(12))
    with SessionLocal() as db:
        user = db.scalars(select(User).where(User.email == args.email.lower())).first()
        if user is None:
            user = User(
                email=args.email.lower(),
                password_hash=hash_password(password),
                full_name=args.name,
                role=Role.ADMIN,
            )
            db.add(user)
        else:
            user.role = Role.ADMIN
            if not generated:
                user.password_hash = hash_password(password)
        db.commit()
    logger.info("admin %s ready", args.email.lower())
    if generated:
        logger.info("password (shown once): %s", password)
    return 0


if __name__ == "__main__":
    sys.exit(main())
