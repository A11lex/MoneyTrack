from datetime import date
from typing import Any

from app.database import list_transactions
from app.line_service import handle_line_message, handle_line_message_detail


def test_handle_line_message_saves_transaction_and_returns_reply(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")

    result = handle_line_message(
        line_user_id="test-user-001",
        message="ข้าว 80",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    transactions = list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].type == "expense"
    assert transactions[0].amount == 80
    assert transactions[0].category == "Food"
    assert transactions[0].mode == "personal"
    assert result.reply == "บันทึกแล้ว: รายจ่าย 80 บาท\nหมวด: Food\nโหมด: ส่วนตัว"


def test_handle_line_message_returns_parse_error_without_saving(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")

    result = handle_line_message(
        line_user_id="test-user-001",
        message="ข้าวกลางวัน",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert list_transactions(db_path) == []
    assert result.reply == "ยังบันทึกไม่ได้: กรุณาระบุจำนวนเงิน เช่น ข้าว 80"


def test_handle_line_message_returns_daily_summary(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "รับเงินลูกค้า 2500", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("test-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))

    result = handle_line_message(
        line_user_id="test-user-001",
        message="สรุปวันนี้",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.reply == "สรุปวันนี้\nรายรับ: 2,500 บาท\nรายจ่าย: 80 บาท\nสุทธิ: +2,420 บาท"


def test_handle_line_message_detail_returns_daily_summary_flex_with_category_rows(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "รับเงินลูกค้า 2500", db_path=db_path, today=date(2026, 6, 25))
    handle_line_message("test-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="สรุปวันนี้",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.line_message is not None
    assert result.line_message["type"] == "flex"
    assert result.line_message["altText"] == "สรุปวันนี้: สุทธิ +2,420 บาท"
    assert _find_text(result.line_message, "อาหาร") is True
    assert _buttons(result.line_message)[0]["action"]["uri"].endswith("/liff/summary")


def test_handle_line_message_detail_returns_quick_start_flex_for_help() -> None:
    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="วิธีใช้",
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.line_message is not None
    assert result.line_message["altText"] == "เริ่มจดรายรับรายจ่ายกับ เงินไปไหน?"
    assert _buttons(result.line_message)[0]["action"] == {
        "type": "postback",
        "label": "จดเลย",
        "data": "open_record_keyboard",
        "inputOption": "openKeyboard",
    }


def test_handle_line_message_detail_returns_category_budget_flex() -> None:
    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message="หมวด/งบ",
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.line_message is not None
    assert result.line_message["altText"] == "จัดการหมวดและงบใน เงินไปไหน?"
    assert _buttons(result.line_message)[0]["action"]["uri"].endswith("/liff/categories")


def test_handle_line_message_detail_deletes_transaction_by_button_command(tmp_path) -> None:
    db_path = str(tmp_path / "line.db")
    handle_line_message("test-user-001", "ข้าว 80", db_path=db_path, today=date(2026, 6, 25))
    transaction_id = list_transactions(db_path)[0].id

    result = handle_line_message_detail(
        line_user_id="test-user-001",
        message=f"ลบรายการ {transaction_id}",
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result.handled is True
    assert result.reply == "ลบแล้ว: 80 บาท"
    assert list_transactions(db_path) == []
    assert result.line_message is not None
    assert result.line_message["altText"] == "ลบสำเร็จ: รายจ่าย 80 บาท"


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
