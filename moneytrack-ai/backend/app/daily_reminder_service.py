from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from .database import get_user_settings, list_daily_reminder_settings, list_transactions, mark_daily_reminder_sent
from .line_messages import build_daily_record_reminder_flex
from .models import DailyReminderSettings

BANGKOK_TZ = ZoneInfo("Asia/Bangkok")


def run_due_daily_reminders(
    *,
    now: datetime | None = None,
    db_path: str | None = None,
    push_message: Any | None = None,
) -> dict[str, Any]:
    base_now = now or datetime.now(BANGKOK_TZ)
    processed: list[dict[str, Any]] = []

    for setting in list_daily_reminder_settings(db_path):
        current = base_now.astimezone(_user_timezone(setting.line_user_id, db_path))
        current_date = current.date()
        current_time = current.strftime("%H:%M")
        if not _is_due(setting, current_date, current_time):
            continue
        if setting.reminder_mode == "missing_only" and _has_transaction_today(setting.line_user_id, current_date, db_path):
            continue

        line_message = build_daily_record_reminder_flex()
        if push_message is not None:
            push_message(setting.line_user_id, line_message)
        mark_daily_reminder_sent(setting.line_user_id, current_date, db_path)
        processed.append({"line_user_id": setting.line_user_id, "reminder_time": setting.reminder_time})

    return {"processed": processed, "processed_count": len(processed)}


def _is_due(setting: DailyReminderSettings, current_date: date, current_time: str) -> bool:
    if not setting.enabled:
        return False
    if setting.last_sent_date == current_date:
        return False
    return setting.reminder_time <= current_time


def _has_transaction_today(line_user_id: str, current_date: date, db_path: str | None) -> bool:
    return any(transaction.date == current_date for transaction in list_transactions(db_path, line_user_id=line_user_id))


def _user_timezone(line_user_id: str, db_path: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(get_user_settings(line_user_id, db_path).timezone)
    except Exception:
        return BANGKOK_TZ
