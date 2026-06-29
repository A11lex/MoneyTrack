from datetime import date

from fastapi.testclient import TestClient

from app import database
from app.database import create_transaction, get_user_settings, list_transactions, save_user_settings
from app.main import app
from app.models import TransactionCreate, TransactionMode, TransactionType, UserSettingsUpdate


def test_upsert_line_user_and_get_initial_setup(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    response = client.post(
        "/users/line",
        json={
            "line_user_id": "line-user-001",
            "display_name": "Alex",
            "picture_url": "https://example.com/avatar.png",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "line_user_id": "line-user-001",
        "display_name": "Alex",
        "picture_url": "https://example.com/avatar.png",
        "onboarding_completed": False,
        "discovery_source": None,
        "expense_categories": [],
        "income_categories": [],
        "monthly_budgets": {},
        "budget_cycle": "monthly",
        "budget_start_day": 1,
    }

    setup = client.get("/users/line/line-user-001/setup")
    assert setup.status_code == 200
    assert setup.json()["onboarding_completed"] is False


def test_generic_line_user_upsert_does_not_overwrite_existing_profile(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    client.post(
        "/users/line",
        json={
            "line_user_id": "line-user-001",
            "display_name": "Alex",
            "picture_url": "https://example.com/avatar.png",
        },
    )
    response = client.post(
        "/users/line",
        json={
            "line_user_id": "line-user-001",
            "display_name": "LINE User",
            "picture_url": None,
        },
    )

    assert response.status_code == 200
    assert response.json()["display_name"] == "Alex"
    assert response.json()["picture_url"] == "https://example.com/avatar.png"


def test_save_line_user_onboarding_categories_and_budgets(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)
    client.post(
        "/users/line",
        json={"line_user_id": "line-user-001", "display_name": "Alex"},
    )

    response = client.post(
        "/users/line/line-user-001/onboarding",
        json={
            "discovery_source": "Facebook",
            "expense_categories": ["Food", "Transport", "Utilities"],
            "income_categories": ["Salary", "Business Revenue"],
            "monthly_budgets": {"Food": 15000, "Transport": 3000},
            "budget_cycle": "weekly",
            "budget_start_day": 3,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "line_user_id": "line-user-001",
        "display_name": "Alex",
        "picture_url": None,
        "onboarding_completed": True,
        "discovery_source": "Facebook",
        "expense_categories": ["Food", "Transport", "Utilities"],
        "income_categories": ["Salary", "Business Revenue"],
        "monthly_budgets": {"Food": 15000, "Transport": 3000},
        "budget_cycle": "weekly",
        "budget_start_day": 3,
    }


def test_save_line_user_onboarding_merges_alternate_line_user_data(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)
    client.post("/users/line", json={"line_user_id": "profile-id", "display_name": "Alex"})
    client.post("/users/line", json={"line_user_id": "context-id", "display_name": "LINE User"})
    client.post(
        "/users/line/profile-id/onboarding",
        json={
            "discovery_source": "Facebook",
            "expense_categories": ["Food"],
            "income_categories": ["Salary"],
            "monthly_budgets": {"Food": 200},
        },
    )
    create_transaction(
        TransactionCreate(
            date=date(2026, 6, 25),
            type=TransactionType.expense,
            amount=80,
            category="Food",
            description="Rice",
            mode=TransactionMode.personal,
        ),
        db_path,
        line_user_id="profile-id",
    )
    save_user_settings(
        "profile-id",
        UserSettingsUpdate(memory_categorization_enabled=True),
        db_path,
    )

    response = client.post(
        "/users/line/context-id/onboarding",
        json={
            "discovery_source": "Facebook",
            "expense_categories": ["Food"],
            "income_categories": ["Salary"],
            "monthly_budgets": {"Food": 200},
            "merge_from_line_user_id": "profile-id",
        },
    )

    assert response.status_code == 200
    assert response.json()["display_name"] == "Alex"
    context_transactions = list_transactions(db_path, line_user_id="context-id")
    assert len(context_transactions) == 1
    assert context_transactions[0].amount == 80
    assert list_transactions(db_path, line_user_id="profile-id") == []
    assert get_user_settings("context-id", db_path).memory_categorization_enabled is True


def test_save_line_user_onboarding_links_main_rich_menu_when_configured(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", "access-token-001")
    monkeypatch.setenv("LINE_RICH_MENU_MAIN_ID", "richmenu-main-001")
    calls = []

    def fake_link(line_user_id: str, rich_menu_id: str, access_token: str) -> None:
        calls.append(
            {
                "line_user_id": line_user_id,
                "rich_menu_id": rich_menu_id,
                "access_token": access_token,
            }
        )

    monkeypatch.setattr("app.main.link_user_rich_menu", fake_link)
    client = TestClient(app)
    client.post(
        "/users/line",
        json={"line_user_id": "line-user-001", "display_name": "Alex"},
    )

    response = client.post(
        "/users/line/line-user-001/onboarding",
        json={
            "discovery_source": "Facebook",
            "expense_categories": ["Food"],
            "income_categories": ["Salary"],
            "monthly_budgets": {},
        },
    )

    assert response.status_code == 200
    assert calls == [
        {
            "line_user_id": "line-user-001",
            "rich_menu_id": "richmenu-main-001",
            "access_token": "access-token-001",
        }
    ]


def test_get_setup_returns_404_for_unknown_line_user(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    response = client.get("/users/line/missing-user/setup")

    assert response.status_code == 404
    assert response.json() == {"detail": "LINE user not found"}
