import importlib.util
from pathlib import Path


def test_main_rich_menu_largest_panel_opens_quick_start_flex() -> None:
    module = _load_setup_module()

    payload = module.build_main_menu_payload(
        width=1920,
        height=1200,
        app_base_url="https://money-track-sandy.vercel.app",
    )

    largest_panel = payload["areas"][0]
    assert largest_panel["bounds"] == {"x": 0, "y": 0, "width": 1200, "height": 850}
    assert largest_panel["action"] == {"type": "postback", "data": "show_quick_start"}


def test_main_rich_menu_navigation_buttons_use_app_base_url() -> None:
    module = _load_setup_module()

    payload = module.build_main_menu_payload(
        width=1920,
        height=1200,
        app_base_url="https://money-track-sandy.vercel.app",
    )

    assert payload["areas"][1]["action"] == {
        "type": "uri",
        "uri": "https://money-track-sandy.vercel.app/liff/summary",
    }
    assert payload["areas"][2]["action"] == {
        "type": "uri",
        "uri": "https://money-track-sandy.vercel.app/liff/insights",
    }
    assert payload["areas"][3]["action"] == {
        "type": "uri",
        "uri": "https://money-track-sandy.vercel.app/liff/categories",
    }
    assert payload["areas"][4]["action"] == {
        "type": "uri",
        "uri": "https://money-track-sandy.vercel.app/liff/transactions",
    }
    assert payload["areas"][6]["action"] == {
        "type": "uri",
        "uri": "https://money-track-sandy.vercel.app/liff/settings",
    }


def test_main_app_base_url_accepts_existing_env_aliases(monkeypatch) -> None:
    module = _load_setup_module()

    monkeypatch.setenv("LIFF_APP_BASE_URL", "https://money-track-sandy.vercel.app/")

    assert (
        module.resolve_main_app_base_url("https://liff.line.me/2010521304-BrGvBhsP")
        == "https://money-track-sandy.vercel.app"
    )


def test_normalized_liff_id_fixes_known_lowercase_typo() -> None:
    module = _load_setup_module()

    assert module.normalized_liff_id("2010521304-BrGvBhsp") == "2010521304-BrGvBhsP"


def _load_setup_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "setup_rich_menus.py"
    spec = importlib.util.spec_from_file_location("setup_rich_menus", script_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
