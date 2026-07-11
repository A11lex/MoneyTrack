from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from .database import (
    create_transaction,
    delete_transaction,
    get_transaction,
    get_user_setup,
    get_user_settings,
    list_transactions,
    match_category_memory_mapping,
    upsert_line_user,
)
from .line_messages import (
    build_category_budget_flex,
    build_daily_summary_flex,
    build_monthly_summary_flex,
    build_onboarding_required_flex,
    build_quick_start_flex,
    build_streak_flex,
    build_transaction_deleted_flex,
    build_transaction_deleted_with_budget_flex,
    build_transaction_success_flex,
    build_transaction_success_with_budget_flex,
)
from .message_parser import ParseError, parse_transaction_message
from .models import LineUserUpsert


class LineWebhookPayload(BaseModel):
    line_user_id: str = Field(min_length=1)
    message: str = Field(min_length=1)


class LineWebhookResponse(BaseModel):
    reply: str
    handled: bool


class LineMessageResult(BaseModel):
    reply: str
    handled: bool
    line_message: dict[str, Any] | list[dict[str, Any]] | None = None


def handle_line_message(
    line_user_id: str,
    message: str,
    db_path: str | None = None,
    today: date | None = None,
) -> LineWebhookResponse:
    result = handle_line_message_detail(line_user_id, message, db_path, today)
    return LineWebhookResponse(reply=result.reply, handled=result.handled)


def handle_line_message_detail(
    line_user_id: str,
    message: str,
    db_path: str | None = None,
    today: date | None = None,
    require_onboarding: bool = False,
) -> LineMessageResult:
    normalized = message.strip()
    setup = get_user_setup(line_user_id, db_path)
    if require_onboarding and (setup is None or not setup.onboarding_completed):
        return LineMessageResult(
            reply="สมัครใช้งานก่อนเริ่มจดรายการนะคะ",
            handled=True,
            line_message=build_onboarding_required_flex(),
        )

    upsert_line_user(LineUserUpsert(line_user_id=line_user_id, display_name="LINE User"), db_path)
    user_settings = get_user_settings(line_user_id, db_path)
    current_date = today or datetime.now(_safe_timezone(user_settings.timezone)).date()

    if normalized in {"เริ่มต้น", "วิธีใช้", "help", "Help", "HELP", "เมนู"}:
        return LineMessageResult(
            reply="พิมพ์รายการได้เลย เช่น ข้าว 80 หรือ รับเงินลูกค้า 2500",
            handled=True,
            line_message=build_quick_start_flex(),
        )

    if normalized == "ประกาศ":
        return LineMessageResult(
            reply="ตอนนี้ยังไม่มีประกาศใหม่จาก เงินไปไหน?",
            handled=True,
        )

    if normalized in {"หมวด/งบ", "หมวดงบ", "จัดการหมวด", "ตั้งงบ", "งบ"}:
        return LineMessageResult(
            reply="เปิดหน้าจัดการหมวดและงบ",
            handled=True,
            line_message=build_category_budget_flex(),
        )

    if normalized in {"สรุปวันนี้", "วันนี้ใช้ไปเท่าไหร่", "รายรับวันนี้"}:
        income, expense, net, category_totals = _daily_summary_totals(db_path, current_date, line_user_id)
        return LineMessageResult(
            reply=_daily_summary_reply(income, expense, net),
            handled=True,
            line_message=build_daily_summary_flex(current_date, income, expense, net, category_totals),
        )

    if normalized in {"สรุปเดือนนี้", "สรุปประจำเดือน", "รายงานประจำเดือน", "เดือนนี้ใช้ไปเท่าไหร่"}:
        period_start, period_end, income, expense, net, income_totals, expense_totals = _monthly_summary_totals(
            db_path,
            current_date,
            line_user_id,
        )
        return LineMessageResult(
            reply=_monthly_summary_reply(income, expense, net),
            handled=True,
            line_message=build_monthly_summary_flex(
                period_start=period_start,
                period_end=period_end,
                income=income,
                expense=expense,
                net=net,
                income_totals=income_totals,
                expense_totals=expense_totals,
            ),
        )

    if normalized.startswith("ลบรายการ"):
        return _delete_transaction_from_line(line_user_id, normalized, db_path)

    try:
        transaction = parse_transaction_message(normalized, today=current_date)
    except ParseError:
        return LineMessageResult(
            reply="ยังบันทึกไม่ได้: กรุณาระบุจำนวนเงิน เช่น ข้าว 80",
            handled=False,
            line_message=build_quick_start_flex(),
        )

    if user_settings.memory_categorization_enabled:
        remembered = match_category_memory_mapping(
            line_user_id,
            transaction.description,
            transaction.type.value,
            db_path,
        )
        if remembered is not None:
            transaction.category = remembered.category

    saved = create_transaction(transaction, db_path, line_user_id=line_user_id)
    budget_context = _budget_context_after_transaction(line_user_id, saved, db_path)
    if budget_context and user_settings.confirmation_show_budget:
        line_message = build_transaction_success_with_budget_flex(
            transaction_id=saved.id,
            transaction_type=saved.type.value,
            amount=saved.amount,
            category=saved.category,
            description=saved.description,
            mode=saved.mode.value,
            transaction_date=saved.date,
            show_details=user_settings.confirmation_show_details,
            show_payment_options=user_settings.confirmation_show_payment_options,
            show_budget_warning=user_settings.confirmation_show_budget_warning,
            payment_channels=user_settings.payment_channels,
            **budget_context,
        )
    else:
        line_message = build_transaction_success_flex(
            transaction_id=saved.id,
            transaction_type=saved.type.value,
            amount=saved.amount,
            category=saved.category,
            description=saved.description,
            mode=saved.mode.value,
            transaction_date=saved.date,
            show_details=user_settings.confirmation_show_details,
            show_payment_options=user_settings.confirmation_show_payment_options,
            payment_channels=user_settings.payment_channels,
        )
    if user_settings.streak_notifications_enabled:
        streak_days = _streak_days(line_user_id, saved.date, db_path)
        line_message = [line_message, build_streak_flex(streak_days)]
    return LineMessageResult(
        reply=_transaction_reply(saved.type.value, saved.amount, saved.category, saved.mode.value),
        handled=True,
        line_message=line_message,
    )


