"""Create all tables on the configured database (local or DSQL).

Usage (from backend/):
    venv/bin/python -m scripts.create_tables

Uses Base.metadata.create_all -- plain CREATE TABLE with UUID PKs, no SERIAL, so it
works on Aurora DSQL. (Do NOT use Alembic's default SERIAL-based version table on DSQL.)
"""

from app.db import init_db


def main() -> None:
    init_db()
    print("Tables created (or already existed).")


if __name__ == "__main__":
    main()
