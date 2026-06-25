"""Environment-driven configuration for Pindrop.

Two switches keep the backend runnable before cloud resources exist:

* DB_DRIVER   = local | dsql
* STRIPE_MODE = mock  | test
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


# --- Database -------------------------------------------------------------
DB_DRIVER = os.getenv("DB_DRIVER", "local").lower()

# Local Postgres fallback (used when DB_DRIVER=local).
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/pindrop"
)

# Aurora DSQL (used when DB_DRIVER=dsql). The password is an IAM token minted at
# connect time by boto3's DsqlSigner -- never put a static token here.
DSQL_CLUSTER_ENDPOINT = os.getenv("DSQL_CLUSTER_ENDPOINT", "")
DSQL_USER = os.getenv("DSQL_USER", "admin")
DSQL_DATABASE = os.getenv("DSQL_DATABASE", "postgres")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


# --- Stripe ---------------------------------------------------------------
STRIPE_MODE = os.getenv("STRIPE_MODE", "mock").lower()
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