def _transaction_reply(transaction_type: str, amount: float, category: str, mode: str) -> str:
    type_label = "รายรับ" if transaction_type == "income" else "รายจ่าย"
    mode_label = "ธุรกิจ" if mode == "business" else "ส่วนตัว"
    return f"บันทึกแล้ว: {type_label} {_format_baht(amount)}\nหมวด: {category}\nโหมด: {mode_label}"


def _streak_days(line_user_id: str, reference_date: date, db_path: str | None) -> int:
    transaction_dates = {transaction.date for transaction in list_transactions(db_path, line_user_id=line_user_id)}
    streak = 0
    current = reference_date
    while current in transaction_dates:
        streak += 1
        current -= timedelta(days=1)
    return streak


def _safe_timezone(timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone)
    except Exception:
        return ZoneInfo("Asia/Bangkok")


def _delete_transaction_from_line(line_user_id: str, message: str, db_path: str | None) -> LineMessageResult:
    parts = message.split()
    if len(parts) < 2 or not parts[1].isdigit():
        return LineMessageResult(reply="ยังลบไม่ได้: ไม่พบรหัสรายการ", handled=False, line_message=build_quick_start_flex())

    transaction_id = int(parts[1])
    transaction = get_transaction(transaction_id, db_path, line_user_id=line_user_id)
    if transaction is None:
        return LineMessageResult(reply="ลบไม่ได้: ไม่พบรายการนี้แล้ว", handled=False, line_message=build_quick_start_flex())

    delete_transaction(transaction_id, db_path, line_user_id=line_user_id)
    budget_context = _budget_context_after_transaction(line_user_id, transaction, db_path)
    if budget_context:
        line_message = build_transaction_deleted_with_budget_flex(
            transaction_type=transaction.type.value,
            amount=transaction.amount,
            category=transaction.category,
            description=transaction.description,
            transaction_date=transaction.date,
            **budget_context,
        )
    else:
        line_message = build_transaction_deleted_flex(
            transaction_type=transaction.type.value,
            amount=transaction.amount,
            category=transaction.category,
            description=transaction.description,
            transaction_date=transaction.date,
        )
    return LineMessageResult(
        reply=f"ลบแล้ว: {_format_baht(transaction.amount)}",
        handled=True,
        line_message=line_message,
    )


def _daily_summary_totals(db_path: str | None, today: date, line_user_id: str) -> tuple[float, float, float, dict[str, float]]:
    transactions = [transaction for transaction in list_transactions(db_path, line_user_id=line_user_id) if transaction.date == today]
    income = sum(transaction.amount for transaction in transactions if transaction.type.value == "income")
    expense = sum(transaction.amount for transaction in transactions if transaction.type.value == "expense")
    net = income - expense
    category_totals: dict[str, float] = {}
    for transaction in transactions:
        if transaction.type.value != "expense":
            continue
        category_totals[transaction.category] = category_totals.get(transaction.category, 0) + transaction.amount
    return income, expense, net, category_totals


def _monthly_summary_totals(
    db_path: str | None,
    today: date,
    line_user_id: str,
) -> tuple[date, date, float, float, float, dict[str, float], dict[str, float]]:
    period_start = date(today.year, today.month, 1)
    next_month = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
    period_end = next_month - timedelta(days=1)
    transactions = [
        transaction
        for transaction in list_transactions(db_path, line_user_id=line_user_id)
        if period_start <= transaction.date <= period_end
    ]
    income = sum(transaction.amount for transaction in transactions if transaction.type.value == "income")
    expense = sum(transaction.amount for transaction in transactions if transaction.type.value == "expense")
    net = income - expense
    income_totals: dict[str, float] = {}
    expense_totals: dict[str, float] = {}
    for transaction in transactions:
        target = income_totals if transaction.type.value == "income" else expense_totals
        target[transaction.category] = target.get(transaction.category, 0) + transaction.amount
    return period_start, period_end, income, expense, net, income_totals, expense_totals


