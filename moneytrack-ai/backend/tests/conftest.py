import pytest


@pytest.fixture(autouse=True)
def test_environment(monkeypatch):
    monkeypatch.setenv("LINE_AUTH_REQUIRED", "0")
    monkeypatch.setenv("LINE_WEBHOOK_ALLOW_UNSIGNED", "1")
    monkeypatch.setenv("ENABLE_LINE_WEBHOOK_MOCK", "1")
