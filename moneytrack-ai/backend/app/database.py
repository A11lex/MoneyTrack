import os
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Iterator

from .models import (
    LineUserUpsert,
    OnboardingPayload,
    RecurringTransaction,
    RecurringTransactionCreate,
    RecurringTransactionUpdate,
    Transaction,
    TransactionCreate,
    TransactionUpdate,
    UserSetup,
)

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
                line_user_id TEXT,
                date TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                amount REAL NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                mode TEXT NOT NULL CHECK(mode IN ('personal', 'business'))
            )
            """
        )
        _ensure_column(conn, "transactions", "line_user_id", "TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS line_users (
                line_user_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL DEFAULT '',
                picture_url TEXT,
                onboarding_completed INTEGER NOT NULL DEFAULT 0,
                discovery_source TEXT,
                budget_cycle TEXT NOT NULL DEFAULT 'monthly',
                budget_start_day INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        _ensure_column(conn, "line_users", "budget_cycle", "TEXT NOT NULL DEFAULT 'monthly'")
        _ensure_column(conn, "line_users", "budget_start_day", "INTEGER NOT NULL DEFAULT 1")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                line_user_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                category TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                is_recommended INTEGER NOT NULL DEFAULT 0,
                UNIQUE(line_user_id, type, category),
                FOREIGN KEY(line_user_id) REFERENCES line_users(line_user_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                line_user_id TEXT NOT NULL,
                category TEXT NOT NULL,
                monthly_limit REAL NOT NULL CHECK(monthly_limit >= 0),
                UNIQUE(line_user_id, category),
                FOREIGN KEY(line_user_id) REFERENCES line_users(line_user_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS recurring_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                line_user_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                amount REAL NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                mode TEXT NOT NULL CHECK(mode IN ('personal', 'business')),
                interval TEXT NOT NULL CHECK(interval IN ('daily', 'weekly', 'monthly', 'yearly')),
                day_of_week INTEGER,
                day_of_month INTEGER,
                month INTEGER,
                notify_time TEXT NOT NULL,
                last_run_date TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(line_user_id) REFERENCES line_users(line_user_id)
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


def row_to_recurring_transaction(row: sqlite3.Row) -> RecurringTransaction:
    return RecurringTransaction(
        id=row["id"],
        line_user_id=row["line_user_id"],
        type=row["type"],
        amount=row["amount"],
        category=row["category"],
        description=row["description"],
        mode=row["mode"],
        interval=row["interval"],
        day_of_week=row["day_of_week"],
        day_of_month=row["day_of_month"],
        month=row["month"],
        notify_time=row["notify_time"],
        last_run_date=date.fromisoformat(row["last_run_date"]) if row["last_run_date"] else None,
    )


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def list_transactions(db_path: str | None = None, line_user_id: str | None = None) -> list[Transaction]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        if line_user_id:
            rows = conn.execute(
                "SELECT * FROM transactions WHERE line_user_id = ? ORDER BY date DESC, id DESC",
                (line_user_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM transactions ORDER BY date DESC, id DESC").fetchall()
        return [row_to_transaction(row) for row in rows]


def get_transaction(transaction_id: int, db_path: str | None = None, line_user_id: str | None = None) -> Transaction | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        if line_user_id:
            row = conn.execute(
                "SELECT * FROM transactions WHERE id = ? AND line_user_id = ?",
                (transaction_id, line_user_id),
            ).fetchone()
        else:
            row = conn.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        return row_to_transaction(row) if row else None


def create_transaction(payload: TransactionCreate, db_path: str | None = None, line_user_id: str | None = None) -> Transaction:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            INSERT INTO transactions (line_user_id, date, type, amount, category, description, mode)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                line_user_id,
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


def update_transaction(transaction_id: int, payload: TransactionUpdate, db_path: str | None = None, line_user_id: str | None = None) -> Transaction | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        if line_user_id:
            existing = conn.execute(
                "SELECT id FROM transactions WHERE id = ? AND line_user_id = ?",
                (transaction_id, line_user_id),
            ).fetchone()
        else:
            existing = conn.execute("SELECT id FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        if existing is None:
            return None
        if line_user_id:
            conn.execute(
                """
                UPDATE transactions
                SET date = ?, type = ?, amount = ?, category = ?, description = ?, mode = ?
                WHERE id = ? AND line_user_id = ?
                """,
                (
                    payload.date.isoformat(),
                    payload.type.value,
                    payload.amount,
                    payload.category,
                    payload.description,
                    payload.mode.value,
                    transaction_id,
                    line_user_id,
                ),
            )
            row = conn.execute("SELECT * FROM transactions WHERE id = ? AND line_user_id = ?", (transaction_id, line_user_id)).fetchone()
        else:
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


def delete_transaction(transaction_id: int, db_path: str | None = None, line_user_id: str | None = None) -> bool:
    init_db(db_path)
    with get_connection(db_path) as conn:
        if line_user_id:
            cursor = conn.execute("DELETE FROM transactions WHERE id = ? AND line_user_id = ?", (transaction_id, line_user_id))
        else:
            cursor = conn.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        return cursor.rowcount > 0


def list_recurring_transactions(db_path: str | None = None, line_user_id: str | None = None) -> list[RecurringTransaction]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        if line_user_id:
            rows = conn.execute(
                "SELECT * FROM recurring_transactions WHERE line_user_id = ? ORDER BY id DESC",
                (line_user_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM recurring_transactions ORDER BY id DESC").fetchall()
        return [row_to_recurring_transaction(row) for row in rows]


def get_recurring_transaction(
    recurring_id: int,
    db_path: str | None = None,
    line_user_id: str | None = None,
) -> RecurringTransaction | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        if line_user_id:
            row = conn.execute(
                "SELECT * FROM recurring_transactions WHERE id = ? AND line_user_id = ?",
                (recurring_id, line_user_id),
            ).fetchone()
        else:
            row = conn.execute("SELECT * FROM recurring_transactions WHERE id = ?", (recurring_id,)).fetchone()
        return row_to_recurring_transaction(row) if row else None


def create_recurring_transaction(
    payload: RecurringTransactionCreate,
    line_user_id: str,
    db_path: str | None = None,
) -> RecurringTransaction:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            """
            INSERT INTO recurring_transactions (
                line_user_id, type, amount, category, description, mode, interval,
                day_of_week, day_of_month, month, notify_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                line_user_id,
                payload.type.value,
                payload.amount,
                payload.category,
                payload.description,
                payload.mode.value,
                payload.interval,
                payload.day_of_week,
                payload.day_of_month,
                payload.month,
                payload.notify_time,
            ),
        )
        row = conn.execute("SELECT * FROM recurring_transactions WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return row_to_recurring_transaction(row)


def update_recurring_transaction(
    recurring_id: int,
    payload: RecurringTransactionUpdate,
    line_user_id: str,
    db_path: str | None = None,
) -> RecurringTransaction | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        existing = conn.execute(
            "SELECT id FROM recurring_transactions WHERE id = ? AND line_user_id = ?",
            (recurring_id, line_user_id),
        ).fetchone()
        if existing is None:
            return None
        conn.execute(
            """
            UPDATE recurring_transactions
            SET type = ?,
                amount = ?,
                category = ?,
                description = ?,
                mode = ?,
                interval = ?,
                day_of_week = ?,
                day_of_month = ?,
                month = ?,
                notify_time = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND line_user_id = ?
            """,
            (
                payload.type.value,
                payload.amount,
                payload.category,
                payload.description,
                payload.mode.value,
                payload.interval,
                payload.day_of_week,
                payload.day_of_month,
                payload.month,
                payload.notify_time,
                recurring_id,
                line_user_id,
            ),
        )
        row = conn.execute(
            "SELECT * FROM recurring_transactions WHERE id = ? AND line_user_id = ?",
            (recurring_id, line_user_id),
        ).fetchone()
        return row_to_recurring_transaction(row)


def delete_recurring_transaction(recurring_id: int, line_user_id: str, db_path: str | None = None) -> bool:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            "DELETE FROM recurring_transactions WHERE id = ? AND line_user_id = ?",
            (recurring_id, line_user_id),
        )
        return cursor.rowcount > 0


