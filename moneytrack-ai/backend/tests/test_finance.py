from datetime import date

from app.finance import advisor, calculate_summary, chart_data, financial_health_score, simulate_what_if
from app.models import Transaction, WhatIfScenario


def tx(id: int, day: int, type: str, amount: float, category: str, mode: str = "personal") -> Transaction:
    return Transaction(
        id=id,
        date=date(2026, 6, day),
        type=type,
        amount=amount,
        category=category,
        description=category,
        mode=mode,
    )


def test_summary_calculates_core_financial_metrics() -> None:
    transactions = [
        tx(1, 1, "income", 5000, "Salary"),
        tx(2, 2, "expense", 1500, "Rent / Home"),
        tx(3, 3, "expense", 500, "Food"),
    ]

    summary = calculate_summary(transactions, today=date(2026, 6, 15))

    assert summary["total_income"] == 5000
    assert summary["total_expense"] == 2000
    assert summary["net_balance"] == 3000
    assert summary["savings_rate"] == 60
    assert summary["expense_to_income_ratio"] == 40
    assert summary["current_month_cashflow"] == 3000
    assert summary["projected_end_of_month_balance"] == 6000


def test_health_score_flags_high_risk_negative_cashflow() -> None:
    transactions = [
        tx(1, 1, "income", 3000, "Salary"),
        tx(2, 2, "expense", 2200, "Rent / Home"),
        tx(3, 3, "expense", 1200, "Debt Payment"),
        tx(4, 4, "expense", 900, "Food"),
    ]

    health = financial_health_score(transactions)

    assert health["score"] < 50
    assert health["risk_level"] == "High"


def test_chart_data_builds_daily_cashflow_without_shape_errors() -> None:
    transactions = [
        tx(1, 1, "income", 5000, "Salary"),
        tx(2, 1, "expense", 120, "Food"),
        tx(3, 2, "expense", 80, "Transport"),
    ]

    charts = chart_data(transactions)

    assert charts["daily_cashflow"] == [
        {"date": "2026-06-01", "cashflow": 4880},
        {"date": "2026-06-02", "cashflow": -80},
    ]


def test_advisor_outputs_rule_based_warnings() -> None:
    transactions = [
        tx(1, 1, "income", 3000, "Salary"),
        tx(2, 2, "expense", 1300, "Debt Payment"),
        tx(3, 3, "expense", 1100, "Food"),
        tx(4, 4, "expense", 900, "Shopping"),
    ]

    result = advisor(transactions)

    assert any("negative cashflow" in item for item in result["key_risks"])
    assert any("Debt payments exceed 35%" in item for item in result["key_risks"])
    assert any("Food spending" in item for item in result["spending_warnings"])
    assert any("Savings rate" in item for item in result["spending_warnings"])


def test_what_if_improves_balance_and_risk() -> None:
    transactions = [
        tx(1, 1, "income", 3000, "Salary"),
        tx(2, 2, "expense", 1000, "Food"),
        tx(3, 3, "expense", 1000, "Shopping"),
        tx(4, 4, "expense", 800, "Debt Payment"),
    ]

    result = simulate_what_if(
        transactions,
        WhatIfScenario(reduce_food_percent=20, reduce_shopping_percent=20, increase_income_percent=10),
    )

    assert result["original_net_balance"] == 200
    assert result["new_net_balance"] == 900
    assert result["monthly_savings_improvement"] == 700
