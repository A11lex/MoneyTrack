from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.daily_reminder_service import run_due_daily_reminders
from app.database import create_transaction, save_daily_reminder_settings, upsert_line_user
from app.models import DailyReminderSettingsUpdate, LineUserUpsert, TransactionCreate


def test_run_due_daily_reminders_pushes_flex_once_after_time(tmp_path) -> None:
    db_path = str(tmp_path / "moneytrack.db")
    upsert_line_user(LineUserUpsert(line_user_id="line-user-001", display_name="Tester"), db_path)
    save_daily_reminder_settings(
        "line-user-001",
        DailyReminderSettingsUpdate(enabled=True, reminder_time="18:00", reminder_mode="missing_only"),
        db_path,
    )
    pushed: list[tuple[str, dict]] = []

    early_result = run_due_daily_reminders(
        now=datetime(2026, 6, 28, 17, 59, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda line_user_id, message: pushed.append((line_user_id, message)),
    )
    due_result = run_due_daily_reminders(
        now=datetime(2026, 6, 28, 18, 0, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda line_user_id, message: pushed.append((line_user_id, message)),
    )
    second_result = run_due_daily_reminders(
        now=datetime(2026, 6, 28, 18, 1, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda line_user_id, message: pushed.append((line_user_id, message)),
    )

    assert early_result["processed_count"] == 0
    assert due_result["processed_count"] == 1
    assert second_result["processed_count"] == 0
    assert pushed[0][0] == "line-user-001"
    assert pushed[0][1]["type"] == "flex"


def test_run_due_daily_reminders_missing_only_skips_when_user_recorded_today(tmp_path) -> None:
    db_path = str(tmp_path / "moneytrack.db")
    upsert_line_user(LineUserUpsert(line_user_id="line-user-001", display_name="Tester"), db_path)
    save_daily_reminder_settings(
        "line-user-001",
        DailyReminderSettingsUpdate(enabled=True, reminder_time="18:00", reminder_mode="missing_only"),
        db_path,
    )
    create_transaction(
        TransactionCreate(
            date=date(2026, 6, 28),
            type="expense",
            amount=50,
            category="อาหาร",
            description="ข้าว",
            mode="personal",
        ),
        db_path,
        line_user_id="line-user-001",
    )

    result = run_due_daily_reminders(
        now=datetime(2026, 6, 28, 18, 0, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda *_: None,
    )

    assert result["processed_count"] == 0


def test_run_due_daily_reminders_daily_mode_pushes_even_when_user_recorded_today(tmp_path) -> None:
    db_path = str(tmp_path / "moneytrack.db")
    upsert_line_user(LineUserUpsert(line_user_id="line-user-001", display_name="Tester"), db_path)
    save_daily_reminder_settings(
        "line-user-001",
        DailyReminderSettingsUpdate(enabled=True, reminder_time="18:00", reminder_mode="daily"),
        db_path,
    )
    create_transaction(
        TransactionCreate(
            date=date(2026, 6, 28),
            type="income",
            amount=2500,
            category="เงินเดือน",
            description="เงินเข้า",
            mode="personal",
        ),
        db_path,
        line_user_id="line-user-001",
    )

    result = run_due_daily_reminders(
        now=datetime(2026, 6, 28, 18, 0, tzinfo=ZoneInfo("Asia/Bangkok")),
        db_path=db_path,
        push_message=lambda *_: None,
    )

    assert result["processed_count"] == 1
