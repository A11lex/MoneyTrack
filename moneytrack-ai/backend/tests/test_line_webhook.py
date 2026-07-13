import base64
import hashlib
import hmac
import json
from typing import Any

from fastapi.testclient import TestClient

from app import database
import app.main as main_module
from app.main import app
from app.models import LineUserUpsert, OnboardingPayload


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
    _complete_onboarding("line-user-001", db_path)
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


def test_financial_api_requires_line_user_id_and_scopes_transactions(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-scoped-users.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    first_response = client.post("/line/webhook", json={"line_user_id": "user-a", "message": "ข้าว 80"})
    second_response = client.post("/line/webhook", json={"line_user_id": "user-b", "message": "กาแฟ 120"})

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert client.get("/transactions").status_code == 422
    assert client.get("/dashboard").status_code == 422
    assert client.get("/app-data").status_code == 422
    assert client.post("/what-if", json={"scenario": "reduce_food"}).status_code == 422

    user_a_transactions = client.get("/transactions", params={"line_user_id": "user-a"}).json()
    user_b_transactions = client.get("/transactions", params={"line_user_id": "user-b"}).json()

    assert [transaction["amount"] for transaction in user_a_transactions] == [80]
    assert [transaction["amount"] for transaction in user_b_transactions] == [120]


def test_app_data_returns_dashboard_and_transactions_from_one_request(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "app-data.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)
    client.post("/line/webhook", json={"line_user_id": "user-a", "message": "ข้าว 80"})

    response = client.get("/app-data", params={"line_user_id": "user-a"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["dashboard"]["summary"]["total_expense"] == 80
    assert len(payload["transactions"]) == 1
    assert payload["transactions"][0]["amount"] == 80


def test_health_checks_the_database(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(database, "DATABASE_URL", str(tmp_path / "health.db"))

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_line_webhook_verifies_signature_and_sends_reply_when_env_is_configured(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-signed.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    _complete_onboarding("line-user-001", db_path)
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


def test_line_webhook_show_quick_start_postback_sends_help_flex(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-quick-start.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    _complete_onboarding("line-user-001", db_path)
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


def test_line_webhook_rejects_unsigned_events_when_production_secret_is_missing(monkeypatch) -> None:
    monkeypatch.delenv("LINE_CHANNEL_SECRET", raising=False)
    monkeypatch.setenv("LINE_WEBHOOK_ALLOW_UNSIGNED", "0")
    client = TestClient(app)

    response = client.post("/line/webhook", json={"events": []})

    assert response.status_code == 503
    assert response.json() == {"detail": "LINE webhook secret is not configured"}


def test_line_webhook_mock_payload_is_disabled_by_default(monkeypatch) -> None:
    monkeypatch.setenv("ENABLE_LINE_WEBHOOK_MOCK", "0")
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={"line_user_id": "test-user-001", "message": "ข้าว 80"},
    )

    assert response.status_code == 404


def test_line_webhook_deduplicates_webhook_event_id(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-dedup.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    _complete_onboarding("line-user-001", db_path)
    client = TestClient(app)
    payload = {
        "events": [
            {
                "type": "message",
                "webhookEventId": "01JTESTEVENT001",
                "replyToken": "reply-token-001",
                "source": {"userId": "line-user-001"},
                "message": {"type": "text", "text": "ข้าว 80"},
            }
        ]
    }

    first = client.post("/line/webhook", json=payload)
    second = client.post("/line/webhook", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(database.list_transactions(db_path, line_user_id="line-user-001")) == 1
    assert second.json()["replies"] == []


def test_line_webhook_returns_success_when_line_reply_api_fails(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "api-line-reply-failure.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    _complete_onboarding("line-user-001", db_path)
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "access-token-001")
    monkeypatch.setattr(main_module, "send_line_reply", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("LINE 400")))
    client = TestClient(app)

    response = client.post(
        "/line/webhook",
        json={
            "events": [
                {
                    "type": "message",
                    "webhookEventId": "01JTESTEVENT002",
                    "replyToken": "reply-token-002",
                    "source": {"userId": "line-user-001"},
                    "message": {"type": "text", "text": "ข้าว 80"},
                }
            ]
        },
    )

    assert response.status_code == 200
    assert len(database.list_transactions(db_path, line_user_id="line-user-001")) == 1


def _complete_onboarding(line_user_id: str, db_path: str) -> None:
    database.upsert_line_user(LineUserUpsert(line_user_id=line_user_id, display_name="Tester"), db_path)
    database.save_user_onboarding(
        line_user_id,
        OnboardingPayload(
            discovery_source="test",
            expense_categories=["Food"],
            income_categories=["Salary"],
            monthly_budgets={},
        ),
        db_path,
    )


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
