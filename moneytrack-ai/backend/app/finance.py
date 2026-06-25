from datetime import date

import numpy as np
import pandas as pd

from .models import Transaction, WhatIfScenario


def _frame(transactions: list[Transaction]) -> pd.DataFrame:
    rows = [transaction.model_dump() for transaction in transactions]
    if not rows:
        return pd.DataFrame(columns=["date", "type", "amount", "category", "description", "mode"])
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    return df


def _risk_level(score: int) -> str:
    if score >= 75:
        return "Low"
    if score >= 50:
        return "Medium"
    return "High"


def calculate_summary(transactions: list[Transaction], today: date | None = None) -> dict:
    today = today or date.today()
    df = _frame(transactions)
    if df.empty:
        return {
            "total_income": 0,
            "total_expense": 0,
            "net_balance": 0,
            "savings_rate": 0,
            "expense_to_income_ratio": 0,
            "current_month_cashflow": 0,
            "projected_end_of_month_balance": 0,
        }

    income = float(df.loc[df["type"] == "income", "amount"].sum())
    expense = float(df.loc[df["type"] == "expense", "amount"].sum())
    net = income - expense

    month_df = df[(df["date"].dt.month == today.month) & (df["date"].dt.year == today.year)]
    month_income = float(month_df.loc[month_df["type"] == "income", "amount"].sum())
    month_expense = float(month_df.loc[month_df["type"] == "expense", "amount"].sum())
    current_month_cashflow = month_income - month_expense

    days_elapsed = max(today.day, 1)
    days_in_month = pd.Period(today, freq="M").days_in_month
    # Project end-of-month balance by extending the current daily cashflow pace.
    projected_eom = (current_month_cashflow / days_elapsed) * days_in_month

    return {
        "total_income": round(income, 2),
        "total_expense": round(expense, 2),
        "net_balance": round(net, 2),
        "savings_rate": round((net / income) * 100, 2) if income else 0,
        "expense_to_income_ratio": round((expense / income) * 100, 2) if income else 0,
        "current_month_cashflow": round(current_month_cashflow, 2),
        "projected_end_of_month_balance": round(projected_eom, 2),
    }


def chart_data(transactions: list[Transaction]) -> dict:
    df = _frame(transactions)
    if df.empty:
        return {
            "income_vs_expense": [],
            "expense_by_category": [],
            "daily_cashflow": [],
            "personal_vs_business": [],
        }

    df["month"] = df["date"].dt.strftime("%b %Y")
    monthly = (
        df.pivot_table(index="month", columns="type", values="amount", aggfunc="sum", fill_value=0)
        .reset_index()
        .rename_axis(None, axis=1)
    )
    for key in ["income", "expense"]:
        if key not in monthly:
            monthly[key] = 0

    expense_df = df[df["type"] == "expense"]
    category = expense_df.groupby("category", as_index=False)["amount"].sum().sort_values("amount", ascending=False)

    daily = df.assign(
        date_key=df["date"].dt.strftime("%Y-%m-%d"),
        signed=np.where(df["type"] == "income", df["amount"], -df["amount"]),
    )
    daily = daily.groupby("date_key", as_index=False)["signed"].sum()
    daily = daily.rename(columns={"date_key": "date", "signed": "cashflow"})

    mode = expense_df.groupby("mode", as_index=False)["amount"].sum()

    return {
        "income_vs_expense": monthly[["month", "income", "expense"]].to_dict("records"),
        "expense_by_category": category.to_dict("records"),
        "daily_cashflow": daily.to_dict("records"),
        "personal_vs_business": mode.to_dict("records"),
    }


def financial_health_score(transactions: list[Transaction]) -> dict:
    summary = calculate_summary(transactions)
    df = _frame(transactions)
    income = summary["total_income"]
    expense = summary["total_expense"]
    debt = float(df.loc[(df["type"] == "expense") & (df["category"] == "Debt Payment"), "amount"].sum()) if not df.empty else 0

    max_category_share = 0
    if expense:
        category_totals = df.loc[df["type"] == "expense"].groupby("category")["amount"].sum()
        max_category_share = float(category_totals.max() / expense)

    score = 0
    score += 25 if summary["net_balance"] > 0 else 0
    score += min(max(summary["savings_rate"], 0), 25)
    debt_ratio = (debt / income) * 100 if income else 100
    score += max(0, 20 - max(0, debt_ratio - 15))
    score += max(0, 20 - max(0, summary["expense_to_income_ratio"] - 70) * 0.5)
    score += 10 if max_category_share <= 0.35 else max(0, 10 - (max_category_share - 0.35) * 40)
    final_score = int(round(min(score, 100)))

    return {
        "score": final_score,
        "risk_level": _risk_level(final_score),
        "explanation": _score_explanation(final_score, summary),
    }


