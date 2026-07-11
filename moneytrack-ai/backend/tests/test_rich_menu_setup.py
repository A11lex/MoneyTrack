import importlib.util
from pathlib import Path


def test_main_rich_menu_largest_panel_opens_quick_start_flex() -> None:
    module = _load_setup_module()

    payload = module.build_main_menu_payload(
        width=1920,
        height=1200,
        app_base_url="https://money-track-sandy.vercel.app",
        line_oa_url="https://page.line.me/moneytrack",
    )

    largest_panel = payload["areas"][0]
    assert largest_panel["bounds"] == {"x": 0, "y": 0, "width": 1200, "height": 850}
    assert largest_panel["action"] == {"type": "postback", "data": "show_quick_start"}


def test_start_rich_menu_opens_onboarding_route() -> None:
    module = _load_setup_module()

    payload = module.build_start_menu_payload(
        width=2500,
        height=1686,
        liff_url="https://liff.line.me/2010521304-BrGvBhsP",
    )

    assert payload["areas"][0]["action"] == {
        "type": "uri",
        "uri": "https://liff.line.me/2010521304-BrGvBhsP/liff/onboarding",
    }


def test_main_rich_menu_navigation_buttons_use_app_base_url() -> None:
    module = _load_setup_module()

    payload = module.build_main_menu_payload(
        width=1920,
        height=1200,
        app_base_url="https://liff.line.me/2010521304-BrGvBhsP",
        line_oa_url="https://page.line.me/moneytrack",
    )

    assert payload["areas"][1]["action"] == {
        "type": "uri",
        "uri": "https://liff.line.me/2010521304-BrGvBhsP/liff/summary",
    }
    assert payload["areas"][2]["action"] == {
        "type": "uri",
        "uri": "https://liff.line.me/2010521304-BrGvBhsP/liff/insights",
    }
    assert payload["areas"][3]["action"] == {
        "type": "uri",
        "uri": "https://liff.line.me/2010521304-BrGvBhsP/liff/categories",
    }
    assert payload["areas"][4]["action"] == {
        "type": "uri",
        "uri": "https://liff.line.me/2010521304-BrGvBhsP/liff/transactions",
    }
    assert payload["areas"][6]["action"] == {
        "type": "uri",
        "uri": "https://liff.line.me/2010521304-BrGvBhsP/liff/settings",
    }
    assert payload["areas"][5]["action"] == {
        "type": "uri",
        "uri": "https://page.line.me/moneytrack",
    }


def test_main_app_base_url_defaults_to_liff_url_even_when_frontend_origin_exists(monkeypatch) -> None:
    module = _load_setup_module()

    monkeypatch.setenv("LIFF_APP_BASE_URL", "https://money-track-sandy.vercel.app/")
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://money-track-sandy.vercel.app")

    assert (
        module.resolve_main_app_base_url("https://liff.line.me/2010521304-BrGvBhsP")
        == "https://liff.line.me/2010521304-BrGvBhsP"
    )


def test_main_app_base_url_rejects_non_liff_rich_menu_override(monkeypatch) -> None:
    module = _load_setup_module()

    monkeypatch.setenv("LIFF_MAIN_URL_BASE", "https://example.com/custom/")

    assert (
        module.resolve_main_app_base_url("https://liff.line.me/2010521304-BrGvBhsP")
        == "https://liff.line.me/2010521304-BrGvBhsP"
    )


def test_main_app_base_url_allows_liff_rich_menu_override(monkeypatch) -> None:
    module = _load_setup_module()

    monkeypatch.setenv("LIFF_MAIN_URL_BASE", "https://liff.line.me/custom-liff-id/")

    assert (
        module.resolve_main_app_base_url("https://liff.line.me/2010521304-BrGvBhsP")
        == "https://liff.line.me/custom-liff-id"
    )


def test_default_liff_id_matches_configured_line_liff_id() -> None:
    module = _load_setup_module()

    assert module.DEFAULT_LIFF_ID == "2010521304-BrGvBhsP"
    assert module.liff_url_from_id(module.DEFAULT_LIFF_ID) == "https://liff.line.me/2010521304-BrGvBhsP"


def _load_setup_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "setup_rich_menus.py"
    spec = importlib.util.spec_from_file_location("setup_rich_menus", script_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
