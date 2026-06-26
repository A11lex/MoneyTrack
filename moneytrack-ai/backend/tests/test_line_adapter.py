from datetime import date
from typing import Any

from app.database import list_transactions
from app.line_adapter import handle_line_events


def test_handle_line_events_processes_line_text_message_payload(tmp_path) -> None:
    db_path = str(tmp_path / "line-events.db")
    payload = {
        "events": [
            {
                "type": "message",
                "replyToken": "reply-token-001",
                "source": {"userId": "line-user-001"},
                "message": {"type": "text", "text": "ข้าว 80"},
            }
        ]
    }

    result = handle_line_events(payload, db_path=db_path, today=date(2026, 6, 25))

    assert result[0]["reply_token"] == "reply-token-001"
    assert result[0]["line_user_id"] == "line-user-001"
    assert result[0]["reply"] == "บันทึกแล้ว: รายจ่าย 80 บาท\nหมวด: Food\nโหมด: ส่วนตัว"
    assert result[0]["handled"] is True
    assert result[0]["line_message"]["type"] == "flex"
    assert result[0]["line_message"]["altText"] == "จดสำเร็จ: รายจ่าย 80 บาท"
    assert _buttons(result[0]["line_message"])[0]["action"]["type"] == "uri"
    transactions = list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].description == "ข้าว"


def test_handle_line_events_ignores_non_text_messages(tmp_path) -> None:
    db_path = str(tmp_path / "line-events.db")
    payload = {
        "events": [
            {
                "type": "message",
                "replyToken": "reply-token-002",
                "source": {"userId": "line-user-001"},
                "message": {"type": "image", "id": "image-001"},
            }
        ]
    }

    result = handle_line_events(payload, db_path=db_path, today=date(2026, 6, 25))

    assert result == [
        {
            "reply_token": "reply-token-002",
            "line_user_id": "line-user-001",
            "reply": "ตอนนี้รองรับเฉพาะข้อความตัวอักษร เช่น ข้าว 80",
            "handled": False,
        }
    ]
    assert list_transactions(db_path) == []


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
