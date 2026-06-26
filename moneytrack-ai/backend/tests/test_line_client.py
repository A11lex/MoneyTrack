from app.line_client import build_reply_payload, link_user_rich_menu, send_line_reply


def test_build_reply_payload_formats_line_text_message() -> None:
    assert build_reply_payload("reply-token-001", "บันทึกแล้ว") == {
        "replyToken": "reply-token-001",
        "messages": [{"type": "text", "text": "บันทึกแล้ว"}],
    }


def test_build_reply_payload_accepts_flex_message_object() -> None:
    flex_message = {"type": "flex", "altText": "จดสำเร็จ", "contents": {"type": "bubble"}}

    assert build_reply_payload("reply-token-001", flex_message) == {
        "replyToken": "reply-token-001",
        "messages": [flex_message],
    }


def test_send_line_reply_posts_to_line_reply_api() -> None:
    calls = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

    def fake_post(url, *, headers, json, timeout):
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return FakeResponse()

    send_line_reply("reply-token-001", "บันทึกแล้ว", "access-token-001", post=fake_post)

    assert calls == [
        {
            "url": "https://api.line.me/v2/bot/message/reply",
            "headers": {
                "Authorization": "Bearer access-token-001",
                "Content-Type": "application/json",
            },
            "json": {
                "replyToken": "reply-token-001",
                "messages": [{"type": "text", "text": "บันทึกแล้ว"}],
            },
            "timeout": 10,
        }
    ]


def test_link_user_rich_menu_posts_to_line_rich_menu_api() -> None:
    calls = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

    def fake_post(url, *, headers, timeout):
        calls.append({"url": url, "headers": headers, "timeout": timeout})
        return FakeResponse()

    link_user_rich_menu("line-user-001", "richmenu-main-001", "access-token-001", post=fake_post)

    assert calls == [
        {
            "url": "https://api.line.me/v2/bot/user/line-user-001/richmenu/richmenu-main-001",
            "headers": {"Authorization": "Bearer access-token-001"},
            "timeout": 10,
        }
    ]
