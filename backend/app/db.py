"""SQLAlchemy engine + session factory, switchable between local Postgres and DSQL.

DB_DRIVER=local -> plain psycopg connection to DATABASE_URL.
DB_DRIVER=dsql  -> psycopg connection to the DSQL endpoint, with the password
                   supplied per-connection as a fresh IAM token from boto3's
                   DsqlSigner (tokens expire ~15 min, so we mint one on each
                   new physical connection rather than caching).

We deliberately do NOT use Alembic / ORM migration runners that rely on SERIAL
tracking tables -- DSQL rejects SERIAL. Schema is created via Base.metadata
.create_all (see init_db), which emits plain CREATE TABLE with UUID PKs.
"""

from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from . import config
from .models import Base


def _build_local_engine() -> Engine:
    return create_engine(
        config.DATABASE_URL,
        pool_pre_ping=True,
        future=True,
    )


def _build_dsql_engine() -> Engine:
    """DSQL engine that injects a fresh IAM auth token as the password per connect.

    boto3's dsql client mints the token locally by signing with the current IAM
    credentials -- it does not call AWS, so this is cheap to do on every connect.
    """
    import boto3

    # The SQLAlchemy URL carries everything except the password; the `do_connect`
    # event below fills the password in with a freshly minted token.
    url = (
        f"postgresql+psycopg://{config.DSQL_USER}@"
        f"{config.DSQL_CLUSTER_ENDPOINT}:5432/{config.DSQL_DATABASE}"
    )
    engine = create_engine(
        url,
        pool_pre_ping=True,
        future=True,
        connect_args={"sslmode": "require"},
        # DSQL does not support SAVEPOINT, which psycopg's dialect uses on first connect
        # to probe the hstore type OID (see PGDialect_psycopg.initialize). Disabling the
        # native hstore adapter skips that probe so the connection initializes cleanly.
        # DSQL has no hstore type and we don't use it, so this is purely upside.
        use_native_hstore=False,
    )

    dsql_client = boto3.client("dsql", region_name=config.AWS_REGION)

    @event.listens_for(engine, "do_connect")
    def _provide_token(dialect, conn_rec, cargs, cparams):  # noqa: ANN001
        # admin role -> admin auth token; mint fresh on every physical connect so a
        # long-lived pool never carries an expired (~15 min) token.
        cparams["password"] = dsql_client.generate_db_connect_admin_auth_token(
            config.DSQL_CLUSTER_ENDPOINT, config.AWS_REGION
        )

    return engine


def _make_engine() -> Engine:
    if config.DB_DRIVER == "dsql":
        return _build_dsql_engine()
    return _build_local_engine()


engine: Engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Create all tables (idempotent). Used by scripts/create_tables.py and tests.

    DSQL allows only ONE DDL statement per transaction, so we can't use the default
    create_all (which batches every CREATE TABLE into a single transaction). Instead we
    emit each table's CREATE in its own autocommit transaction. On local Postgres/SQLite
    the plain create_all is fine.
    """
    if config.DB_DRIVER == "dsql":
        _create_all_dsql()
    else:
        Base.metadata.create_all(engine)


def _create_all_dsql() -> None:
    """Create each table in its own transaction (DSQL: one DDL per tx)."""
    from sqlalchemy.schema import CreateTable

    # checkfirst-style: create only tables that don't already exist, in dependency order.
    inspector_conn = engine.connect()
    try:
        from sqlalchemy import inspect

        existing = set(inspect(inspector_conn).get_table_names())
    finally:
        inspector_conn.close()

    # AUTOCOMMIT isolation -> each statement commits on its own (one DDL per tx).
    autocommit = engine.execution_options(isolation_level="AUTOCOMMIT")
    for table in Base.metadata.sorted_tables:
        if table.name in existing:
            continue
        with autocommit.connect() as conn:
            conn.execute(CreateTable(table))


def get_session():
    """FastAPI dependency: yields a session, closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
