export type TransactionType = "income" | "expense";
export type TransactionMode = "personal" | "business";

export type Transaction = {
  id: number;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  mode: TransactionMode;
};

export type TransactionInput = Omit<Transaction, "id">;

export type RecurringInterval = "daily" | "weekly" | "monthly" | "yearly";

export type RecurringTransaction = {
  id: number;
  line_user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  mode: TransactionMode;
  interval: RecurringInterval;
  day_of_week?: number | null;
  day_of_month?: number | null;
  month?: number | null;
  notify_time: string;
  last_run_date?: string | null;
};

export type RecurringTransactionInput = Omit<RecurringTransaction, "id" | "line_user_id" | "last_run_date">;

export type Summary = {
  total_income: number;
  total_expense: number;
  net_balance: number;
  savings_rate: number;
  expense_to_income_ratio: number;
  current_month_cashflow: number;
  projected_end_of_month_balance: number;
};

export type Advisor = {
  executive_summary: string;
  key_risks: string[];
  spending_warnings: string[];
  recommended_actions: string[];
  saving_opportunities: string[];
};

export type Health = {
  score: number;
  risk_level: "Low" | "Medium" | "High";
  explanation: string;
};

export type DashboardData = {
  summary: Summary;
  charts: {
    income_vs_expense: { month: string; income: number; expense: number }[];
    expense_by_category: { category: string; amount: number }[];
    daily_cashflow: { date: string; cashflow: number }[];
    personal_vs_business: { mode: string; amount: number }[];
  };
  advisor: Advisor;
  health: Health;
};

export type WhatIfScenario = {
  reduce_food_percent: number;
  reduce_shopping_percent: number;
  increase_income_percent: number;
  reduce_debt_percent: number;
  reduce_business_cost_percent: number;
};

export type WhatIfResult = {
  original_net_balance: number;
  new_net_balance: number;
  monthly_savings_improvement: number;
  original_risk_level: string;
  new_risk_level: string;
};

export type LineUserSetup = {
  line_user_id: string;
  display_name: string;
  picture_url?: string | null;
  onboarding_completed: boolean;
  discovery_source?: string | null;
  expense_categories: string[];
  income_categories: string[];
  monthly_budgets: Record<string, number>;
  budget_cycle: "daily" | "weekly" | "monthly";
  budget_start_day: number;
};

export type LineUserInput = {
  line_user_id: string;
  display_name: string;
  picture_url?: string | null;
};

export type OnboardingInput = {
  discovery_source?: string | null;
  expense_categories: string[];
  income_categories: string[];
  monthly_budgets: Record<string, number>;
  budget_cycle?: "daily" | "weekly" | "monthly";
  budget_start_day?: number;
};
