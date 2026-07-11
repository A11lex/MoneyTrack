from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
from app.database import init_db


TABLES = [
    "line_users",
    "transactions",
    "user_categories",
    "user_budgets",
    "recurring_transactions",
    "daily_reminder_settings",
    "user_settings",
    "category_memory_mappings",
    "processed_line_webhook_events",
]

IDENTITY_TABLES = {
    "transactions",
    "user_categories",
    "user_budgets",
    "recurring_transactions",
    "category_memory_mappings",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Copy MoneyTrack data from SQLite to PostgreSQL")
    parser.add_argument("--source", default="moneytrack.db", help="Path to the existing SQLite database")
    parser.add_argument(
        "--target",
        default=os.getenv("DATABASE_URL", ""),
        help="PostgreSQL URL; defaults to DATABASE_URL",
    )
    return parser.parse_args()


def sqlite_rows(connection: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    if exists is None:
        return []
    return [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"').fetchall()]


def copy_table(source: sqlite3.Connection, target: psycopg.Connection[Any], table: str) -> int:
    rows = sqlite_rows(source, table)
    if not rows:
        return 0

    columns = list(rows[0])
    statement = sql.SQL("INSERT INTO {} ({}) VALUES ({}) ON CONFLICT DO NOTHING").format(
        sql.Identifier(table),
        sql.SQL(", ").join(sql.Identifier(column) for column in columns),
        sql.SQL(", ").join(sql.Placeholder() for _ in columns),
    )
    with target.cursor() as cursor:
        cursor.executemany(statement, [tuple(row[column] for column in columns) for row in rows])
    return len(rows)


def reset_identity(target: psycopg.Connection[Any], table: str) -> None:
    with target.cursor() as cursor:
        cursor.execute(
            sql.SQL(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), "
                "COALESCE((SELECT MAX(id) FROM {}), 1), "
                "EXISTS(SELECT 1 FROM {}))"
            ).format(sql.Identifier(table), sql.Identifier(table)),
            (table,),
        )


def main() -> None:
    args = parse_args()
    source_path = Path(args.source).expanduser().resolve()
    if not source_path.is_file():
        raise SystemExit(f"SQLite source does not exist: {source_path}")
    if not args.target.startswith(("postgresql://", "postgres://")):
        raise SystemExit("--target or DATABASE_URL must be a PostgreSQL URL")

    init_db(args.target)
    source = sqlite3.connect(source_path)
    source.row_factory = sqlite3.Row
    target_url = args.target.replace("postgres://", "postgresql://", 1)

    copied: dict[str, int] = {}
    try:
        with psycopg.connect(target_url) as target:
            for table in TABLES:
                copied[table] = copy_table(source, target, table)
            for table in IDENTITY_TABLES:
                reset_identity(target, table)
    finally:
        source.close()

    print("Migration complete")
    for table, count in copied.items():
        print(f"  {table}: {count}")


if __name__ == "__main__":
    main()
