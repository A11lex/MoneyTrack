from app.line_client import build_reply_payload, send_line_reply


def test_build_reply_payload_formats_line_text_message() -> None:
    assert build_reply_payload("reply-token-001", "บันทึกแล้ว") == {
        "replyToken": "reply-token-001",
        "messages": [{"type": "text", "text": "บันทึกแล้ว"}],
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
