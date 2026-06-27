from datetime import date
from typing import Any

from app.line_messages import (
    build_budget_alert_flex,
    build_category_budget_flex,
    build_daily_summary_flex,
    build_quick_start_flex,
    build_transaction_deleted_flex,
    build_transaction_success_flex,
    build_transaction_success_with_budget_flex,
)


def test_build_transaction_success_flex_matches_moneytrack_ci_and_links_to_frontend(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_transaction_success_flex(
        transaction_id=42,
        transaction_type="expense",
        amount=346,
        category="Food",
        description="ข้าว",
        mode="personal",
        transaction_date=date(2026, 6, 26),
    )

    buttons = _buttons(message)
    assert message["type"] == "flex"
    assert message["altText"] == "จดสำเร็จ: รายจ่าย 346 บาท"
    assert message["contents"]["styles"]["body"]["backgroundColor"] == "#FFFFFF"
    assert _find_text(message, "เงินไปไหน?") is False
    assert _find_text(message, "จดสำเร็จ") is True
    assert _find_text(message, "฿346") is True
    assert _find_text(message, "ดูรายการ") is False
    assert _find_text(message, "แก้หมวด/งบ") is False
    assert buttons[0]["action"] == {
        "type": "uri",
        "label": "✎",
        "uri": "https://example.vercel.app/liff/transactions/42/edit",
    }
    assert buttons[1]["action"] == {
        "type": "postback",
        "label": "×",
        "data": "delete_transaction=42",
    }


def test_build_transaction_success_flex_uses_green_amount_for_income() -> None:
    message = build_transaction_success_flex(
        transaction_id=43,
        transaction_type="income",
        amount=2500,
        category="Business Revenue",
        description="รับเงินลูกค้า",
        mode="business",
        transaction_date=date(2026, 6, 26),
    )

    assert message["altText"] == "จดสำเร็จ: รายรับ 2,500 บาท"
    assert _find_text(message, "฿2,500") is True
    assert _find_color(message, "#6DC5AD") is True


def test_build_transaction_success_with_budget_flex_combines_success_and_budget_in_one_bubble() -> None:
    message = build_transaction_success_with_budget_flex(
        transaction_id=42,
        transaction_type="expense",
        amount=50,
        category="Food",
        description="ข้าว",
        mode="personal",
        transaction_date=date(2026, 6, 27),
        budget_limit=200,
        budget_category="Food",
        period_label="รายเดือน",
        spent=100,
        total_income=6000,
        show_warning=False,
    )

    assert message["type"] == "flex"
    assert message["altText"] == "จดสำเร็จและงบคงเหลือ: งบคงเหลือ: อาหาร ใช้ไป ฿100 / ฿200"
    assert _find_text(message, "จดสำเร็จ") is True
    assert _find_text(message, "งบคงเหลือ") is True
    assert _find_text(message, "฿100 / ฿200") is True
    assert _find_text(message, "ข้อความเตือนงบประมาณ") is False


def test_build_transaction_deleted_flex_uses_crimson_expense_accent() -> None:
    message = build_transaction_deleted_flex(
        transaction_type="expense",
        amount=346,
        category="Food",
        description="ข้าว",
        transaction_date=date(2026, 6, 26),
    )

    assert message["type"] == "flex"
    assert message["altText"] == "ลบสำเร็จ: รายจ่าย 346 บาท"
    assert _find_text(message, "ลบสำเร็จ ×") is True
    assert _find_color(message, "#DC143C") is True


def test_build_daily_summary_flex_shows_category_totals_and_frontend_buttons(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_daily_summary_flex(
        summary_date=date(2026, 6, 26),
        income=2500,
        expense=346,
        net=2154,
        category_totals={"Food": 346},
    )

    buttons = _buttons(message)
    assert message["type"] == "flex"
    assert message["altText"] == "สรุปวันนี้: สุทธิ +2,154 บาท"
    assert message["contents"]["styles"]["body"]["backgroundColor"] == "#FFFFFF"
    assert _find_text(message, "อาหาร") is True
    assert _find_text(message, "ใช้ไปทั้งหมด") is True
    assert _find_text(message, "฿346") is True
    assert buttons[0]["action"]["uri"] == "https://example.vercel.app/liff/summary"
    assert buttons[1]["action"]["uri"] == "https://example.vercel.app/liff/insights"


def test_build_quick_start_flex_opens_keyboard_for_recording() -> None:
    message = build_quick_start_flex()
    action = _buttons(message)[0]["action"]

    assert message["type"] == "flex"
    assert message["altText"] == "เริ่มจดรายรับรายจ่ายกับ เงินไปไหน?"
    assert _find_text(message, "พิมพ์บอกได้เลย เราจะช่วยจัดหมวดให้อัตโนมัติ") is True
    assert _find_text(message, "ข้าวมันไก่ 50") is True
    assert action == {
        "type": "postback",
        "label": "จดเลย",
        "data": "open_record_keyboard",
        "inputOption": "openKeyboard",
    }


def test_build_category_budget_flex_links_to_categories(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_category_budget_flex()

    assert message["type"] == "flex"
    assert message["altText"] == "จัดการหมวดและงบใน เงินไปไหน?"
    assert _find_text(message, "จัดการหมวดและงบ") is True
    assert _buttons(message)[0]["action"]["uri"] == "https://example.vercel.app/liff/categories"


def test_build_budget_alert_flex_shows_budget_progress_and_warning(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_budget_alert_flex(
        budget_limit=400,
        category="Food",
        period_label="รายวัน",
        spent=180,
        total_income=50000,
    )

    assert message["type"] == "flex"
    assert message["altText"] == "แจ้งเตือนงบ: อาหาร ใช้ไป ฿180 / ฿400"
    assert _find_text(message, "งบคงเหลือ") is True
    assert _find_text(message, "รายได้") is True
    assert _find_text(message, "฿50,000") is True
    assert _find_text(message, "อาหาร") is True
    assert _find_text(message, "฿180 / ฿400") is True
    assert _find_text(message, "ข้อความเตือนงบประมาณ") is True
    assert _find_text(message, "ใช้จ่ายหมวดอาหารใกล้เต็มงบแล้วนะ") is True
    assert _find_color(message, "#DC143C") is True
    assert _buttons(message)[0]["action"]["uri"] == "https://example.vercel.app/liff/categories"


def test_build_budget_alert_flex_can_hide_warning_until_high_usage(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_budget_alert_flex(
        budget_limit=200,
        category="Food",
        period_label="รายเดือน",
        spent=100,
        total_income=50000,
        show_warning=False,
    )

    assert message["type"] == "flex"
    assert message["altText"] == "งบคงเหลือ: อาหาร ใช้ไป ฿100 / ฿200"
    assert _find_text(message, "งบคงเหลือ") is True
    assert _find_text(message, "฿100 / ฿200") is True
    assert _find_text(message, "ข้อความเตือนงบประมาณ") is False


def _buttons(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if value.get("type") == "button":
            found.append(value)
        for child in value.values():
            found.extend(_buttons(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_buttons(child))
    return found


def _find_text(value: Any, text: str) -> bool:
    if isinstance(value, dict):
        if value.get("type") == "text" and text in value.get("text", ""):
            return True
        return any(_find_text(child, text) for child in value.values())
    if isinstance(value, list):
        return any(_find_text(child, text) for child in value)
    return False


def _find_color(value: Any, color: str) -> bool:
    if isinstance(value, dict):
        if color in value.values():
            return True
        return any(_find_color(child, color) for child in value.values())
    if isinstance(value, list):
        return any(_find_color(child, color) for child in value)
    return False
