from collections.abc import Callable
from typing import Any

import httpx

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"
LINE_LINK_RICH_MENU_URL = "https://api.line.me/v2/bot/user/{user_id}/richmenu/{rich_menu_id}"


LineReplyMessage = str | dict[str, Any]


def build_reply_payload(reply_token: str, reply_message: LineReplyMessage) -> dict[str, Any]:
    message = {"type": "text", "text": reply_message} if isinstance(reply_message, str) else reply_message
    return {
        "replyToken": reply_token,
        "messages": [message],
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
