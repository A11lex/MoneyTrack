from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from .database import create_transaction, delete_transaction, get_transaction, get_user_setup, list_transactions
from .line_messages import (
    build_category_budget_flex,
    build_daily_summary_flex,
    build_quick_start_flex,
    build_transaction_deleted_flex,
    build_transaction_success_flex,
    build_transaction_success_with_budget_flex,
)
from .message_parser import ParseError, parse_transaction_message


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
) -> LineMessageResult:
    current_date = today or date.today()
    normalized = message.strip()

    if normalized in {"เริ่มต้น", "วิธีใช้", "help", "Help", "HELP", "เมนู"}:
        return LineMessageResult(
            reply="พิมพ์รายการได้เลย เช่น ข้าว 80 หรือ รับเงินลูกค้า 2500",
            handled=True,
            line_message=build_quick_start_flex(),
        )

    if normalized in {"หมวด/งบ", "หมวดงบ", "จัดการหมวด", "ตั้งงบ", "งบ"}:
        return LineMessageResult(
            reply="เปิดหน้าจัดการหมวดและงบ",
            handled=True,
            line_message=build_category_budget_flex(),
        )

    if normalized in {"สรุปวันนี้", "วันนี้ใช้ไปเท่าไหร่", "รายรับวันนี้"}:
        income, expense, net, category_totals = _daily_summary_totals(db_path, current_date)
        return LineMessageResult(
            reply=_daily_summary_reply(income, expense, net),
            handled=True,
            line_message=build_daily_summary_flex(current_date, income, expense, net, category_totals),
        )

    if normalized.startswith("ลบรายการ"):
        return _delete_transaction_from_line(normalized, db_path)

    try:
        transaction = parse_transaction_message(normalized, today=current_date)
    except ParseError:
        return LineMessageResult(
            reply="ยังบันทึกไม่ได้: กรุณาระบุจำนวนเงิน เช่น ข้าว 80",
            handled=False,
            line_message=build_quick_start_flex(),
        )

    saved = create_transaction(transaction, db_path)
    budget_context = _budget_context_after_transaction(line_user_id, saved, db_path)
    if budget_context:
        line_message = build_transaction_success_with_budget_flex(
            transaction_id=saved.id,
            transaction_type=saved.type.value,
            amount=saved.amount,
            category=saved.category,
            description=saved.description,
            mode=saved.mode.value,
            transaction_date=saved.date,
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
        )
    return LineMessageResult(
        reply=_transaction_reply(saved.type.value, saved.amount, saved.category, saved.mode.value),
        handled=True,
        line_message=line_message,
    )


def _transaction_reply(transaction_type: str, amount: float, category: str, mode: str) -> str:
    type_label = "รายรับ" if transaction_type == "income" else "รายจ่าย"
    mode_label = "ธุรกิจ" if mode == "business" else "ส่วนตัว"
    return f"บันทึกแล้ว: {type_label} {_format_baht(amount)}\nหมวด: {category}\nโหมด: {mode_label}"


def _delete_transaction_from_line(message: str, db_path: str | None) -> LineMessageResult:
    parts = message.split()
    if len(parts) < 2 or not parts[1].isdigit():
        return LineMessageResult(reply="ยังลบไม่ได้: ไม่พบรหัสรายการ", handled=False, line_message=build_quick_start_flex())

    transaction_id = int(parts[1])
    transaction = get_transaction(transaction_id, db_path)
    if transaction is None:
        return LineMessageResult(reply="ลบไม่ได้: ไม่พบรายการนี้แล้ว", handled=False, line_message=build_quick_start_flex())

    delete_transaction(transaction_id, db_path)
    return LineMessageResult(
        reply=f"ลบแล้ว: {_format_baht(transaction.amount)}",
        handled=True,
        line_message=build_transaction_deleted_flex(
            transaction_type=transaction.type.value,
            amount=transaction.amount,
            category=transaction.category,
            description=transaction.description,
            transaction_date=transaction.date,
        ),
    )


def _daily_summary_totals(db_path: str | None, today: date) -> tuple[float, float, float, dict[str, float]]:
    transactions = [transaction for transaction in list_transactions(db_path) if transaction.date == today]
    income = sum(transaction.amount for transaction in transactions if transaction.type.value == "income")
    expense = sum(transaction.amount for transaction in transactions if transaction.type.value == "expense")
    net = income - expense
    category_totals: dict[str, float] = {}
    for transaction in transactions:
        if transaction.type.value != "expense":
            continue
        category_totals[transaction.category] = category_totals.get(transaction.category, 0) + transaction.amount
    return income, expense, net, category_totals


def _daily_summary_reply(income: float, expense: float, net: float) -> str:
    return (
        "สรุปวันนี้\n"
        f"รายรับ: {_format_baht(income)}\n"
        f"รายจ่าย: {_format_baht(expense)}\n"
        f"สุทธิ: {_format_signed_baht(net)}"
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

    month_transactions = [
        item
        for item in list_transactions(db_path)
        if item.date.year == transaction.date.year and item.date.month == transaction.date.month
    ]
    total_income = sum(item.amount for item in month_transactions if item.type.value == "income")
    if use_total_budget:
        spent = sum(item.amount for item in month_transactions if item.type.value == "expense")
        category = "รายจ่ายทั้งหมด"
    else:
        spent = sum(
            item.amount
            for item in month_transactions
            if item.type.value == "expense" and item.category in category_keys
        )
        category = transaction.category

    usage_ratio = spent / budget_limit

    return {
        "budget_limit": budget_limit,
        "budget_category": category,
        "period_label": "รายเดือน",
        "spent": spent,
        "total_income": total_income,
        "show_warning": usage_ratio >= 0.8,
    }


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
