from datetime import date
from typing import Any

from .line_service import handle_line_message_detail


def handle_line_events(
    payload: dict[str, Any],
    db_path: str | None = None,
    today: date | None = None,
) -> list[dict[str, Any]]:
    replies: list[dict[str, Any]] = []
    for event in payload.get("events", []):
        if event.get("type") != "message":
            continue

        reply_token = event.get("replyToken")
        line_user_id = event.get("source", {}).get("userId", "unknown-line-user")
        message = event.get("message", {})
        if message.get("type") != "text":
            replies.append(
                {
                    "reply_token": reply_token,
                    "line_user_id": line_user_id,
                    "reply": "ตอนนี้รองรับเฉพาะข้อความตัวอักษร เช่น ข้าว 80",
                    "handled": False,
                }
            )
            continue

        result = handle_line_message_detail(
            line_user_id=line_user_id,
            message=message.get("text", ""),
            db_path=db_path,
            today=today,
        )
        replies.append(
            {
                "reply_token": reply_token,
                "line_user_id": line_user_id,
                "reply": result.reply,
                "line_message": result.line_message,
                "handled": result.handled,
            }
        )
    return replies
