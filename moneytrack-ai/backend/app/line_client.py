from collections.abc import Callable
import logging
from typing import Any

import httpx

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"
LINE_LINK_RICH_MENU_URL = "https://api.line.me/v2/bot/user/{user_id}/richmenu/{rich_menu_id}"
logger = logging.getLogger(__name__)


LineReplyItem = str | dict[str, Any]
LineReplyMessage = LineReplyItem | list[LineReplyItem]


def build_reply_payload(reply_token: str, reply_message: LineReplyMessage) -> dict[str, Any]:
    reply_messages = reply_message if isinstance(reply_message, list) else [reply_message]
    messages = [
        {"type": "text", "text": item} if isinstance(item, str) else item
        for item in reply_messages
    ]
    return {
        "replyToken": reply_token,
        "messages": messages,
    }


def send_line_reply(
    reply_token: str,
    reply_message: LineReplyMessage,
    access_token: str,
    post: Callable[..., Any] = httpx.post,
) -> None:
    response = post(
        LINE_REPLY_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=build_reply_payload(reply_token, reply_message),
        timeout=10,
    )
    status_code = getattr(response, "status_code", 200)
    if status_code >= 400:
        logger.error("LINE reply failed: status=%s body=%s", status_code, getattr(response, "text", ""))
    response.raise_for_status()


def link_user_rich_menu(
    line_user_id: str,
    rich_menu_id: str,
    access_token: str,
    post: Callable[..., Any] = httpx.post,
) -> None:
    response = post(
        LINE_LINK_RICH_MENU_URL.format(user_id=line_user_id, rich_menu_id=rich_menu_id),
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    response.raise_for_status()
