"""Optimistic-concurrency retry wrapper for Aurora DSQL.

This is the single most important piece of infrastructure in the project. DSQL uses
OCC: when two transactions conflict, the loser's COMMIT fails with SQLSTATE 40001
(serialization failure). The fix is to retry the whole transaction with exponential
backoff + jitter.

Every write transaction must go through `with_dsql_retry`. Reads (e.g. COUNT(*)) take a
consistent snapshot and never conflict, so they don't need it.

The 40001 detection works against both drivers:
* DSQL via psycopg -> raises psycopg.errors.SerializationFailure (sqlstate '40001')
* local Postgres   -> never raises 40001 here (we don't run SERIALIZABLE locally), so
                      the wrapper is a transparent pass-through in local dev.
"""

from __future__ import annotations

import random
import time
from typing import Callable, TypeVar

from sqlalchemy.exc import DBAPIError, OperationalError

T = TypeVar("T")

MAX_RETRIES = 5
BASE_DELAY_S = 0.05  # 50 ms
OCC_SQLSTATE = "40001"


def _is_occ_conflict(exc: BaseException) -> bool:
    """True if `exc` (or its DBAPI cause) carries SQLSTATE 40001."""
    # SQLAlchemy wraps driver errors; psycopg exposes the SQLSTATE on .sqlstate.
    orig = getattr(exc, "orig", None)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(exc, "sqlstate", None)
    if sqlstate == OCC_SQLSTATE:
        return True
    # Fallback: some wrappers only carry pgcode.
    pgcode = getattr(orig, "pgcode", None)
    return pgcode == OCC_SQLSTATE


def with_dsql_retry(operation: Callable[[], T], retries: int = MAX_RETRIES) -> T:
    """Run `operation`, retrying on OCC conflict with exponential backoff + jitter.

    `operation` should perform a full unit of work (open a session/transaction, do the
    writes, commit) so that a retry re-runs the whole thing cleanly.
    """
    last_exc: BaseException | None = None
    for attempt in range(retries + 1):
        try:
            return operation()
        except (DBAPIError, OperationalError) as exc:
            last_exc = exc
            if _is_occ_conflict(exc) and attempt < retries:
                delay = BASE_DELAY_S * (2**attempt) + random.random() * 0.05
                time.sleep(delay)
                continue
            raise
    # Unreachable in practice; keeps type-checkers happy.
    assert last_exc is not None
    raise last_exc
