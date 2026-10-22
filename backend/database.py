
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text, event
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = PROJECT_ROOT / "infrapredict.db"


def _create_sqlite_engine():
    sqlite_url = f"sqlite:///{SQLITE_DB_PATH}"
    eng = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(eng, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return eng


def get_engine():
    db_type = os.getenv("DB_TYPE", "").lower()
    if db_type == "sqlite":
        return _create_sqlite_engine()

    try:
        import psycopg2  # noqa: F401

        database_url = URL.create(
            drivername="postgresql+psycopg2",
            username=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "infrapredict"),
        )
        pg_engine = create_engine(database_url, pool_pre_ping=True)
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return pg_engine
    except Exception as exc:
        logger.warning(
            "PostgreSQL connection unavailable (%s). Falling back to SQLite: %s",
            exc,
            SQLITE_DB_PATH,
        )
        return _create_sqlite_engine()


engine = get_engine()


def check_database_connection() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False