def _score_explanation(score: int, summary: dict) -> str:
    if score >= 75:
        return f"Cashflow is positive with a {summary['savings_rate']}% savings rate."
    if score >= 50:
        return "Finances are workable, but savings, debt, or spending concentration need attention."
    return "Cashflow pressure is high. Reduce large expense categories and protect essential income."


def advisor(transactions: list[Transaction]) -> dict:
    summary = calculate_summary(transactions)
    df = _frame(transactions)
    income = summary["total_income"]
    expense = summary["total_expense"]
    risks: list[str] = []
    warnings: list[str] = []
    actions: list[str] = []
    opportunities: list[str] = []

    if expense > income:
        risks.append("Expenses exceed income, creating negative cashflow.")
        actions.append("Freeze discretionary spending until monthly cashflow turns positive.")

    food = float(df.loc[(df["type"] == "expense") & (df["category"] == "Food"), "amount"].sum()) if not df.empty else 0
    if expense and food / expense > 0.30:
        warnings.append("Food spending is above 30% of total expenses.")
        opportunities.append("Plan groceries and reduce restaurant spend to bring food below 25% of expenses.")

    debt = float(df.loc[(df["type"] == "expense") & (df["category"] == "Debt Payment"), "amount"].sum()) if not df.empty else 0
    if income and debt / income > 0.35:
        risks.append("Debt payments exceed 35% of income.")
        actions.append("Prioritize refinancing, extra principal payments, or lower-interest consolidation.")

    if summary["savings_rate"] < 10:
        warnings.append("Savings rate is below the 10% baseline.")
        actions.append("Set an automatic transfer target before discretionary spending.")

    business_revenue = float(df.loc[(df["type"] == "income") & (df["category"] == "Business Revenue"), "amount"].sum()) if not df.empty else 0
    business_cost = float(df.loc[(df["type"] == "expense") & (df["category"] == "Business Cost"), "amount"].sum()) if not df.empty else 0
    if business_revenue and business_cost / business_revenue > 0.60:
        risks.append("Business costs are consuming more than 60% of business revenue.")
        actions.append("Review software, contractor, and fulfillment costs before taking on new work.")

    if not opportunities:
        opportunities.append("Keep savings above 15% and review the largest category weekly.")

    return {
        "executive_summary": _executive_summary(summary),
        "key_risks": risks or ["No critical financial risks detected."],
        "spending_warnings": warnings or ["Spending is within the current rule-based thresholds."],
        "recommended_actions": actions or ["Maintain current spending discipline and keep tracking weekly."],
        "saving_opportunities": opportunities,
    }


def _executive_summary(summary: dict) -> str:
    direction = "positive" if summary["net_balance"] >= 0 else "negative"
    return (
        f"Net balance is {direction} at {summary['net_balance']:.2f}. "
        f"Savings rate is {summary['savings_rate']:.2f}% and expense-to-income ratio is "
        f"{summary['expense_to_income_ratio']:.2f}%."
    )


def simulate_what_if(transactions: list[Transaction], scenario: WhatIfScenario) -> dict:
    original = calculate_summary(transactions)
    adjusted: list[Transaction] = []
    for tx in transactions:
        data = tx.model_copy(deep=True)
        if data.type == "expense" and data.category == "Food":
            data.amount *= 1 - scenario.reduce_food_percent / 100
        if data.type == "expense" and data.category == "Shopping":
            data.amount *= 1 - scenario.reduce_shopping_percent / 100
        if data.type == "income":
            data.amount *= 1 + scenario.increase_income_percent / 100
        if data.type == "expense" and data.category == "Debt Payment":
            data.amount *= 1 - scenario.reduce_debt_percent / 100
        if data.type == "expense" and data.category == "Business Cost":
            data.amount *= 1 - scenario.reduce_business_cost_percent / 100
        adjusted.append(data)

    new_summary = calculate_summary(adjusted)
    original_health = financial_health_score(transactions)
    new_health = financial_health_score(adjusted)
    return {
        "original_net_balance": original["net_balance"],
        "new_net_balance": new_summary["net_balance"],
        "monthly_savings_improvement": round(new_summary["net_balance"] - original["net_balance"], 2),
        "original_risk_level": original_health["risk_level"],
        "new_risk_level": new_health["risk_level"],
    }