def _daily_summary_reply(income: float, expense: float, net: float) -> str:
    return (
        "สรุปวันนี้\n"
        f"รายรับ: {_format_baht(income)}\n"
        f"รายจ่าย: {_format_baht(expense)}\n"
        f"สุทธิ: {_format_signed_baht(net)}"
    )


def _monthly_summary_reply(income: float, expense: float, net: float) -> str:
    return (
        "สรุปประจำเดือน\n"
        f"รายรับ: {_format_baht(income)}\n"
        f"รายจ่าย: {_format_baht(expense)}\n"
        f"คงเหลือ: {_format_signed_baht(net)}"
    )


def _format_baht(amount: float) -> str:
    return f"{amount:,.0f} บาท"


def _format_signed_baht(amount: float) -> str:
    sign = "+" if amount >= 0 else "-"
    return f"{sign}{abs(amount):,.0f} บาท"


def _budget_context_after_transaction(line_user_id: str, transaction: Any, db_path: str | None) -> dict[str, Any] | None:
    if transaction.type.value != "expense":
        return None

    setup = get_user_setup(line_user_id, db_path)
    if setup is None or not setup.monthly_budgets:
        return None

    category_keys = _category_budget_keys(transaction.category)
    budget_limit = _first_budget_limit(setup.monthly_budgets, category_keys)
    use_total_budget = False
    if budget_limit is None:
        budget_limit = setup.monthly_budgets.get("__total__")
        use_total_budget = budget_limit is not None
    if budget_limit is None or budget_limit <= 0:
        return None

    period_label = _budget_period_label(setup.budget_cycle, setup.budget_start_day)
    period_transactions = [
        item
        for item in list_transactions(db_path, line_user_id=line_user_id)
        if _is_in_budget_period(item.date, transaction.date, setup.budget_cycle, setup.budget_start_day)
    ]
    total_income = sum(item.amount for item in period_transactions if item.type.value == "income")
    if use_total_budget:
        spent = sum(item.amount for item in period_transactions if item.type.value == "expense")
        category = "รายจ่ายทั้งหมด"
    else:
        spent = sum(
            item.amount
            for item in period_transactions
            if item.type.value == "expense" and item.category in category_keys
        )
        category = transaction.category

    usage_ratio = spent / budget_limit

    return {
        "budget_limit": budget_limit,
        "budget_category": category,
        "period_label": period_label,
        "spent": spent,
        "total_income": total_income,
        "show_warning": usage_ratio >= 0.8,
    }


def _is_in_budget_period(value: date, reference: date, cycle: str, start_day: int) -> bool:
    if cycle == "daily":
        return value == reference

    if cycle == "weekly":
        start = reference - timedelta(days=reference.weekday())
        end = start + timedelta(days=6)
        return start <= value <= end

    start = _monthly_period_start(reference, start_day)
    end = _date_with_clamped_day(start.year, start.month + 1, start_day)
    return start <= value < end


def _monthly_period_start(reference: date, start_day: int) -> date:
    current_start = _date_with_clamped_day(reference.year, reference.month, start_day)
    if reference >= current_start:
        return current_start
    return _date_with_clamped_day(reference.year, reference.month - 1, start_day)


def _date_with_clamped_day(year: int, month: int, day: int) -> date:
    normalized_year = year + (month - 1) // 12
    normalized_month = (month - 1) % 12 + 1
    next_year = normalized_year + (normalized_month // 12)
    next_month = normalized_month % 12 + 1
    last_day = (date(next_year, next_month, 1) - timedelta(days=1)).day
    return date(normalized_year, normalized_month, min(max(day, 1), last_day))


def _budget_period_label(cycle: str, start_day: int) -> str:
    if cycle == "daily":
        return "รายวัน"
    if cycle == "weekly":
        return "รายสัปดาห์"
    return f"รายเดือน (วันที่ {start_day})"


def _first_budget_limit(monthly_budgets: dict[str, float], keys: set[str]) -> float | None:
    for key in keys:
        if key in monthly_budgets:
            return monthly_budgets[key]
    return None


def _category_budget_keys(category: str) -> set[str]:
    category_map = {
        "Business Cost": "ธุรกิจ",
        "Business Revenue": "ธุรกิจส่วนตัว",
        "Debt Payment": "ผ่อนรถ",
        "Food": "อาหาร",
        "Freelance": "งานพิเศษ",
        "Health": "สุขภาพ",
        "Other Expense": "อื่นๆ",
        "Other Income": "อื่นๆ",
        "Rent / Home": "ที่พัก",
        "Salary": "เงินเดือน",
        "Shopping": "ช้อปปิ้ง",
        "Transport": "เดินทาง",
        "Utilities": "ค่าน้ำค่าไฟ",
    }
    mapped = category_map.get(category)
    return {category, mapped} if mapped else {category}
