import base64
import hashlib
import hmac

from app.line_security import verify_line_signature


def test_verify_line_signature_accepts_valid_signature() -> None:
    body = b'{"events":[]}'
    secret = "test-secret"
    signature = base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()

    assert verify_line_signature(body, signature, secret) is True


def test_verify_line_signature_rejects_invalid_signature() -> None:
    assert verify_line_signature(b'{"events":[]}', "bad-signature", "test-secret") is False


def test_verify_line_signature_rejects_missing_signature() -> None:
    assert verify_line_signature(b'{"events":[]}', None, "test-secret") is False
