from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from .database import create_transaction, list_transactions
from .line_messages import (
    build_category_budget_flex,
    build_daily_summary_flex,
    build_quick_start_flex,
    build_transaction_success_flex,
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
    line_message: dict[str, Any] | None = None


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

    try:
        transaction = parse_transaction_message(normalized, today=current_date)
    except ParseError:
        return LineMessageResult(
            reply="ยังบันทึกไม่ได้: กรุณาระบุจำนวนเงิน เช่น ข้าว 80",
            handled=False,
            line_message=build_quick_start_flex(),
        )

    saved = create_transaction(transaction, db_path)
    line_message = build_transaction_success_flex(
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
