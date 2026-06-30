from datetime import date
from typing import Any

from app.database import list_transactions, save_user_onboarding, upsert_line_user
from app.line_adapter import handle_line_events
from app.models import LineUserUpsert, OnboardingPayload


def test_handle_line_events_processes_line_text_message_payload(tmp_path) -> None:
    db_path = str(tmp_path / "line-events.db")
    _complete_onboarding("line-user-001", db_path)
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
    assert result[0]["handled"] is True
    assert result[0]["line_message"]["type"] == "flex"
    assert _buttons(result[0]["line_message"])[0]["action"]["type"] == "uri"
    transactions = list_transactions(db_path)
    assert len(transactions) == 1
    assert transactions[0].description == "ข้าว"


def test_handle_line_events_sends_onboarding_flex_for_new_line_user(tmp_path) -> None:
    db_path = str(tmp_path / "line-events.db")
    payload = {
        "events": [
            {
                "type": "message",
                "replyToken": "reply-token-001",
                "source": {"userId": "new-line-user"},
                "message": {"type": "text", "text": "ข้าว 80"},
            }
        ]
    }

    result = handle_line_events(payload, db_path=db_path, today=date(2026, 6, 25))

    assert result[0]["reply_token"] == "reply-token-001"
    assert result[0]["line_user_id"] == "new-line-user"
    assert result[0]["handled"] is True
    assert result[0]["reply"] == "สมัครใช้งานก่อนเริ่มจดรายการนะคะ"
    assert result[0]["line_message"]["type"] == "flex"
    assert result[0]["line_message"]["altText"] == "สมัครใช้งาน เงินไปไหน? ก่อนเริ่มจดรายการ"
    assert _buttons(result[0]["line_message"])[0]["action"]["uri"].endswith("/liff/onboarding")
    assert list_transactions(db_path) == []


def test_handle_line_events_sends_onboarding_flex_for_incomplete_line_user(tmp_path) -> None:
    db_path = str(tmp_path / "line-events.db")
    upsert_line_user(LineUserUpsert(line_user_id="line-user-001", display_name="Tester"), db_path)
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

    assert result[0]["line_message"]["altText"] == "สมัครใช้งาน เงินไปไหน? ก่อนเริ่มจดรายการ"
    assert list_transactions(db_path) == []


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

    assert result[0]["reply_token"] == "reply-token-002"
    assert result[0]["line_user_id"] == "line-user-001"
    assert result[0]["handled"] is False
    assert list_transactions(db_path) == []


def test_handle_line_events_deletes_transaction_from_postback(tmp_path) -> None:
    db_path = str(tmp_path / "line-events.db")
    _complete_onboarding("line-user-001", db_path)
    handle_line_events(
        {
            "events": [
                {
                    "type": "message",
                    "replyToken": "reply-token-create",
                    "source": {"userId": "line-user-001"},
                    "message": {"type": "text", "text": "ข้าว 80"},
                }
            ]
        },
        db_path=db_path,
        today=date(2026, 6, 25),
    )
    transaction_id = list_transactions(db_path)[0].id

    result = handle_line_events(
        {
            "events": [
                {
                    "type": "postback",
                    "replyToken": "reply-token-delete",
                    "source": {"userId": "line-user-001"},
                    "postback": {"data": f"delete_transaction={transaction_id}"},
                }
            ]
        },
        db_path=db_path,
        today=date(2026, 6, 25),
    )

    assert result[0]["handled"] is True
    assert result[0]["line_message"]["type"] == "flex"
    assert list_transactions(db_path) == []


def _complete_onboarding(line_user_id: str, db_path: str) -> None:
    upsert_line_user(LineUserUpsert(line_user_id=line_user_id, display_name="Tester"), db_path)
    save_user_onboarding(
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
