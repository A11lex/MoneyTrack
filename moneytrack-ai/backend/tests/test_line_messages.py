from datetime import date
from typing import Any

from app.line_messages import (
    build_category_budget_flex,
    build_daily_summary_flex,
    build_quick_start_flex,
    build_transaction_success_flex,
)


def test_build_transaction_success_flex_matches_moneytrack_ci_and_links_to_frontend(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_transaction_success_flex(
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
    assert buttons[0]["action"] == {
        "type": "uri",
        "label": "ดูรายการ",
        "uri": "https://example.vercel.app/liff/transactions",
    }
    assert buttons[1]["action"] == {
        "type": "uri",
        "label": "แก้หมวด/งบ",
        "uri": "https://example.vercel.app/liff/categories",
    }


def test_build_transaction_success_flex_uses_green_amount_for_income() -> None:
    message = build_transaction_success_flex(
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


def test_build_quick_start_flex_links_to_summary(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_quick_start_flex()

    assert message["type"] == "flex"
    assert message["altText"] == "เริ่มจดรายรับรายจ่ายกับ เงินไปไหน?"
    assert _find_text(message, "ข้าวมันไก่ 50") is True
    assert _buttons(message)[0]["action"]["uri"] == "https://example.vercel.app/liff/summary"


def test_build_category_budget_flex_links_to_categories(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")

    message = build_category_budget_flex()

    assert message["type"] == "flex"
    assert message["altText"] == "จัดการหมวดและงบใน เงินไปไหน?"
    assert _find_text(message, "จัดการหมวดและงบ") is True
    assert _buttons(message)[0]["action"]["uri"] == "https://example.vercel.app/liff/categories"


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
