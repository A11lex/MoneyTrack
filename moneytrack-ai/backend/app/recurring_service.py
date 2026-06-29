from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from .database import (
    create_transaction,
    get_user_settings,
    list_recurring_transactions,
    mark_recurring_transaction_run,
)
from .line_messages import build_transaction_success_flex, build_transaction_success_with_budget_flex
from .line_service import _budget_context_after_transaction
from .models import RecurringTransaction, TransactionCreate

BANGKOK_TZ = ZoneInfo("Asia/Bangkok")


def run_due_recurring_transactions(
    *,
    now: datetime | None = None,
    db_path: str | None = None,
    push_message: Any | None = None,
) -> dict[str, Any]:
    base_now = now or datetime.now(BANGKOK_TZ)
    processed: list[dict[str, Any]] = []

    for item in list_recurring_transactions(db_path):
        current = base_now.astimezone(_user_timezone(item.line_user_id, db_path))
        current_date = current.date()
        current_time = current.strftime("%H:%M")
        if not _is_due(item, current_date, current_time):
            continue

        transaction = create_transaction(
            TransactionCreate(
                date=current_date,
                type=item.type,
                amount=item.amount,
                category=item.category,
                description=item.description,
                mode=item.mode,
            ),
            db_path,
            line_user_id=item.line_user_id,
        )
        mark_recurring_transaction_run(item.id, item.line_user_id, current_date, db_path)

        line_message = _build_recurring_success_message(item.line_user_id, transaction, db_path)
        if push_message is not None:
            push_message(item.line_user_id, line_message)

        processed.append(
            {
                "recurring_id": item.id,
                "transaction_id": transaction.id,
                "line_user_id": item.line_user_id,
            }
        )

    return {"processed": processed, "processed_count": len(processed)}


def _is_due(item: RecurringTransaction, current_date: date, current_time: str) -> bool:
    if item.last_run_date == current_date:
        return False
    if item.notify_time > current_time:
        return False

    if item.interval == "daily":
        return True
    if item.interval == "weekly":
        # Frontend stores Sunday as 0. Python weekday stores Monday as 0.
        sunday_first_weekday = (current_date.weekday() + 1) % 7
        return item.day_of_week == sunday_first_weekday
    if item.interval == "monthly":
        return item.day_of_month == current_date.day
    return item.month == current_date.month and item.day_of_month == current_date.day


def _user_timezone(line_user_id: str, db_path: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(get_user_settings(line_user_id, db_path).timezone)
    except Exception:
        return BANGKOK_TZ


def _build_recurring_success_message(line_user_id: str, transaction: Any, db_path: str | None) -> dict[str, Any]:
    settings = get_user_settings(line_user_id, db_path)
    budget_context = _budget_context_after_transaction(line_user_id, transaction, db_path)
    if budget_context and settings.confirmation_show_budget:
        return build_transaction_success_with_budget_flex(
            transaction_id=transaction.id,
            transaction_type=transaction.type.value,
            amount=transaction.amount,
            category=transaction.category,
            description=transaction.description,
            mode=transaction.mode.value,
            transaction_date=transaction.date,
            show_details=settings.confirmation_show_details,
            show_payment_options=settings.confirmation_show_payment_options,
            show_budget_warning=settings.confirmation_show_budget_warning,
            **budget_context,
        )
    return build_transaction_success_flex(
        transaction_id=transaction.id,
        transaction_type=transaction.type.value,
        amount=transaction.amount,
        category=transaction.category,
        description=transaction.description,
        mode=transaction.mode.value,
        transaction_date=transaction.date,
        show_details=settings.confirmation_show_details,
        show_payment_options=settings.confirmation_show_payment_options,
    )
