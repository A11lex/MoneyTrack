import os
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Iterator

from .models import Transaction, TransactionCreate, TransactionUpdate

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", str(BASE_DIR / "moneytrack.db"))


@contextmanager
def get_connection(db_path: str | None = None) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path or DATABASE_URL)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(db_path: str | None = None) -> None:
    with get_connection(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                amount REAL NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                mode TEXT NOT NULL CHECK(mode IN ('personal', 'business'))
            )
            """
        )


def row_to_transaction(row: sqlite3.Row) -> Transaction:
    return Transaction(
        id=row["id"],
        date=date.fromisoformat(row["date"]),
        type=row["type"],
        amount=row["amount"],
        category=row["category"],
        description=row["description"],
        mode=row["mode"],
    )


def list_transactions(db_path: str | None = None) -> list[Transaction]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM transactions ORDER BY date DESC, id DESC").fetchall()
        return [row_to_transaction(row) for row in rows]


def create_transaction(payload: TransactionCreate, db_path: str | None = None) -> Transaction:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            INSERT INTO transactions (date, type, amount, category, description, mode)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.date.isoformat(),
                payload.type.value,
                payload.amount,
                payload.category,
                payload.description,
                payload.mode.value,
            ),
        )
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return row_to_transaction(row)


def update_transaction(transaction_id: int, payload: TransactionUpdate, db_path: str | None = None) -> Transaction | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        existing = conn.execute("SELECT id FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        if existing is None:
            return None
        conn.execute(
            """
            UPDATE transactions
            SET date = ?, type = ?, amount = ?, category = ?, description = ?, mode = ?
            WHERE id = ?
            """,
            (
                payload.date.isoformat(),
                payload.type.value,
                payload.amount,
                payload.category,
                payload.description,
                payload.mode.value,
                transaction_id,
            ),
        )
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        return row_to_transaction(row)


def delete_transaction(transaction_id: int, db_path: str | None = None) -> bool:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        return cursor.rowcount > 0


def seed_demo_data(db_path: str | None = None) -> None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        if count:
            return
    demo = [
        TransactionCreate(date=date(2026, 6, 1), type="income", amount=4200, category="Salary", description="Monthly salary", mode="personal"),
        TransactionCreate(date=date(2026, 6, 3), type="income", amount=1800, category="Business Revenue", description="Client invoice", mode="business"),
        TransactionCreate(date=date(2026, 6, 4), type="expense", amount=1300, category="Rent / Home", description="Apartment rent", mode="personal"),
        TransactionCreate(date=date(2026, 6, 5), type="expense", amount=420, category="Food", description="Groceries and restaurants", mode="personal"),
        TransactionCreate(date=date(2026, 6, 7), type="expense", amount=280, category="Transport", description="Fuel and rides", mode="personal"),
        TransactionCreate(date=date(2026, 6, 10), type="expense", amount=780, category="Debt Payment", description="Loan payment", mode="personal"),
        TransactionCreate(date=date(2026, 6, 12), type="expense", amount=360, category="Shopping", description="Household items", mode="personal"),
        TransactionCreate(date=date(2026, 6, 14), type="expense", amount=640, category="Business Cost", description="Software and contractors", mode="business"),
        TransactionCreate(date=date(2026, 6, 18), type="income", amount=950, category="Freelance", description="Side project", mode="personal"),
        TransactionCreate(date=date(2026, 6, 20), type="expense", amount=210, category="Utilities", description="Power and internet", mode="personal"),
    ]
    for item in demo:
        create_transaction(item, db_path)
