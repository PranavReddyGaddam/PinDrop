"""Test fixtures: an in-memory SQLite database wired into the app.

We don't need Postgres/DSQL to verify the application logic (pricing, the cap-guard
commit flow, settlement chunking). SQLite in-memory runs in-process with zero setup.

DSQL-specific behaviors (true SELECT FOR UPDATE blocking, server-side gen_random_uuid,
40001 OCC conflicts) are verified separately against the real cluster -- the models use
a Python-side uuid4 default so inserts work identically here.
"""

from __future__ import annotations

import os

os.environ.setdefault("DB_DRIVER", "local")
os.environ.setdefault("STRIPE_MODE", "mock")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db as db_module
from app.models import Base


@pytest.fixture()
def engine():
    # StaticPool + shared in-memory DB so every connection sees the same tables.
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    # SQLite needs FK pragma off (we have none) and behaves fine without it; nothing
    # special required for our schema.
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture()
def session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


@pytest.fixture()
def client(engine, session_factory, monkeypatch):
    # Point the app's engine + session factory at the test SQLite DB.
    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "SessionLocal", session_factory)

    # main.py imported SessionLocal/init_db by value at import time; patch those too.
    import app.main as main_module

    monkeypatch.setattr(main_module, "SessionLocal", session_factory)

    with TestClient(main_module.app) as c:
        yield c
