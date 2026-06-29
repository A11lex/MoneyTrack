import os
from pathlib import Path
from typing import Any

import httpx
from PIL import Image


LINE_API_BASE = "https://api.line.me/v2/bot"
LINE_DATA_API_BASE = "https://api-data.line.me/v2/bot"
ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "rich-menu"
OUTPUT_DIR = ROOT / ".generated" / "rich-menu"
MAX_IMAGE_BYTES = 1_000_000
DEFAULT_LIFF_ID = "2010521304-BrGvBhsP"


def main() -> None:
    access_token = required_env("LINE_CHANNEL_ACCESS_TOKEN")
    liff_id = os.getenv("NEXT_PUBLIC_LIFF_ID", DEFAULT_LIFF_ID)
    liff_url = os.getenv("LIFF_ONBOARDING_URL") or liff_url_from_id(liff_id)
    main_liff_url = resolve_main_app_base_url(liff_url)

    start_image = prepare_image(ASSET_DIR / "ListMenuStart.png")
    main_image = prepare_image(ASSET_DIR / "ListMenuMain.png")

    start_menu_id = create_rich_menu(
        access_token,
        build_start_menu_payload(start_image.width, start_image.height, liff_url),
    )
    upload_rich_menu_image(access_token, start_menu_id, start_image.path)
    set_default_rich_menu(access_token, start_menu_id)

    main_menu_id = create_rich_menu(
        access_token,
        build_main_menu_payload(main_image.width, main_image.height, main_liff_url.rstrip("/")),
    )
    upload_rich_menu_image(access_token, main_menu_id, main_image.path)

    print("LINE_RICH_MENU_START_ID=" + start_menu_id)
    print("LINE_RICH_MENU_MAIN_ID=" + main_menu_id)
    print("Default rich menu is set to start menu.")
    print("Add LINE_RICH_MENU_MAIN_ID to Render environment variables.")


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def liff_url_from_id(liff_id: str) -> str:
    return f"https://liff.line.me/{liff_id}"


def resolve_main_app_base_url(default_liff_url: str) -> str:
    return (os.getenv("LIFF_MAIN_URL_BASE") or default_liff_url).rstrip("/")


class PreparedImage:
    def __init__(self, path: Path, width: int, height: int) -> None:
        self.path = path
        self.width = width
        self.height = height


def prepare_image(source: Path) -> PreparedImage:
    if not source.exists():
        raise RuntimeError(f"Missing rich menu image: {source}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image = Image.open(source).convert("RGB")
    output = OUTPUT_DIR / f"{source.stem}.jpg"

    quality = 92
    while quality >= 45:
        image.save(output, format="JPEG", quality=quality, optimize=True)
        if output.stat().st_size <= MAX_IMAGE_BYTES:
            return PreparedImage(output, image.width, image.height)
        quality -= 7

    raise RuntimeError(f"Could not compress {source.name} under {MAX_IMAGE_BYTES} bytes")


def build_start_menu_payload(width: int, height: int, liff_url: str) -> dict[str, Any]:
    return {
        "size": {"width": width, "height": height},
        "selected": True,
        "name": "MoneyTrack Start",
        "chatBarText": "เริ่มต้น",
        "areas": [
            {
                "bounds": {"x": 0, "y": 0, "width": width, "height": height},
                "action": {"type": "uri", "uri": liff_url},
            }
        ],
    }


def build_main_menu_payload(width: int, height: int, app_base_url: str) -> dict[str, Any]:
    # Coordinates match the current 1920x1200 artwork and scale if the image size changes.
    def area(x: int, y: int, w: int, h: int, action: dict[str, str]) -> dict[str, Any]:
        return {
            "bounds": {
                "x": scale(x, 1920, width),
                "y": scale(y, 1200, height),
                "width": scale(w, 1920, width),
                "height": scale(h, 1200, height),
            },
            "action": action,
        }

    return {
        "size": {"width": width, "height": height},
        "selected": True,
        "name": "MoneyTrack Main",
        "chatBarText": "เมนู",
        "areas": [
            area(0, 0, 1200, 850, {"type": "postback", "data": "show_quick_start"}),
            area(1200, 0, 360, 410, {"type": "uri", "uri": f"{app_base_url}/liff/summary"}),
            area(1560, 0, 360, 410, {"type": "uri", "uri": f"{app_base_url}/liff/insights"}),
            area(1200, 410, 360, 440, {"type": "uri", "uri": f"{app_base_url}/liff/categories"}),
            area(1560, 410, 360, 440, {"type": "uri", "uri": f"{app_base_url}/liff/transactions"}),
            area(860, 850, 340, 350, {"type": "message", "text": "ประกาศ"}),
            area(1200, 850, 360, 350, {"type": "uri", "uri": f"{app_base_url}/liff/settings"}),
            area(1560, 850, 360, 350, {"type": "message", "text": "Help"}),
        ],
    }


def scale(value: int, source: int, target: int) -> int:
    return round(value * target / source)


def create_rich_menu(access_token: str, payload: dict[str, Any]) -> str:
    response = httpx.post(
        f"{LINE_API_BASE}/richmenu",
        headers=auth_json_headers(access_token),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["richMenuId"]


def upload_rich_menu_image(access_token: str, rich_menu_id: str, image_path: Path) -> None:
    response = httpx.post(
        f"{LINE_DATA_API_BASE}/richmenu/{rich_menu_id}/content",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "image/jpeg",
        },
        content=image_path.read_bytes(),
        timeout=30,
    )
    response.raise_for_status()


def set_default_rich_menu(access_token: str, rich_menu_id: str) -> None:
    response = httpx.post(
        f"{LINE_API_BASE}/user/all/richmenu/{rich_menu_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    response.raise_for_status()


def auth_json_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


if __name__ == "__main__":
    main()
