"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  WalletCards,
} from "lucide-react";

import {
  createTransaction,
  deleteTransaction,
  getDashboard,
  getTransactions,
  runWhatIf,
  updateTransaction,
} from "@/lib/api";
import { demoDashboard, demoTransactions } from "@/lib/demo";
import { Locale, t } from "@/lib/i18n";
import type { DashboardData, Transaction, TransactionInput, TransactionType, WhatIfResult } from "@/lib/types";

const incomeCategories = ["Salary", "Freelance", "Business Revenue", "Other Income"];
const expenseCategories = [
  "Food",
  "Transport",
  "Rent / Home",
  "Utilities",
  "Debt Payment",
  "Shopping",
  "Health",
  "Business Cost",
  "Other Expense",
];
const palette = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

const blankForm: TransactionInput = {
  date: new Date().toISOString().slice(0, 10),
  type: "expense",
  amount: 0,
  category: "Food",
  description: "",
  mode: "personal",
};

export function Dashboard() {
  const [locale, setLocale] = useState<Locale>("en");
  const [dark, setDark] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>(demoDashboard);
  const [transactions, setTransactions] = useState<Transaction[]>(demoTransactions);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TransactionInput>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [busy, setBusy] = useState(false);

  const labels = useMemo(() => (key: Parameters<typeof t>[1]) => t(locale, key), [locale]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function refresh() {
    setLoading(true);
    try {
      const [dashboardData, transactionData] = await Promise.all([getDashboard(), getTransactions()]);
      setDashboard(dashboardData);
      setTransactions(transactionData);
      setApiOnline(true);
    } catch {
      setDashboard(demoDashboard);
      setTransactions(demoTransactions);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      setLoading(true);
      try {
        const [dashboardData, transactionData] = await Promise.all([getDashboard(), getTransactions()]);
        if (!cancelled) {
          setDashboard(dashboardData);
          setTransactions(transactionData);
          setApiOnline(true);
        }
      } catch {
        if (!cancelled) {
          setDashboard(demoDashboard);
          setTransactions(demoTransactions);
          setApiOnline(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = form.type === "income" ? incomeCategories : expenseCategories;

  function updateField<K extends keyof TransactionInput>(key: K, value: TransactionInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      category: key === "type" ? (value === "income" ? "Salary" : "Food") : current.category,
    }));
  }

  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.amount || form.amount <= 0) return;
    setBusy(true);
    try {
      if (editingId) {
        await updateTransaction(editingId, form);
      } else {
        await createTransaction(form);
      }
      setForm(blankForm);
      setEditingId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeTransaction(id: number) {
    setBusy(true);
    try {
      await deleteTransaction(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function editTransaction(transaction: Transaction) {
    setEditingId(transaction.id);
    setForm({
      date: transaction.date,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      mode: transaction.mode,
    });
  }

  async function simulate() {
    setBusy(true);
    try {
      const result = apiOnline
        ? await runWhatIf({
            reduce_food_percent: 20,
            reduce_shopping_percent: 20,
            increase_income_percent: 10,
            reduce_debt_percent: 10,
            reduce_business_cost_percent: 15,
          })
        : {
            original_net_balance: 2500,
            new_net_balance: 3382,
            monthly_savings_improvement: 882,
            original_risk_level: "Low",
            new_risk_level: "Low",
          };
      setWhatIf(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#16211d] dark:bg-[#0c1110] dark:text-[#edf6f3]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-black/10 pb-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{labels("app")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#5f6f69] dark:text-[#a7b8b2]">{labels("tagline")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill online={apiOnline} text={apiOnline ? labels("connected") : labels("offline")} />
            <Segmented
              label={labels("language")}
              value={locale}
              options={[
                { label: "EN", value: "en" },
                { label: "TH", value: "th" },
              ]}
              onChange={(value) => setLocale(value as Locale)}
            />
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-medium text-[#23312d] hover:bg-[#edf3f0] dark:border-white/10 dark:bg-[#121a18] dark:text-[#edf6f3] dark:hover:bg-[#182320]"
              aria-label={labels("theme")}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? labels("light") : labels("dark")}
            </button>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white text-[#23312d] hover:bg-[#edf3f0] dark:border-white/10 dark:bg-[#121a18] dark:text-[#edf6f3] dark:hover:bg-[#182320]"
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <Metric title={labels("totalIncome")} value={money(dashboard.summary.total_income)} icon="up" />
          <Metric title={labels("totalExpense")} value={money(dashboard.summary.total_expense)} icon="down" />
          <Metric title={labels("netBalance")} value={money(dashboard.summary.net_balance)} icon="wallet" />
          <Metric title={labels("savingsRate")} value={`${dashboard.summary.savings_rate}%`} icon="chart" />
          <Metric title={labels("expenseRatio")} value={`${dashboard.summary.expense_to_income_ratio}%`} icon="down" />
          <Metric title={labels("cashflow")} value={money(dashboard.summary.current_month_cashflow)} icon="wallet" />
          <Metric title={labels("projected")} value={money(dashboard.summary.projected_end_of_month_balance)} icon="chart" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title={labels("charts")}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartBox title={labels("incomeVsExpense")}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={dashboard.charts.income_vs_expense}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7e0dc" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Bar dataKey="income" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title={labels("expenseByCategory")}>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={dashboard.charts.expense_by_category} dataKey="amount" nameKey="category" outerRadius={82} label>
                      {dashboard.charts.expense_by_category.map((entry, index) => (
                        <Cell key={entry.category} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title={labels("dailyCashflow")}>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={dashboard.charts.daily_cashflow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7e0dc" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Area type="monotone" dataKey="cashflow" stroke="#2563eb" fill="#bfdbfe" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title={labels("modeSpending")}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={dashboard.charts.personal_vs_business}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7e0dc" />
                    <XAxis dataKey="mode" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Bar dataKey="amount" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel title={labels("healthScore")}>
              <div className="flex items-center gap-5">
                <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-8 border-[#0f766e] bg-white text-3xl font-semibold dark:bg-[#121a18]">
                  {dashboard.health.score}
                </div>
                <div>
                  <p className="text-sm text-[#5f6f69] dark:text-[#a7b8b2]">{labels("risk")}</p>
                  <p className="mt-1 text-xl font-semibold">{dashboard.health.risk_level}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5f6f69] dark:text-[#a7b8b2]">{dashboard.health.explanation}</p>
                </div>
              </div>
            </Panel>
            <Panel title={labels("simulator")}>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {[labels("food"), labels("shopping"), labels("incomePlus"), labels("debt"), labels("businessCost")].map((item) => (
                  <span key={item} className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10">
                    {item}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={simulate}
                disabled={busy}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#0f766e] px-4 text-sm font-semibold text-white hover:bg-[#0b5f59] disabled:opacity-60"
              >
                <BarChart3 size={16} />
                {labels("run")}
              </button>
              {whatIf && (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Result label={labels("originalNet")} value={money(whatIf.original_net_balance)} />
                  <Result label={labels("newNet")} value={money(whatIf.new_net_balance)} />
                  <Result label={labels("improvement")} value={money(whatIf.monthly_savings_improvement)} />
                  <Result label={labels("riskChange")} value={`${whatIf.original_risk_level} -> ${whatIf.new_risk_level}`} />
                </div>
              )}
            </Panel>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title={labels("transaction")}>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submitTransaction}>
              <Field label={labels("date")}>
                <input className={inputClass} type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} required />
              </Field>
              <Field label={labels("type")}>
                <select className={inputClass} value={form.type} onChange={(event) => updateField("type", event.target.value as TransactionType)}>
                  <option value="income">{labels("income")}</option>
                  <option value="expense">{labels("expense")}</option>
                </select>
              </Field>
              <Field label={labels("amount")}>
                <input className={inputClass} type="number" min="0.01" step="0.01" value={form.amount || ""} onChange={(event) => updateField("amount", Number(event.target.value))} required />
              </Field>
              <Field label={labels("category")}>
                <select className={inputClass} value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={labels("mode")}>
                <select className={inputClass} value={form.mode} onChange={(event) => updateField("mode", event.target.value as TransactionInput["mode"])}>
                  <option value="personal">{labels("personal")}</option>
                  <option value="business">{labels("business")}</option>
                </select>
              </Field>
              <Field label={labels("description")}>
                <input className={inputClass} value={form.description} onChange={(event) => updateField("description", event.target.value)} maxLength={240} />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0f766e] px-4 text-sm font-semibold text-white hover:bg-[#0b5f59] disabled:opacity-60">
                  <Plus size={16} />
                  {editingId ? labels("update") : labels("add")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(blankForm);
                  }}
                  className="h-10 rounded-md border border-black/10 px-4 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                  {labels("clear")}
                </button>
              </div>
            </form>
          </Panel>

          <Panel title={labels("recentTransactions")}>
            {transactions.length === 0 ? (
              <div className="grid min-h-48 place-items-center rounded-md border border-dashed border-black/15 text-sm text-[#5f6f69] dark:border-white/15 dark:text-[#a7b8b2]">
                {labels("noTransactions")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-[#5f6f69] dark:text-[#a7b8b2]">
                    <tr>
                      <th className="py-2">{labels("date")}</th>
                      <th>{labels("type")}</th>
                      <th>{labels("category")}</th>
                      <th>{labels("mode")}</th>
                      <th className="text-right">{labels("amount")}</th>
                      <th className="text-right">{labels("edit")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10 dark:divide-white/10">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="py-3">{transaction.date}</td>
                        <td>
                          <span className={transaction.type === "income" ? "text-[#0f766e]" : "text-[#dc2626]"}>
                            {transaction.type === "income" ? labels("income") : labels("expense")}
                          </span>
                        </td>
                        <td>{transaction.category}</td>
                        <td>{transaction.mode === "business" ? labels("business") : labels("personal")}</td>
                        <td className="text-right font-medium">{money(transaction.amount)}</td>
                        <td className="text-right">
                          <button type="button" onClick={() => editTransaction(transaction)} className="mr-2 rounded-md p-2 hover:bg-black/5 dark:hover:bg-white/5" aria-label={labels("edit")}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => removeTransaction(transaction.id)} className="rounded-md p-2 text-[#dc2626] hover:bg-black/5 dark:hover:bg-white/5" aria-label={labels("delete")}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </section>

        <Panel title={labels("advisor")}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <AdviceBlock title={labels("executiveSummary")} items={[dashboard.advisor.executive_summary]} />
            <AdviceBlock title={labels("risks")} items={dashboard.advisor.key_risks} />
            <AdviceBlock title={labels("warnings")} items={dashboard.advisor.spending_warnings} />
            <AdviceBlock title={labels("actions")} items={dashboard.advisor.recommended_actions} />
            <AdviceBlock title={labels("opportunities")} items={dashboard.advisor.saving_opportunities} />
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: "up" | "down" | "wallet" | "chart" }) {
  const Icon = icon === "up" ? ArrowUpRight : icon === "down" ? ArrowDownRight : icon === "wallet" ? WalletCards : BriefcaseBusiness;
  return (
    <div className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#121a18]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-[#5f6f69] dark:text-[#a7b8b2]">{title}</p>
        <Icon size={17} className="text-[#0f766e]" />
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#121a18]">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-72 rounded-md border border-black/10 p-3 dark:border-white/10">
      <h3 className="mb-3 text-sm font-medium text-[#5f6f69] dark:text-[#a7b8b2]">{title}</h3>
      {children}
    </div>
  );
}

function AdviceBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-[#5f6f69] dark:text-[#a7b8b2]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-[#34423e] dark:text-[#c9d8d3]">
      {label}
      {children}
    </label>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <p className="text-xs text-[#5f6f69] dark:text-[#a7b8b2]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ online, text }: { online: boolean; text: string }) {
  return (
    <span className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium ${online ? "bg-[#dff3ed] text-[#0f766e] dark:bg-[#0f2f2b]" : "bg-[#fff4d6] text-[#8a5a00] dark:bg-[#382a0a] dark:text-[#f4cf72]"}`}>
      {text}
    </span>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-10 items-center rounded-md border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-[#121a18]" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`h-8 rounded px-3 text-sm font-medium ${value === option.value ? "bg-[#0f766e] text-white" : "text-[#5f6f69] hover:bg-black/5 dark:text-[#a7b8b2] dark:hover:bg-white/5"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const inputClass =
  "h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 dark:border-white/10 dark:bg-[#0c1110]";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
