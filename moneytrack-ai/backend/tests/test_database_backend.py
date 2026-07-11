import pytest

from app.database_backend import adapt_sql, database_kind, require_persistent_database


def test_database_kind_supports_sqlite_paths_and_urls() -> None:
    assert database_kind("moneytrack.db") == "sqlite"
    assert database_kind("sqlite:///tmp/moneytrack.db") == "sqlite"


def test_database_kind_supports_render_postgres_urls() -> None:
    assert database_kind("postgresql://user:pass@db.example.com/moneytrack") == "postgresql"
    assert database_kind("postgres://user:pass@db.example.com/moneytrack") == "postgresql"


def test_postgres_sql_rewrites_sqlite_placeholders_and_identity() -> None:
    sql = "CREATE TABLE sample (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT WHERE name = ?)"

    adapted = adapt_sql(sql, "postgresql")

    assert "BIGSERIAL PRIMARY KEY" in adapted
    assert "name = %s" in adapted


def test_postgres_sql_rewrites_insert_or_ignore() -> None:
    sql = "INSERT OR IGNORE INTO processed_line_webhook_events (webhook_event_id) VALUES (?)"

    adapted = adapt_sql(sql, "postgresql")

    assert adapted == (
        "INSERT INTO processed_line_webhook_events (webhook_event_id) "
        "VALUES (%s) ON CONFLICT DO NOTHING"
    )


def test_render_refuses_to_start_with_ephemeral_sqlite() -> None:
    with pytest.raises(RuntimeError, match="persistent PostgreSQL"):
        require_persistent_database("moneytrack.db", render_environment="true")


def test_local_development_can_keep_using_sqlite() -> None:
    require_persistent_database("moneytrack.db", render_environment=None)


def test_render_accepts_postgres() -> None:
    require_persistent_database("postgresql://user:pass@host/database", render_environment="true")
