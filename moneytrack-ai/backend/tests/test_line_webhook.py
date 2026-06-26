import base64
import hashlib
import hmac
import json

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
    transactions = database.list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].type == "income"
    assert transactions[0].category == "Business Revenue"


def test_line_webhook_verifies_signature_and_sends_reply_when_env_is_configured(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-signed.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    monkeypatch.setenv("LINE_CHANNEL_SECRET", "test-secret")
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