def mark_recurring_transaction_run(
    recurring_id: int,
    line_user_id: str,
    run_date: date,
    db_path: str | None = None,
) -> None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            UPDATE recurring_transactions
            SET last_run_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND line_user_id = ?
            """,
            (run_date.isoformat(), recurring_id, line_user_id),
        )


def upsert_line_user(payload: LineUserUpsert, db_path: str | None = None) -> UserSetup:
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO line_users (line_user_id, display_name, picture_url)
            VALUES (?, ?, ?)
            ON CONFLICT(line_user_id) DO UPDATE SET
                display_name = excluded.display_name,
                picture_url = excluded.picture_url,
                updated_at = CURRENT_TIMESTAMP
            """,
            (payload.line_user_id, payload.display_name, payload.picture_url),
        )
    setup = get_user_setup(payload.line_user_id, db_path)
    if setup is None:
        raise RuntimeError("LINE user upsert failed")
    return setup


def get_user_setup(line_user_id: str, db_path: str | None = None) -> UserSetup | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        user = conn.execute("SELECT * FROM line_users WHERE line_user_id = ?", (line_user_id,)).fetchone()
        if user is None:
            return None

        category_rows = conn.execute(
            """
            SELECT type, category FROM user_categories
            WHERE line_user_id = ? AND enabled = 1
            ORDER BY id ASC
            """,
            (line_user_id,),
        ).fetchall()
        budget_rows = conn.execute(
            """
            SELECT category, monthly_limit FROM user_budgets
            WHERE line_user_id = ?
            ORDER BY id ASC
            """,
            (line_user_id,),
        ).fetchall()

    return UserSetup(
        line_user_id=user["line_user_id"],
        display_name=user["display_name"],
        picture_url=user["picture_url"],
        onboarding_completed=bool(user["onboarding_completed"]),
        discovery_source=user["discovery_source"],
        expense_categories=[row["category"] for row in category_rows if row["type"] == "expense"],
        income_categories=[row["category"] for row in category_rows if row["type"] == "income"],
        monthly_budgets={row["category"]: row["monthly_limit"] for row in budget_rows},
        budget_cycle=user["budget_cycle"] if user["budget_cycle"] in {"daily", "weekly", "monthly"} else "monthly",
        budget_start_day=user["budget_start_day"] if 1 <= int(user["budget_start_day"]) <= 31 else 1,
    )


