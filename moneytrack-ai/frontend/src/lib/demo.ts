import type { DashboardData, Transaction } from "./types";

export const demoTransactions: Transaction[] = [
  { id: 1, date: "2026-06-01", type: "income", amount: 4200, category: "Salary", description: "Monthly salary", mode: "personal" },
  { id: 2, date: "2026-06-03", type: "income", amount: 1800, category: "Business Revenue", description: "Client invoice", mode: "business" },
  { id: 3, date: "2026-06-04", type: "expense", amount: 1300, category: "Rent / Home", description: "Apartment rent", mode: "personal" },
  { id: 4, date: "2026-06-05", type: "expense", amount: 420, category: "Food", description: "Groceries and restaurants", mode: "personal" },
  { id: 5, date: "2026-06-10", type: "expense", amount: 780, category: "Debt Payment", description: "Loan payment", mode: "personal" },
  { id: 6, date: "2026-06-12", type: "expense", amount: 360, category: "Shopping", description: "Household items", mode: "personal" },
  { id: 7, date: "2026-06-14", type: "expense", amount: 640, category: "Business Cost", description: "Software and contractors", mode: "business" },
];

export const demoDashboard: DashboardData = {
  summary: {
    total_income: 6000,
    total_expense: 3500,
    net_balance: 2500,
    savings_rate: 41.67,
    expense_to_income_ratio: 58.33,
    current_month_cashflow: 2500,
    projected_end_of_month_balance: 3000,
  },
  charts: {
    income_vs_expense: [{ month: "Jun 2026", income: 6000, expense: 3500 }],
    expense_by_category: [
      { category: "Rent / Home", amount: 1300 },
      { category: "Debt Payment", amount: 780 },
      { category: "Business Cost", amount: 640 },
      { category: "Food", amount: 420 },
      { category: "Shopping", amount: 360 },
    ],
    daily_cashflow: [
      { date: "2026-06-01", cashflow: 4200 },
      { date: "2026-06-03", cashflow: 1800 },
      { date: "2026-06-04", cashflow: -1300 },
      { date: "2026-06-05", cashflow: -420 },
      { date: "2026-06-10", cashflow: -780 },
      { date: "2026-06-12", cashflow: -360 },
      { date: "2026-06-14", cashflow: -640 },
    ],
    personal_vs_business: [
      { mode: "personal", amount: 2860 },
      { mode: "business", amount: 640 },
    ],
  },
  advisor: {
    executive_summary: "Net balance is positive at 2500.00. Savings rate is 41.67% and expense-to-income ratio is 58.33%.",
    key_risks: ["No critical financial risks detected."],
    spending_warnings: ["Spending is within the current rule-based thresholds."],
    recommended_actions: ["Maintain current spending discipline and keep tracking weekly."],
    saving_opportunities: ["Keep savings above 15% and review the largest category weekly."],
  },
  health: {
    score: 94,
    risk_level: "Low",
    explanation: "Cashflow is positive with a 41.67% savings rate.",
  },
};
