from collections.abc import Callable
from typing import Any

import httpx

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"


def build_reply_payload(reply_token: str, reply_text: str) -> dict[str, Any]:
    return {
        "replyToken": reply_token,
        "messages": [{"type": "text", "text": reply_text}],
    }


def send_line_reply(
    reply_token: str,
    reply_text: str,
    access_token: str,
    post: Callable[..., Any] = httpx.post,
) -> None:
    response = post(
        LINE_REPLY_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=build_reply_payload(reply_token, reply_text),
        timeout=10,
    )
    response.raise_for_status()
