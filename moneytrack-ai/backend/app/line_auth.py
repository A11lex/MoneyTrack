import os
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Callable

import httpx
from fastapi import Header, HTTPException


LINE_ID_TOKEN_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"
DEFAULT_LINE_LOGIN_CHANNEL_ID = "2010521304"


class LineAuthenticationError(ValueError):
    pass


@dataclass(frozen=True)
class LineIdentity:
    user_id: str
    display_name: str
    picture_url: str | None
    expires_at: int | None = None


def line_auth_required() -> bool:
    return os.getenv("LINE_AUTH_REQUIRED", "1").strip().lower() not in {"0", "false", "no"}


def line_login_channel_id() -> str:
    configured = os.getenv("LINE_LOGIN_CHANNEL_ID", "").strip()
    if configured:
        return configured
    liff_id = os.getenv("NEXT_PUBLIC_LIFF_ID", "").strip()
    if "-" in liff_id:
        return liff_id.split("-", 1)[0]
    return DEFAULT_LINE_LOGIN_CHANNEL_ID


def verify_liff_id_token(
    id_token: str,
    client_id: str,
    *,
    post: Callable[..., Any] = httpx.post,
) -> LineIdentity:
    try:
        response = post(
            LINE_ID_TOKEN_VERIFY_URL,
            data={"id_token": id_token, "client_id": client_id},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except httpx.HTTPError as error:
        raise LineAuthenticationError("LINE authentication is unavailable") from error

    if response.status_code != 200:
        raise LineAuthenticationError("Invalid LINE ID token")

    payload = response.json()
    user_id = str(payload.get("sub") or "").strip()
    expires_at = payload.get("exp")
    if not user_id or (isinstance(expires_at, (int, float)) and expires_at <= time.time()):
        raise LineAuthenticationError("Invalid LINE ID token")

    return LineIdentity(
        user_id=user_id,
        display_name=str(payload.get("name") or "LINE User")[:120],
        picture_url=str(payload["picture"]) if payload.get("picture") else None,
        expires_at=int(expires_at) if isinstance(expires_at, (int, float)) else None,
    )


def require_line_identity(authorization: str | None = Header(default=None)) -> LineIdentity | None:
    if not line_auth_required():
        return None
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing LINE ID token")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing LINE ID token")
    try:
        identity = _cached_line_identity(token, line_login_channel_id())
        if identity.expires_at is not None and identity.expires_at <= time.time():
            _cached_line_identity.cache_clear()
            raise LineAuthenticationError("Invalid LINE ID token")
        return identity
    except LineAuthenticationError as error:
        status_code = 503 if str(error) == "LINE authentication is unavailable" else 401
        raise HTTPException(status_code=status_code, detail=str(error)) from error


@lru_cache(maxsize=512)
def _cached_line_identity(id_token: str, client_id: str) -> LineIdentity:
    return verify_liff_id_token(id_token, client_id)


def authorize_claimed_line_user(claimed_line_user_id: str, identity: LineIdentity | None) -> str:
    if identity is None:
        return claimed_line_user_id
    if claimed_line_user_id != identity.user_id:
        raise HTTPException(status_code=403, detail="LINE user does not match authenticated user")
    return identity.user_id