def save_user_onboarding(line_user_id: str, payload: OnboardingPayload, db_path: str | None = None) -> UserSetup | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        user = conn.execute("SELECT line_user_id FROM line_users WHERE line_user_id = ?", (line_user_id,)).fetchone()
        if user is None:
            return None

        conn.execute(
            """
            UPDATE line_users
            SET onboarding_completed = 1,
                discovery_source = ?,
                budget_cycle = ?,
                budget_start_day = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE line_user_id = ?
            """,
            (payload.discovery_source, payload.budget_cycle, payload.budget_start_day, line_user_id),
        )
        conn.execute("DELETE FROM user_categories WHERE line_user_id = ?", (line_user_id,))
        conn.execute("DELETE FROM user_budgets WHERE line_user_id = ?", (line_user_id,))

        for category in payload.expense_categories:
            conn.execute(
                """
                INSERT INTO user_categories (line_user_id, type, category, enabled, is_recommended)
                VALUES (?, 'expense', ?, 1, 0)
                """,
                (line_user_id, category),
            )
        for category in payload.income_categories:
            conn.execute(
                """
                INSERT INTO user_categories (line_user_id, type, category, enabled, is_recommended)
                VALUES (?, 'income', ?, 1, 0)
                """,
                (line_user_id, category),
            )
        for category, monthly_limit in payload.monthly_budgets.items():
            conn.execute(
                """
                INSERT INTO user_budgets (line_user_id, category, monthly_limit)
                VALUES (?, ?, ?)
                """,
                (line_user_id, category, monthly_limit),
            )

    return get_user_setup(line_user_id, db_path)


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
