import pytest
from fastapi import HTTPException

from app.line_auth import LineAuthenticationError, LineIdentity, authorize_claimed_line_user, verify_liff_id_token


class FakeResponse:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = ""

    def json(self) -> dict:
        return self._payload


def test_verify_liff_id_token_returns_verified_line_identity() -> None:
    calls = []

    def post(url, *, data, headers, timeout):
        calls.append((url, data, headers, timeout))
        return FakeResponse(
            200,
            {
                "sub": "U123",
                "name": "Money User",
                "picture": "https://example.com/user.png",
                "exp": 4102444800,
            },
        )

    identity = verify_liff_id_token("token-123", "2010521304", post=post)

    assert identity.user_id == "U123"
    assert identity.display_name == "Money User"
    assert identity.picture_url == "https://example.com/user.png"
    assert calls[0][1] == {"id_token": "token-123", "client_id": "2010521304"}


def test_verify_liff_id_token_rejects_invalid_token() -> None:
    def post(url, *, data, headers, timeout):
        return FakeResponse(400, {"error": "invalid_request"})

    try:
        verify_liff_id_token("bad-token", "2010521304", post=post)
    except LineAuthenticationError as error:
        assert str(error) == "Invalid LINE ID token"
    else:
        raise AssertionError("Expected invalid LINE token to be rejected")


def test_authorization_rejects_a_different_claimed_line_user() -> None:
    identity = LineIdentity(user_id="U123", display_name="Money User", picture_url=None)

    with pytest.raises(HTTPException) as error:
        authorize_claimed_line_user("U999", identity)

    assert error.value.status_code == 403
