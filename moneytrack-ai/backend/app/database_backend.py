from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from typing import Any


DatabaseKind = str


def database_kind(database_url: str) -> DatabaseKind:
    normalized = database_url.strip().lower()
    if normalized.startswith(("postgresql://", "postgres://")):
        return "postgresql"
    return "sqlite"


def require_persistent_database(database_url: str, render_environment: str | None) -> None:
    running_on_render = (render_environment or "").strip().lower() in {"1", "true", "yes"}
    if running_on_render and database_kind(database_url) != "postgresql":
        raise RuntimeError(
            "Render production requires a persistent PostgreSQL DATABASE_URL; "
            "refusing to start with ephemeral SQLite"
        )


def sqlite_path(database_url: str) -> str:
    if database_url.startswith("sqlite:///"):
        return database_url.removeprefix("sqlite:///")
    return database_url


def adapt_sql(sql: str, kind: DatabaseKind) -> str:
    if kind != "postgresql":
        return sql

    adapted = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "BIGSERIAL PRIMARY KEY")
    adapted = adapted.replace("?", "%s")
    if re.match(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+", adapted, flags=re.IGNORECASE):
        adapted = re.sub(r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", adapted, count=1, flags=re.IGNORECASE)
        adapted = f"{adapted.strip()} ON CONFLICT DO NOTHING"
    return adapted


class DatabaseCursor:
    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    @property
    def lastrowid(self) -> int | None:
        return getattr(self._cursor, "lastrowid", None)

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()


class DatabaseConnection:
    def __init__(self, connection: Any, kind: DatabaseKind) -> None:
        self._connection = connection
        self.kind = kind

    def execute(self, sql: str, parameters: Sequence[object] = ()) -> DatabaseCursor:
        cursor = self._connection.execute(adapt_sql(sql, self.kind), tuple(parameters))
        return DatabaseCursor(cursor)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()


@contextmanager
def connect(database_url: str) -> Iterator[DatabaseConnection]:
    kind = database_kind(database_url)
    if kind == "postgresql":
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as error:
            raise RuntimeError("PostgreSQL DATABASE_URL requires psycopg") from error

        normalized_url = database_url.replace("postgres://", "postgresql://", 1)
        raw_connection = psycopg.connect(normalized_url, row_factory=dict_row)
    else:
        raw_connection = sqlite3.connect(sqlite_path(database_url))
        raw_connection.row_factory = sqlite3.Row

    connection = DatabaseConnection(raw_connection, kind)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def inserted_id(connection: DatabaseConnection, insert_sql: str, parameters: Sequence[object]) -> int:
    if connection.kind == "postgresql":
        row = connection.execute(f"{insert_sql.rstrip()} RETURNING id", parameters).fetchone()
        if not isinstance(row, Mapping) or "id" not in row:
            raise RuntimeError("Database insert did not return an id")
        return int(row["id"])

    cursor = connection.execute(insert_sql, parameters)
    if cursor.lastrowid is None:
        raise RuntimeError("Database insert did not return an id")
    return int(cursor.lastrowid)
