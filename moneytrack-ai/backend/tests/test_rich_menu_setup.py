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


def _load_setup_module():
    script_path = Path(__file__).resolve().parents[1] / "scripts" / "setup_rich_menus.py"
    spec = importlib.util.spec_from_file_location("setup_rich_menus", script_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
