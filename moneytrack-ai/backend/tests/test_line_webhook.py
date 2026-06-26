import base64
import hashlib
import hmac
import json
from typing import Any

from fastapi.testclient import TestClient

from app import database
import app.main as main_module
from app.main import app


def test_line_webhook_accepts_mock_message_and_saves_transaction(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={"line_user_id": "test-user-001", "message": "ข้าว 80"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "reply": "บันทึกแล้ว: รายจ่าย 80 บาท\nหมวด: Food\nโหมด: ส่วนตัว",
        "handled": True,
    }
    transactions = database.list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].category == "Food"


def test_line_webhook_returns_friendly_error_for_unparsed_message(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={"line_user_id": "test-user-001", "message": "ข้าวกลางวัน"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "reply": "ยังบันทึกไม่ได้: กรุณาระบุจำนวนเงิน เช่น ข้าว 80",
        "handled": False,
    }


def test_line_webhook_accepts_line_messaging_api_event_payload(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-event.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={
            "events": [
                {
                    "type": "message",
                    "replyToken": "reply-token-001",
                    "source": {"userId": "line-user-001"},
                    "message": {"type": "text", "text": "รับเงินลูกค้า 2500"},
                }
            ]
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["handled"] is True
    assert data["replies"][0]["reply_token"] == "reply-token-001"
    assert data["replies"][0]["line_user_id"] == "line-user-001"
    assert data["replies"][0]["reply"] == "บันทึกแล้ว: รายรับ 2,500 บาท\nหมวด: Business Revenue\nโหมด: ธุรกิจ"
    assert data["replies"][0]["line_message"]["type"] == "flex"
    assert data["replies"][0]["line_message"]["altText"] == "จดสำเร็จ: รายรับ 2,500 บาท"
    assert _buttons(data["replies"][0]["line_message"])[0]["action"]["type"] == "uri"
    transactions = database.list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].type == "income"
    assert transactions[0].category == "Business Revenue"


def test_line_webhook_verifies_signature_and_sends_reply_when_env_is_configured(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-signed.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    monkeypatch.setenv("LINE_CHANNEL_SECRET", "test-secret")
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "access-token-001")
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://example.vercel.app")
    sent_replies = []
    monkeypatch.setattr(
        main_module,
        "send_line_reply",
        lambda reply_token, reply_message, access_token: sent_replies.append(
            {"reply_token": reply_token, "reply_message": reply_message, "access_token": access_token}
        ),
    )
    client = TestClient(app)
    body = json.dumps(
        {
            "events": [
                {
                    "type": "message",
                    "replyToken": "reply-token-001",
                    "source": {"userId": "line-user-001"},
                    "message": {"type": "text", "text": "ข้าว 80"},
                }
            ]
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()
    signature = base64.b64encode(hmac.new(b"test-secret", body, hashlib.sha256).digest()).decode()

    response = client.post(
        "/line/webhook",
        content=body,
        headers={"Content-Type": "application/json", "X-Line-Signature": signature},
    )

    assert response.status_code == 200
    assert sent_replies == [
        {
            "reply_token": "reply-token-001",
            "reply_message": sent_replies[0]["reply_message"],
            "access_token": "access-token-001",
        }
    ]
    assert sent_replies[0]["reply_message"]["type"] == "flex"
    assert sent_replies[0]["reply_message"]["altText"] == "จดสำเร็จ: รายจ่าย 80 บาท"
    assert _buttons(sent_replies[0]["reply_message"])[0]["action"]["uri"].startswith("https://example.vercel.app/liff/transactions/")
    assert _buttons(sent_replies[0]["reply_message"])[0]["action"]["uri"].endswith("/edit")


def test_line_webhook_refreshes_main_rich_menu_for_existing_user(monkeypatch) -> None:
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "access-token-001")
    monkeypatch.setenv("LINE_RICH_MENU_MAIN_ID", "richmenu-main-002")
    sent_replies = []
    linked_menus = []
    monkeypatch.setattr(
        main_module,
        "send_line_reply",
        lambda reply_token, reply_message, access_token: sent_replies.append(
            {"reply_token": reply_token, "reply_message": reply_message, "access_token": access_token}
        ),
    )
    monkeypatch.setattr(
        main_module,
        "link_user_rich_menu",
        lambda line_user_id, rich_menu_id, access_token: linked_menus.append(
            {"line_user_id": line_user_id, "rich_menu_id": rich_menu_id, "access_token": access_token}
        ),
    )
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={
            "events": [
                {
                    "type": "message",
                    "replyToken": "reply-token-001",
                    "source": {"userId": "line-user-001"},
                    "message": {"type": "text", "text": "รีเฟรชเมนู"},
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["handled"] is True
    assert linked_menus == [
        {
            "line_user_id": "line-user-001",
            "rich_menu_id": "richmenu-main-002",
            "access_token": "access-token-001",
        }
    ]
    assert sent_replies == [
        {
            "reply_token": "reply-token-001",
            "reply_message": "อัปเดตเมนูให้แล้วค่ะ ลองปิดแล้วเปิดห้องแชทใหม่ ถ้ายังไม่เปลี่ยนให้รอสักครู่",
            "access_token": "access-token-001",
        }
    ]


def test_line_webhook_open_record_keyboard_postback_does_not_send_reply(monkeypatch) -> None:
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "access-token-001")
    sent_replies = []
    monkeypatch.setattr(
        main_module,
        "send_line_reply",
        lambda reply_token, reply_message, access_token: sent_replies.append(
            {"reply_token": reply_token, "reply_message": reply_message, "access_token": access_token}
        ),
    )
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={
            "events": [
                {
                    "type": "postback",
                    "replyToken": "reply-token-001",
                    "source": {"userId": "line-user-001"},
                    "postback": {"data": "open_record_keyboard"},
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["handled"] is True
    assert response.json()["replies"][0]["reply"] == ""
    assert sent_replies == []


def test_line_webhook_show_quick_start_postback_sends_help_flex(monkeypatch) -> None:
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "access-token-001")
    sent_replies = []
    monkeypatch.setattr(
        main_module,
        "send_line_reply",
        lambda reply_token, reply_message, access_token: sent_replies.append(
            {"reply_token": reply_token, "reply_message": reply_message, "access_token": access_token}
        ),
    )
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={
            "events": [
                {
                    "type": "postback",
                    "replyToken": "reply-token-001",
                    "source": {"userId": "line-user-001"},
                    "postback": {"data": "show_quick_start"},
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["handled"] is True
    assert sent_replies[0]["reply_message"]["type"] == "flex"
    assert sent_replies[0]["reply_message"]["altText"] == "เริ่มจดรายรับรายจ่ายกับ เงินไปไหน?"


def test_line_webhook_rejects_invalid_signature_when_secret_is_configured(monkeypatch) -> None:
    monkeypatch.setenv("LINE_CHANNEL_SECRET", "test-secret")
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={"events": []},
        headers={"X-Line-Signature": "bad-signature"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid LINE signature"}


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
