from fastapi.testclient import TestClient

from app import database
from app.main import app


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
    }

    setup = client.get("/users/line/line-user-001/setup")
    assert setup.status_code == 200
    assert setup.json()["onboarding_completed"] is False


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
    }


def test_get_setup_returns_404_for_unknown_line_user(tmp_path, monkeypatch) -> None:
    db_path = str(tmp_path / "onboarding.db")
    monkeypatch.setattr(database, "DATABASE_URL", db_path)
    client = TestClient(app)

    response = client.get("/users/line/missing-user/setup")

    assert response.status_code == 404
    assert response.json() == {"detail": "LINE user not found"}
