from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import create_recurring_transaction, list_transactions, upsert_line_user
from app.models import LineUserUpsert, RecurringTransactionCreate
from app.recurring_service import run_due_recurring_transactions


def test_run_due_recurring_transactions_creates_transaction_and_pushes_flex(tmp_path) -> None:
    db_path = str(tmp_path / "moneytrack.db")
    upsert_line_user(LineUserUpsert(line_user_id="line-user-001", display_name="Tester"), db_path)
    create_recurring_transaction(
        RecurringTransactionCreate(
            type="income",
            amount=25000,
            category="เงินเดือน",
            description="เงินเดือน",
            mode="personal",
            interval="monthly",
            day_of_month=28,
            notify_time="10:00",
        ),
        line_user_id="line-user-001",
        db_path=db_path,
    )
    pushed: list[tuple[str, dict]] = []

    result = run_due_recurring_transactions(
        now=datetime(2026, 6, 28, 10, 0, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda line_user_id, message: pushed.append((line_user_id, message)),
    )

    transactions = list_transactions(db_path, line_user_id="line-user-001")
    assert result["processed_count"] == 1
    assert len(transactions) == 1
    assert transactions[0].description == "เงินเดือน"
    assert transactions[0].amount == 25000
    assert pushed[0][0] == "line-user-001"
    assert pushed[0][1]["type"] == "flex"


def test_run_due_recurring_transactions_does_not_run_before_notify_time_or_twice(tmp_path) -> None:
    db_path = str(tmp_path / "moneytrack.db")
    upsert_line_user(LineUserUpsert(line_user_id="line-user-001", display_name="Tester"), db_path)
    create_recurring_transaction(
        RecurringTransactionCreate(
            type="expense",
            amount=349,
            category="Subscription",
            description="Netflix",
            mode="personal",
            interval="daily",
            notify_time="10:00",
        ),
        line_user_id="line-user-001",
        db_path=db_path,
    )

    early_result = run_due_recurring_transactions(
        now=datetime(2026, 6, 28, 9, 59, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda *_: None,
    )
    first_result = run_due_recurring_transactions(
        now=datetime(2026, 6, 28, 10, 0, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda *_: None,
    )
    second_result = run_due_recurring_transactions(
        now=datetime(2026, 6, 28, 10, 1, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda *_: None,
    )

    assert early_result["processed_count"] == 0
    assert first_result["processed_count"] == 1
    assert second_result["processed_count"] == 0
    assert len(list_transactions(db_path, line_user_id="line-user-001")) == 1
