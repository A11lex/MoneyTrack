"use client";

import { type DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  GripVertical,
  Home,
  LayoutList,
  Loader2,
  Plus,
  Settings,
  Tags,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import {
  createRecurringTransaction,
  createTransaction,
  deleteRecurringTransaction,
  deleteTransaction,
  getDailyReminderSettings,
  getDashboard,
  getRecurringTransactions,
  getTransactions,
  getUserSettings,
  saveDailyReminderSettings,
  saveLineUserOnboarding,
  saveUserSettings,
  updateRecurringTransaction,
  updateTransaction,
  upsertLineUser,
} from "@/lib/api";
import type { DailyReminderSettingsInput, DashboardData, RecurringTransactionInput, Transaction, TransactionInput, UserSettingsInput } from "@/lib/types";

type LiffTab = "summary" | "insights" | "categories" | "transactions" | "settings";
type UserPlan = "free" | "pro";
type BudgetMode = "category" | "total";
type BudgetCycle = "daily" | "weekly" | "monthly";
type RecurringInterval = "daily" | "weekly" | "monthly" | "yearly";
type PaymentChannelSettings = {
  enabled: boolean;
  channels: string[];
};
type CurrencyCode =
  | "THB"
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "AUD"
  | "CAD"
  | "CHF"
  | "CNY"
  | "SEK"
  | "NZD"
  | "MXN"
  | "SGD"
  | "HKD"
  | "NOK";
type CurrencySetting = {
  code: CurrencyCode;
  label: string;
  symbol: string;
};
type LanguageCode = "th" | "en";
type TimezoneSetting = {
  label: string;
  offset: string;
  value: string;
};
type ConfirmationSettingKey =
  | "confirmation_show_details"
  | "confirmation_show_budget"
  | "confirmation_show_budget_warning"
  | "confirmation_show_payment_options";
type RecurringItem = {
  id: number | string;
  type: "expense" | "income";
  amount: number;
  category: string;
  description: string;
  mode: "personal" | "business";
  interval: RecurringInterval;
  dayOfWeek?: number;
  dayOfMonth?: number;
  month?: number;
  notifyTime: string;
};
type LineProfile = {
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
};

const DEFAULT_LIFF_ID = "2010521304-BrGvBhsp";
const KNOWN_WRONG_LIFF_ID = "2010521304-BrGvBhsP";
const LINE_PROFILE_CACHE_KEY = "moneytrack.lineProfile";

const currencyOptions: CurrencySetting[] = [
  { code: "THB", label: "Thai Baht", symbol: "฿" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "SEK", label: "Swedish Krona", symbol: "kr" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$" },
  { code: "MXN", label: "Mexican Peso", symbol: "$" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NOK", label: "Norwegian Krone", symbol: "kr" },
];

const languageOptions: { code: LanguageCode; label: string }[] = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "English" },
];

const timezoneOptions: TimezoneSetting[] = [
  { label: "Athens", offset: "UTC+03:00", value: "Europe/Athens" },
  { label: "Moscow", offset: "UTC+03:00", value: "Europe/Moscow" },
  { label: "Istanbul", offset: "UTC+03:00", value: "Europe/Istanbul" },
  { label: "Riyadh", offset: "UTC+03:00", value: "Asia/Riyadh" },
  { label: "Nairobi", offset: "UTC+03:00", value: "Africa/Nairobi" },
  { label: "Tehran", offset: "UTC+03:30", value: "Asia/Tehran" },
  { label: "Dubai", offset: "UTC+04:00", value: "Asia/Dubai" },
  { label: "Kabul", offset: "UTC+04:30", value: "Asia/Kabul" },
  { label: "Karachi", offset: "UTC+05:00", value: "Asia/Karachi" },
  { label: "Kolkata", offset: "UTC+05:30", value: "Asia/Kolkata" },
  { label: "Colombo", offset: "UTC+05:30", value: "Asia/Colombo" },
  { label: "Kathmandu", offset: "UTC+05:45", value: "Asia/Kathmandu" },
  { label: "Dhaka", offset: "UTC+06:00", value: "Asia/Dhaka" },
  { label: "Yangon", offset: "UTC+06:30", value: "Asia/Yangon" },
  { label: "Bangkok", offset: "UTC+07:00", value: "Asia/Bangkok" },
  { label: "Singapore", offset: "UTC+08:00", value: "Asia/Singapore" },
  { label: "Tokyo", offset: "UTC+09:00", value: "Asia/Tokyo" },
  { label: "Sydney", offset: "UTC+10:00", value: "Australia/Sydney" },
  { label: "London", offset: "UTC+01:00", value: "Europe/London" },
  { label: "New York", offset: "UTC-04:00", value: "America/New_York" },
  { label: "Los Angeles", offset: "UTC-07:00", value: "America/Los_Angeles" },
];

const defaultUserSettings: UserSettingsInput = {
  memory_categorization_enabled: false,
  streak_notifications_enabled: false,
  timezone: "Asia/Bangkok",
  confirmation_show_details: true,
  confirmation_show_budget: true,
  confirmation_show_budget_warning: true,
  confirmation_show_payment_options: false,
};

const tabs: { id: LiffTab; label: string; href: string; icon: React.ElementType }[] = [
  { id: "summary", label: "สรุป", href: "/liff/summary", icon: Home },
  { id: "insights", label: "วิเคราะห์", href: "/liff/insights", icon: BarChart3 },
  { id: "categories", label: "หมวด / งบ", href: "/liff/categories", icon: Tags },
  { id: "transactions", label: "รายการ", href: "/liff/transactions", icon: LayoutList },
  { id: "settings", label: "ตั้งค่า", href: "/liff/settings", icon: Settings },
];

const expenseCategories = ["อาหาร", "เดินทาง", "ที่พัก", "ค่าโทรศัพท์", "ค่าเน็ต", "ค่าน้ำค่าไฟ", "ช้อปปิ้ง", "Subscription", "กาแฟ", "ผ่อนรถ", "อื่นๆ"];
const incomeCategories = ["เงินเดือน", "ธุรกิจส่วนตัว", "งานพิเศษ", "ค่าคอมมิชชั่น", "ขายของ", "เงินปันผล", "อื่นๆ"];
const categoryNameMap: Record<string, string> = {
  "Business Cost": "ธุรกิจ",
  "Business Revenue": "ธุรกิจส่วนตัว",
  "Debt Payment": "ผ่อนรถ",
  Food: "อาหาร",
  Freelance: "งานพิเศษ",
  Health: "สุขภาพ",
  "Other Expense": "อื่นๆ",
  "Other Income": "อื่นๆ",
  "Rent / Home": "ที่พัก",
  Salary: "เงินเดือน",
  Shopping: "ช้อปปิ้ง",
  Transport: "เดินทาง",
  Utilities: "ค่าน้ำค่าไฟ",
};

export function LiffAppView({ tab }: { tab: LiffTab }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [profile, setProfile] = useState<LineProfile>(() => getCachedLineProfile());
  const [plan] = useState<UserPlan>(() => loadStoredUserPlan());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadLineProfile().then((loadedProfile) => {
      if (!mounted) return Promise.reject(new Error("unmounted"));
      setProfile(loadedProfile);
      if (!loadedProfile.line_user_id) {
        return Promise.resolve<[DashboardData | null, Transaction[]]>([null, []]);
      }
      void upsertLineUser({
        line_user_id: loadedProfile.line_user_id,
        display_name: loadedProfile.display_name,
        picture_url: loadedProfile.picture_url,
      }).catch(() => undefined);
      return Promise.all([getDashboard(loadedProfile.line_user_id), getTransactions(loadedProfile.line_user_id)]);
    }).catch(() => Promise.resolve<[DashboardData | null, Transaction[]]>([null, []]))
      .then(([dashboardData, transactionData]) => {
        if (!mounted) return;
        setDashboard(dashboardData);
        setTransactions(transactionData);
      })
      .catch(() => {
        if (!mounted) return;
        setDashboard(null);
        setTransactions([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const latest = useMemo(() => transactions.slice(0, 4), [transactions]);

  function refreshDashboard() {
    getDashboard(profile.line_user_id || undefined)
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }

  function handleTransactionSaved(transaction: Transaction) {
    setTransactions((current) => current.map((item) => (item.id === transaction.id ? transaction : item)));
    setEditingTransaction(null);
    refreshDashboard();
  }

  function handleTransactionCreated(transaction: Transaction) {
    setTransactions((current) => [transaction, ...current]);
    setCreatingTransaction(false);
    refreshDashboard();
  }

  function handleTransactionDeleted(transactionId: number) {
    setTransactions((current) => current.filter((item) => item.id !== transactionId));
    setEditingTransaction(null);
    refreshDashboard();
  }

  return (
    <main className="moneytrack-liff min-h-screen bg-[#f8faf9] text-[#151b18]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white">
        <section className="flex-1 px-4 pb-24 pt-4">
          {loading ? (
            <LoadingState />
          ) : (
            <>
              {tab === "summary" && <SummaryScreen dashboard={dashboard} latest={latest} onEdit={setEditingTransaction} profile={profile} plan={plan} transactions={transactions} />}
              {tab === "insights" && <InsightsScreen dashboard={dashboard} transactions={transactions} />}
              {tab === "categories" && <CategoriesScreen profile={profile} transactions={transactions} />}
              {tab === "transactions" && (
                <TransactionsScreen
                  lineUserId={profile.line_user_id}
                  transactions={transactions}
                  onCreate={() => setCreatingTransaction(true)}
                  onEdit={setEditingTransaction}
                  onTransactionsChanged={(nextTransactions) => {
                    setTransactions(nextTransactions);
                    refreshDashboard();
                  }}
                />
              )}
              {tab === "settings" && <SettingsScreen profile={profile} />}
            </>
          )}
        </section>
        <BottomNav active={tab} />
        {editingTransaction && (
          <TransactionEditModal
            key={editingTransaction.id}
            lineUserId={profile.line_user_id}
            transaction={editingTransaction}
            onClose={() => setEditingTransaction(null)}
            onDeleted={handleTransactionDeleted}
            onSaved={handleTransactionSaved}
          />
        )}
        {creatingTransaction && (
          <TransactionCreateModal
            lineUserId={profile.line_user_id}
            onClose={() => setCreatingTransaction(false)}
            onCreated={handleTransactionCreated}
          />
        )}
      </div>
    </main>
  );
}

function SummaryScreen({
  dashboard,
  latest,
  onEdit,
  plan,
  profile,
  transactions,
}: {
  dashboard: DashboardData | null;
  latest: Transaction[];
  onEdit: (transaction: Transaction) => void;
  plan: UserPlan;
  profile: LineProfile;
  transactions: Transaction[];
}) {
  const [showMore, setShowMore] = useState(false);
  const [summaryFocus, setSummaryFocus] = useState<"expense" | "income">("expense");
  const [budgetMode] = useState<BudgetMode>(() => loadStoredBudgetMode());
  const [budgetCycle] = useState<BudgetCycle>(() => loadStoredBudgetCycle());
  const [budgetStartDay] = useState(() => loadStoredBudgetStartDay());
  const [expenseBudgets] = useState<Record<string, number>>(() => loadStoredExpenseBudgets());
  const [totalBudget] = useState(() => loadStoredTotalBudget());
  const summary = dashboard?.summary;
  const net = summary?.net_balance ?? 0;
  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;
  const isPositive = net >= 0;
  const periodExpenses = transactions.filter((transaction) => transaction.type === "expense" && isInBudgetPeriod(transaction.date, budgetCycle, budgetStartDay));
  const periodIncomes = transactions.filter((transaction) => transaction.type === "income" && isInBudgetPeriod(transaction.date, budgetCycle, budgetStartDay));
  const spentByCategory = periodExpenses.reduce<Record<string, number>>((acc, transaction) => {
    const category = displayCategory(transaction.category, "expense");
    acc[category] = (acc[category] ?? 0) + transaction.amount;
    return acc;
  }, {});
  const incomeByCategory = periodIncomes.reduce<Record<string, number>>((acc, transaction) => {
    const category = displayCategory(transaction.category, "income");
    acc[category] = (acc[category] ?? 0) + transaction.amount;
    return acc;
  }, {});
  const budgetLimit = budgetMode === "total" ? totalBudget : Object.values(expenseBudgets).reduce((sum, value) => sum + value, 0);
  const spentInPeriod = periodExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const incomeInPeriod = periodIncomes.reduce((sum, transaction) => sum + transaction.amount, 0);
  const remainingBudget = budgetLimit > 0 ? Math.max(0, budgetLimit - spentInPeriod) : 0;
  const topCategory = Object.entries(spentByCategory).sort((a, b) => b[1] - a[1])[0];
  const topIncomeCategory = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1])[0];
  const categoryRows = summaryCategoryRows(spentByCategory, expenseBudgets);
  const incomeRows = summaryIncomeRows(incomeByCategory);
  const donutPercent = spentInPeriod > 0 ? Math.max(8, Math.min(100, budgetLimit > 0 ? (spentInPeriod / budgetLimit) * 100 : 100)) : 0;
  const incomeDonutPercent = incomeInPeriod > 0 ? 100 : 0;
  const streakDays = periodExpenses.length > 0 ? 2 : 0;

  return (
    <div className="space-y-5">
      <SummaryProfileCard plan={plan} profile={profile} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">สรุป</h2>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-sm font-black shadow-sm">
          26 มิ.ย. - 30 มิ.ย. 2569
          <ChevronRight className="h-4 w-4 rotate-90 text-[#8a928e]" />
        </button>
      </div>

      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <p className="text-base font-bold text-[#151b18]">เหลือเก็บ</p>
            <span className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm font-black shadow-sm">รอบงบนี้ ⇄</span>
          </div>
          <p className={`mt-2 text-3xl font-black leading-none ${isPositive ? "text-[#10b95f]" : "text-[#DC143C]"}`}>{formatBaht(net)}</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <MetricBox active={summaryFocus === "expense"} label="รายจ่าย" onClick={() => setSummaryFocus("expense")} value={expense} tone="expense" />
          <MetricBox active={summaryFocus === "income"} label="รายรับ" onClick={() => setSummaryFocus("income")} value={income} tone="income" />
        </div>
        {showMore && (
          <SummaryExpandedChart
            budgetLimit={budgetLimit}
            categoryRows={summaryFocus === "expense" ? categoryRows : incomeRows}
            focus={summaryFocus}
            remainingBudget={remainingBudget}
            spentInPeriod={summaryFocus === "expense" ? spentInPeriod : incomeInPeriod}
            streakDays={streakDays}
            topCategory={summaryFocus === "expense" ? topCategory : topIncomeCategory}
            transactionCount={summaryFocus === "expense" ? periodExpenses.length : periodIncomes.length}
            usedPercent={summaryFocus === "expense" ? donutPercent : incomeDonutPercent}
          />
        )}
        <button type="button" onClick={() => setShowMore((value) => !value)} className="mx-auto mt-8 flex h-10 min-w-20 items-center justify-center gap-1 rounded-full border border-black/10 bg-white px-4 text-[0px] font-black text-transparent shadow-sm">
          <span className="text-sm text-[#DC143C]">{showMore ? "ย่อ" : "ดูเพิ่ม"}</span>
          ดูเพิ่ม
          <ChevronRight className={`h-4 w-4 text-[#DC143C] transition-transform ${showMore ? "-rotate-90" : "rotate-90"}`} />
        </button>
      </section>

      <SectionTitle title="รายการล่าสุด" actionHref="/liff/transactions" action="ดูทั้งหมด" />
      {latest.length > 0 ? <SummaryTransactionList transactions={latest} onEdit={onEdit} /> : <EmptyState title="ยังไม่มีข้อมูลรายการ" body="ลองพิมพ์ในแชท เช่น ข้าว 80 หรือ รับเงินลูกค้า 2500" />}
    </div>
  );
}

function InsightsScreen({ dashboard, transactions }: { dashboard: DashboardData | null; transactions: Transaction[] }) {
  const [chartMode, setChartMode] = useState<"monthly" | "daily">("monthly");
  const [insightMode, setInsightMode] = useState<"cashflow" | "savings">("cashflow");
  const [budgetMode] = useState<BudgetMode>(() => loadStoredBudgetMode());
  const [expenseBudgets] = useState<Record<string, number>>(() => loadStoredExpenseBudgets());
  const [totalBudget] = useState(() => loadStoredTotalBudget());
  const categories = dashboard?.charts.expense_by_category ?? [];
  const expenseBudgetLimit = budgetMode === "total" ? totalBudget : Object.values(expenseBudgets).reduce((sum, value) => sum + value, 0);
  const expenseComparison = useMemo(() => buildExpenseComparison(transactions), [transactions]);
  const savingsInsight = useMemo(() => buildSavingsInsight(transactions), [transactions]);

  return (
    <div className="space-y-4">
      <Segmented first="รายรับรายจ่าย" second="เก็บออม" active={insightMode === "cashflow" ? "first" : "second"} onFirst={() => setInsightMode("cashflow")} onSecond={() => setInsightMode("savings")} />
      {insightMode === "cashflow" ? (
        <>
          <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black leading-tight">ประวัติรายรับรายจ่าย</h2>
              <div className="grid grid-cols-2 rounded-md border border-black/10 bg-white p-1 shadow-sm">
                <button type="button" onClick={() => setChartMode("monthly")} className={`h-8 rounded px-3 text-sm font-black ${chartMode === "monthly" ? "bg-[#f4f7f5] text-[#151b18]" : "text-[#8a928e]"}`}>
                  รายเดือน
                </button>
                <button type="button" onClick={() => setChartMode("daily")} className={`h-8 rounded px-3 text-sm font-black ${chartMode === "daily" ? "bg-[#f4f7f5] text-[#151b18]" : "text-[#8a928e]"}`}>
                  รายวัน
                </button>
              </div>
            </div>
            <div className="mt-6 h-80">
              <IncomeExpenseHistoryChart key={chartMode} budgetLimit={expenseBudgetLimit} mode={chartMode} transactions={transactions} />
            </div>
          </section>
          <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#8a928e]">จุดที่ใช้เงินเยอะ</p>
                <h2 className="mt-1 text-xl font-black">รายจ่ายตามหมวด</h2>
              </div>
              {categories.length > 0 && <span className="rounded-md bg-[#f4f7f5] px-2 py-1 text-xs font-bold text-[#6b756f]">สะสม</span>}
            </div>
            {categories.length > 0 ? (
              <>
                <ExpenseCategoryDonut categories={categories} />
                <ExpenseComparePanel comparison={expenseComparison} />
              </>
            ) : (
              <div className="mt-4">
                <EmptyState title="ยังไม่มีรายจ่าย" body="เมื่อเริ่มจด ระบบจะแสดงหมวดที่ใช้เงินเยอะให้ทันที" />
              </div>
            )}
          </section>
        </>
      ) : (
        <SavingsInsightPanel insight={savingsInsight} />
      )}
    </div>
  );
}

function CategoriesScreen({ profile, transactions }: { profile: LineProfile; transactions: Transaction[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [storedExpenseCategories, setStoredExpenseCategories] = useState<string[]>(() => loadStoredExpenseCategories());
  const [storedIncomeCategories, setStoredIncomeCategories] = useState<string[]>(() => loadStoredIncomeCategories());
  const [showExpenseCategoryModal, setShowExpenseCategoryModal] = useState(false);
  const [showIncomeCategoryModal, setShowIncomeCategoryModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<string | null>(null);
  const [showBudgetCycleModal, setShowBudgetCycleModal] = useState(false);
  const [showTotalBudgetModal, setShowTotalBudgetModal] = useState(false);
  const [budgetMode, setBudgetMode] = useState<BudgetMode>(() => loadStoredBudgetMode());
  const [budgetCycle, setBudgetCycle] = useState<BudgetCycle>(() => loadStoredBudgetCycle());
  const [budgetStartDay, setBudgetStartDay] = useState(() => loadStoredBudgetStartDay());
  const [expenseBudgets, setExpenseBudgets] = useState<Record<string, number>>(() => loadStoredExpenseBudgets());
  const [totalBudget, setTotalBudget] = useState(() => loadStoredTotalBudget());
  const items = kind === "expense" ? storedExpenseCategories : storedIncomeCategories;
  const budgetCycleLabel = budgetCycle === "daily" ? "รายวัน" : budgetCycle === "weekly" ? "รายสัปดาห์" : "รายเดือน";
  const budgetStartDayLabel = budgetStartDay === 1 ? "วันที่ 1" : `วันที่ ${budgetStartDay}`;
  const budgetPeriodLabel = budgetCycle === "monthly" ? `${budgetCycleLabel} (${budgetStartDayLabel})` : budgetCycleLabel;
  const categoryBudgetTotal = Object.values(expenseBudgets).reduce((sum, value) => sum + value, 0);
  const displayedBudget = budgetMode === "total" ? totalBudget : categoryBudgetTotal;
  const expenseSpentByCategory = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "expense" && isInBudgetPeriod(transaction.date, budgetCycle, budgetStartDay))
      .reduce<Record<string, number>>((result, transaction) => {
        const category = displayCategory(transaction.category, "expense");
        result[category] = (result[category] ?? 0) + transaction.amount;
        return result;
      }, {});
  }, [transactions, budgetCycle, budgetStartDay]);
  const displayedSpent =
    budgetMode === "total"
      ? Object.values(expenseSpentByCategory).reduce((sum, value) => sum + value, 0)
      : storedExpenseCategories.reduce((sum, category) => sum + (expenseSpentByCategory[category] ?? 0), 0);
  const budgetUsagePercent = displayedBudget > 0 ? Math.min(100, Math.round((displayedSpent / displayedBudget) * 100)) : 0;

  useEffect(() => {
    if (!profile.line_user_id) return;
    void syncLineBudgetSettings({
      profile,
      expenseCategories: storedExpenseCategories,
      incomeCategories: storedIncomeCategories,
      budgetMode,
      budgetCycle,
      budgetStartDay,
      expenseBudgets,
      totalBudget,
    });
  }, [profile, storedExpenseCategories, storedIncomeCategories, budgetMode, budgetCycle, budgetStartDay, expenseBudgets, totalBudget]);

  function saveCategoryOrder(nextCategories: string[]) {
    if (kind === "income") {
      saveStoredIncomeCategories(nextCategories);
      setStoredIncomeCategories(nextCategories);
      void syncLineBudgetSettings({
        profile,
        expenseCategories: storedExpenseCategories,
        incomeCategories: nextCategories,
        budgetMode,
        budgetCycle,
        budgetStartDay,
        expenseBudgets,
        totalBudget,
      });
      return;
    }

    saveStoredExpenseCategories(nextCategories);
    setStoredExpenseCategories(nextCategories);
    void syncLineBudgetSettings({
      profile,
      expenseCategories: nextCategories,
      incomeCategories: storedIncomeCategories,
      budgetMode,
      budgetCycle,
      budgetStartDay,
      expenseBudgets,
      totalBudget,
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setKind("expense")} className={`h-12 rounded-md border text-base font-black ${kind === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#f5b6c3] bg-white text-[#DC143C]"}`}>
          รายจ่าย
        </button>
        <button type="button" onClick={() => setKind("income")} className={`h-12 rounded-md border text-base font-black ${kind === "income" ? "border-[#6dc5ad] bg-white text-[#6dc5ad]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
          รายรับ
        </button>
      </div>
      {kind === "expense" && (
        <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-[1fr_124px] gap-4">
            <button type="button" onClick={() => budgetMode === "total" && setShowTotalBudgetModal(true)} className="rounded-md text-left focus:outline-none focus:ring-2 focus:ring-[#DC143C]/30">
              <p className="text-sm font-black text-[#151b18]">งบที่ตั้งไว้</p>
              <p className={`mt-1 text-3xl font-black leading-none ${displayedBudget > 0 ? "text-[#DC143C]" : "text-[#9aa1a0]"}`}>{displayedBudget > 0 ? formatBaht(displayedBudget) : "ยังไม่ได้ตั้งงบ"}</p>
              <p className="mt-2 text-xs font-semibold text-[#8a928e]">ใช้ไป {formatBaht(displayedSpent)} · {budgetUsagePercent}%</p>
            </button>
            <div>
              <p className="text-sm font-black">ชนิดงบ</p>
              <select
                value={budgetMode}
                onChange={(event) => {
                  const value = event.target.value as BudgetMode;
                  setBudgetMode(value);
                  if (value === "total") setSelectedExpenseCategory(null);
                  saveStoredBudgetMode(value);
                  void syncLineBudgetSettings({
                    profile,
                    expenseCategories: storedExpenseCategories,
                    incomeCategories: storedIncomeCategories,
                    budgetMode: value,
                    expenseBudgets,
                    totalBudget,
                  });
                }}
                className="mt-2 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm font-bold shadow-sm outline-none focus:border-[#DC143C]"
              >
                <option value="category">แยกหมวด</option>
                <option value="total">รวม</option>
              </select>
            </div>
          </div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-[#edf0ef]">
            <div
              className={`h-full rounded-full ${budgetUsagePercent >= 80 ? "bg-[#DC143C]" : "bg-[#6dc5ad]"}`}
              style={{ width: displayedBudget > 0 ? `${Math.max(4, budgetUsagePercent)}%` : "0%" }}
            />
          </div>
          <div className="hidden">
            <button type="button" onClick={() => budgetMode === "total" && setShowTotalBudgetModal(true)} className="rounded-md text-left focus:outline-none focus:ring-2 focus:ring-[#DC143C]/30">
              <p className="text-base font-black">งบที่ตั้งไว้</p>
              <p className={`mt-2 text-xl font-black ${displayedBudget > 0 ? "text-[#151b18]" : "text-[#9aa1a0]"}`}>{displayedBudget > 0 ? formatBaht(displayedBudget) : "ยังไม่ได้ตั้งงบ"}</p>
              <p className="mt-1 text-xs font-semibold text-[#8a928e]">{budgetMode === "total" ? "กดเพื่อตั้งงบรวม" : "รวมจากงบแยกหมวด"}</p>
            </button>
            <div>
              <p className="text-base font-black">ชนิดงบ</p>
              <select
                value={budgetMode}
                onChange={(event) => {
                  const value = event.target.value as BudgetMode;
                  setBudgetMode(value);
                  if (value === "total") setSelectedExpenseCategory(null);
                  saveStoredBudgetMode(value);
                  void syncLineBudgetSettings({
                    profile,
                    expenseCategories: storedExpenseCategories,
                    incomeCategories: storedIncomeCategories,
                    budgetMode: value,
                    expenseBudgets,
                    totalBudget,
                  });
                }}
                className="mt-2 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm font-bold shadow-sm outline-none focus:border-[#DC143C]"
              >
                <option value="category">แยกหมวด</option>
                <option value="total">รวม</option>
              </select>
            </div>
          </div>
          <div className="hidden mt-5 rounded-md bg-[#eaf8f4] p-4 text-[#0d4a2b]">
            <p className="font-black">เงินสำรองฉุกเฉิน</p>
            <p className="mt-1 text-sm font-semibold">เริ่มจากตั้งงบเก็บเดือนละนิดก่อนก็ได้</p>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FCECEF] text-[#DC143C]">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black">รอบงบ</p>
                <p className="text-sm font-semibold text-[#8a928e]">{budgetPeriodLabel}</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowBudgetCycleModal(true)} className="rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-black shadow-sm">
              ตั้งค่า
            </button>
          </div>
        </section>
      )}
      <button type="button" onClick={() => setShowReorderModal(true)} className="inline-flex h-11 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-base font-black shadow-sm">
        <LayoutList className="h-5 w-5" /> จัดเรียง
      </button>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            aria-disabled={kind === "expense" && budgetMode === "total"}
            onClick={() => {
              if (kind === "income") {
                setSelectedIncomeCategory(item);
                return;
              }
              if (budgetMode === "total") return;
              setSelectedExpenseCategory(item);
            }}
            className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-black shadow-sm ${kind === "expense" && budgetMode === "total" ? "cursor-default" : ""}`}
          >
            {kind === "expense" ? (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-[#DC143C]" />
                  <span className="truncate">{item}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="font-semibold text-[#8a928e]">งบ</span>
                  <span className={expenseBudgets[item] > 0 ? "font-bold text-[#151b18]" : "font-semibold text-[#8a928e]"}>
                    {budgetMode === "total" ? "ใช้งบรวม" : expenseBudgets[item] > 0 ? formatBudgetAmount(expenseBudgets[item]) : "ไม่มีตั้งงบ"}
                  </span>
                  {budgetMode === "category" && <ChevronRight className="h-5 w-5 text-[#9aa1a0]" />}
                </span>
              </>
            ) : (
              <>
                <span className="truncate">{item}</span>
                <ChevronRight className="shrink-0 text-[#9aa1a0]" />
              </>
            )}
            <span className="hidden">
            {item}
            {kind === "expense" && budgetMode === "category" ? (
              <ChevronRight className="shrink-0 text-[#9aa1a0]" />
            ) : kind === "income" ? (
              <ChevronRight className="shrink-0 text-[#9aa1a0]" />
            ) : (
              <span className="text-xs font-semibold text-[#8a928e]">รวม</span>
            )}
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => (kind === "income" ? setShowIncomeCategoryModal(true) : setShowExpenseCategoryModal(true))} className="h-12 w-full rounded-md bg-[#6dc5ad] text-base font-black text-[#082f24]">
        + เพิ่มหมวด
      </button>
      {showExpenseCategoryModal && (
        <ExpenseCategoryCreateModal
          existingCategories={storedExpenseCategories}
          onClose={() => setShowExpenseCategoryModal(false)}
          onSave={(category) => {
            const nextCategories = [...storedExpenseCategories, category];
            saveStoredExpenseCategories(nextCategories);
            setStoredExpenseCategories(nextCategories);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: nextCategories,
              incomeCategories: storedIncomeCategories,
              budgetMode,
              expenseBudgets,
              totalBudget,
            });
            setShowExpenseCategoryModal(false);
            if (budgetMode === "category") setSelectedExpenseCategory(category);
          }}
        />
      )}
      {showIncomeCategoryModal && (
        <IncomeCategoryModal
          existingCategories={items}
          onClose={() => setShowIncomeCategoryModal(false)}
          onSave={(category) => {
            setStoredIncomeCategories((current) => {
              const next = [...current, category];
              saveStoredIncomeCategories(next);
              void syncLineBudgetSettings({
                profile,
                expenseCategories: storedExpenseCategories,
                incomeCategories: next,
                budgetMode,
                expenseBudgets,
                totalBudget,
              });
              return next;
            });
            setShowIncomeCategoryModal(false);
          }}
        />
      )}
      {selectedIncomeCategory && (
        <IncomeCategorySettingsModal
          category={selectedIncomeCategory}
          onClose={() => setSelectedIncomeCategory(null)}
          onDelete={() => {
            const nextCategories = storedIncomeCategories.filter((item) => item !== selectedIncomeCategory);
            saveStoredIncomeCategories(nextCategories);
            setStoredIncomeCategories(nextCategories);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: storedExpenseCategories,
              incomeCategories: nextCategories,
              budgetMode,
              expenseBudgets,
              totalBudget,
            });
            setSelectedIncomeCategory(null);
          }}
          onSave={(category) => {
            const previousCategory = selectedIncomeCategory;
            const nextCategories = storedIncomeCategories.map((item) => (item === previousCategory ? category : item));
            saveStoredIncomeCategories(nextCategories);
            setStoredIncomeCategories(nextCategories);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: storedExpenseCategories,
              incomeCategories: nextCategories,
              budgetMode,
              expenseBudgets,
              totalBudget,
            });
            setSelectedIncomeCategory(null);
          }}
        />
      )}
      {selectedExpenseCategory && (
        <ExpenseCategoryBudgetModal
          budget={expenseBudgets[selectedExpenseCategory] ?? 0}
          budgetCycleLabel={budgetPeriodLabel}
          category={selectedExpenseCategory}
          onClose={() => setSelectedExpenseCategory(null)}
          onDelete={() => {
            const nextCategories = storedExpenseCategories.filter((item) => item !== selectedExpenseCategory);
            const nextBudgets = { ...expenseBudgets };
            delete nextBudgets[selectedExpenseCategory];
            saveStoredExpenseCategories(nextCategories);
            saveStoredExpenseBudgets(nextBudgets);
            setStoredExpenseCategories(nextCategories);
            setExpenseBudgets(nextBudgets);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: nextCategories,
              incomeCategories: storedIncomeCategories,
              budgetMode,
              expenseBudgets: nextBudgets,
              totalBudget,
            });
            setSelectedExpenseCategory(null);
          }}
          onSave={(category, budget) => {
            const previousCategory = selectedExpenseCategory;
            const nextCategories = storedExpenseCategories.map((item) => (item === previousCategory ? category : item));
            const nextBudgets = { ...expenseBudgets };
            if (previousCategory !== category) {
              delete nextBudgets[previousCategory];
            }
            nextBudgets[category] = budget;
            saveStoredExpenseCategories(nextCategories);
            saveStoredExpenseBudgets(nextBudgets);
            setStoredExpenseCategories(nextCategories);
            setExpenseBudgets(nextBudgets);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: nextCategories,
              incomeCategories: storedIncomeCategories,
              budgetMode,
              expenseBudgets: nextBudgets,
              totalBudget,
            });
            setSelectedExpenseCategory(null);
          }}
        />
      )}
      {showTotalBudgetModal && (
        <TotalBudgetModal
          budget={totalBudget}
          budgetCycleLabel={budgetPeriodLabel}
          onClose={() => setShowTotalBudgetModal(false)}
          onSave={(budget) => {
            setTotalBudget(budget);
            saveStoredTotalBudget(budget);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: storedExpenseCategories,
              incomeCategories: storedIncomeCategories,
              budgetMode,
              expenseBudgets,
              totalBudget: budget,
            });
            setShowTotalBudgetModal(false);
          }}
        />
      )}
      {showBudgetCycleModal && (
        <BudgetCycleModal
          startDay={budgetStartDay}
          value={budgetCycle}
          onClose={() => setShowBudgetCycleModal(false)}
          onSave={(value, startDay) => {
            setBudgetCycle(value);
            setBudgetStartDay(startDay);
            saveStoredBudgetCycle(value);
            saveStoredBudgetStartDay(startDay);
            void syncLineBudgetSettings({
              profile,
              expenseCategories: storedExpenseCategories,
              incomeCategories: storedIncomeCategories,
              budgetMode,
              budgetCycle: value,
              budgetStartDay: startDay,
              expenseBudgets,
              totalBudget,
            });
            setShowBudgetCycleModal(false);
          }}
        />
      )}
      {showReorderModal && (
        <CategoryReorderModal
          categories={items}
          kind={kind}
          onClose={() => setShowReorderModal(false)}
          onSave={(nextCategories) => {
            saveCategoryOrder(nextCategories);
            setShowReorderModal(false);
          }}
        />
      )}
    </div>
  );
}

function CategoryReorderModal({
  categories,
  kind,
  onClose,
  onSave,
}: {
  categories: string[];
  kind: "expense" | "income";
  onClose: () => void;
  onSave: (categories: string[]) => void;
}) {
  const [draftCategories, setDraftCategories] = useState(categories);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const accent = kind === "expense" ? "#DC143C" : "#6dc5ad";
  const title = kind === "expense" ? "จัดเรียงหมวดรายจ่าย" : "จัดเรียงหมวดรายรับ";

  function moveCategory(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= draftCategories.length) return;
    setDraftCategories((current) => {
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setDraggingIndex(toIndex);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();
    if (draggingIndex === null) return;
    moveCategory(draggingIndex, targetIndex);
    setDraggingIndex(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="px-5 pb-4 pt-4">
          <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-[#eef1ef]" />
          <div className="flex items-center justify-end">
            <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#151b18]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-center text-2xl font-black" style={{ color: accent }}>{title}</h2>
          <p className="mt-4 text-center text-sm font-semibold text-[#8a928e]">ลากไอคอนเพื่อจัดเรียงหมวดตามความต้องการ</p>
        </div>

        <div className="max-h-[56vh] space-y-2 overflow-y-auto px-5 pb-4">
          {draftCategories.map((category, index) => (
            <div
              key={category}
              draggable
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={() => setDraggingIndex(null)}
              className={`flex min-h-14 items-center gap-3 rounded-md border bg-white px-3 shadow-sm transition ${draggingIndex === index ? "border-[#9aa1a0] opacity-60" : "border-black/10"}`}
            >
              <button
                type="button"
                aria-label={`ลากเพื่อย้าย ${category}`}
                className="grid h-9 w-8 shrink-0 place-items-center rounded-md text-[#64748b] active:bg-[#f3f5f4]"
              >
                <GripVertical className="h-5 w-5" />
              </button>
              {kind === "expense" && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: accent }} />}
              <span className="min-w-0 flex-1 truncate text-base font-black text-[#151b18]">{category}</span>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => moveCategory(index, index - 1)}
                  disabled={index === 0}
                  className="h-8 rounded-md border border-black/10 px-2 text-xs font-black text-[#5f6f69] disabled:opacity-30"
                >
                  ขึ้น
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(index, index + 1)}
                  disabled={index === draftCategories.length - 1}
                  className="h-8 rounded-md border border-black/10 px-2 text-xs font-black text-[#5f6f69] disabled:opacity-30"
                >
                  ลง
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-black/5 bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => onSave(draftCategories)}
            className="h-12 w-full rounded-md text-base font-black text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

function IncomeCategoryModal({
  existingCategories,
  onClose,
  onSave,
}: {
  existingCategories: string[];
  onClose: () => void;
  onSave: (category: string) => void;
}) {
  const suggestions = ["เงินเดือน", "โบนัส", "ค่าคอม", "ลงทุน", "ธุรกิจ", "ฟรีแลนซ์", "ของขวัญ", "อื่นๆ"];
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function save() {
    const value = name.trim();
    if (!value) {
      setError("กรอกชื่อหมวดรายรับก่อนบันทึก");
      return;
    }
    if (existingCategories.includes(value)) {
      setError("มีหมวดนี้อยู่แล้ว");
      return;
    }
    onSave(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-[#eef1ef]" />
        <div className="flex items-center justify-end">
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#151b18]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 className="text-center text-2xl font-black">เพิ่มหมวดรายรับ</h2>

        <div className="mt-8">
          <label className="block">
            <span className="text-sm font-black">ตั้งชื่อหมวดรายรับ</span>
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} className="mt-2 h-12 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
          </label>
          <p className="mt-2 text-xs font-semibold text-[#8a928e]">พิมพ์ชื่อหมวด หรือ เลือกจากตัวเลือกด้านล่าง</p>
        </div>

        <div className="mt-7 text-center">
          <p className="text-lg font-black">ชื่อหมวดยอดฮิต</p>
          <p className="mt-2 text-sm font-semibold text-[#8a928e]">หากนึกไม่ออกลองเลือกจากชื่อหมวดข้างล่างนี้ดูสิ</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => { setName(suggestion); setError(""); }} className="h-12 rounded-md border border-black/10 bg-white text-sm font-bold shadow-sm active:bg-[#eef8f5]">
              {suggestion}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

        <button type="button" onClick={save} className="mt-6 h-12 w-full rounded-md bg-[#6dc5ad] text-base font-black text-[#082f24]">
          บันทึก
        </button>
      </div>
    </div>
  );
}

function ExpenseCategoryCreateModal({
  existingCategories,
  onClose,
  onSave,
}: {
  existingCategories: string[];
  onClose: () => void;
  onSave: (category: string) => void;
}) {
  const suggestions = ["อาหาร", "กาแฟ", "เดินทาง", "ช้อปปิ้ง", "ผ่อนรถ", "Subscriptions", "ผ่อนบ้าน", "อินเตอร์เน็ต"];
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function save() {
    const value = name.trim();
    if (!value) {
      setError("กรอกชื่อหมวดรายจ่ายก่อน");
      return;
    }
    if (existingCategories.includes(value)) {
      setError("มีหมวดนี้อยู่แล้ว");
      return;
    }
    onSave(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="flex items-center justify-end">
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#151b18]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 className="mt-4 text-center text-2xl font-black">เพิ่มหมวดรายจ่าย</h2>

        <div className="mt-7">
          <label className="block">
            <span className="text-sm font-black">ตั้งชื่อหมวดรายจ่าย</span>
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} className="mt-2 h-12 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#DC143C]" />
          </label>
          <p className="mt-2 text-xs font-semibold text-[#8a928e]">พิมพ์ชื่อหมวด หรือ เลือกจากตัวเลือกด้านล่าง</p>
        </div>

        <div className="mt-7 text-center">
          <p className="text-lg font-black">ชื่อหมวดยอดฮิต</p>
          <p className="mt-2 text-sm font-semibold text-[#8a928e]">หากนึกไม่ออกลองเลือกจากชื่อหมวดข้างล่างนี้ดูสิ</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => { setName(suggestion); setError(""); }} className="h-12 rounded-md border border-black/10 bg-white text-sm font-bold shadow-sm active:bg-[#FCECEF]">
              {suggestion}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

        <button type="button" onClick={save} className="mt-6 h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white">
          ต่อไป
        </button>
      </div>
    </div>
  );
}

function IncomeCategorySettingsModal({
  category,
  onClose,
  onDelete,
  onSave,
}: {
  category: string;
  onClose: () => void;
  onDelete: () => void;
  onSave: (category: string) => void;
}) {
  const [name, setName] = useState(category);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function save() {
    const value = name.trim();
    if (!value) {
      setError("กรอกชื่อหมวดก่อนบันทึก");
      return;
    }
    onSave(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-[#eef1ef]" />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-black text-[#8a928e] shadow-sm">
            <Trash2 className="h-4 w-4" /> ลบหมวด
          </button>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#6b7280]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-6 text-center text-2xl font-black">ตั้งค่าหมวดและงบ</h2>

        <div className="mt-8">
          <label className="block">
            <span className="text-sm font-black">ชื่อหมวด</span>
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} className="mt-2 h-12 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
            <span className="mt-2 block text-xs font-semibold text-[#8a928e]">พิมพ์ชื่อหมวดเพื่อแก้ไข</span>
          </label>
        </div>

        {error && <p className="mt-4 rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

        <button type="button" onClick={save} className="mt-8 h-12 w-full rounded-md bg-[#6dc5ad] text-base font-black text-[#082f24]">
          บันทึก
        </button>
      </div>
      {confirmingDelete && (
        <ConfirmDeleteDialog
          title="ยืนยันการลบหมวด"
          body="คุณต้องการลบหมวดนี้ใช่หรือไม่?"
          confirmLabel="ลบหมวด"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}

function ExpenseCategoryBudgetModal({
  budget,
  budgetCycleLabel,
  category,
  onClose,
  onDelete,
  onSave,
}: {
  budget: number;
  budgetCycleLabel: string;
  category: string;
  onClose: () => void;
  onDelete: () => void;
  onSave: (category: string, budget: number) => void;
}) {
  const [name, setName] = useState(category);
  const [amount, setAmount] = useState(budget > 0 ? String(budget) : "");
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function save() {
    const value = name.trim();
    if (!value) {
      setError("กรอกชื่อหมวดก่อนบันทึก");
      return;
    }
    onSave(value, Number(amount) || 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-[#eef1ef]" />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-black text-[#8a928e] shadow-sm">
            <Trash2 className="h-4 w-4" /> ลบหมวด
          </button>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#6b7280]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-6 text-center text-2xl font-black">ตั้งค่าหมวดและงบ</h2>

        <div className="mt-8 space-y-6">
          <label className="block">
            <span className="text-sm font-black">ชื่อหมวด</span>
            <input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} className="mt-2 h-12 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#DC143C]" />
            <span className="mt-2 block text-xs font-semibold text-[#8a928e]">พิมพ์ชื่อหมวดเพื่อแก้ไข</span>
          </label>

          <label className="block">
            <span className="inline-flex items-center gap-2 text-sm font-black">
              งบรายจ่าย
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8a928e]">
                <CalendarDays className="h-3.5 w-3.5" /> {budgetCycleLabel}
              </span>
            </span>
            <div className="mt-2 flex h-12 items-center rounded-md border border-black/10 px-3 shadow-sm focus-within:border-[#DC143C]">
              <span className="font-bold text-[#8a928e]">฿</span>
              <input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} className="min-w-0 flex-1 border-0 px-2 text-base outline-none" />
            </div>
            <span className="mt-2 block text-xs font-semibold text-[#8a928e]">ใส่จำนวนงบเพื่อตั้งงบประมาณ หรือปล่อยว่างไว้ถ้าไม่ต้องการตั้งงบ</span>
          </label>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm font-semibold text-[#8a928e]">รายจ่ายหมวดนี้ย้อนหลัง 6 เดือน</p>
          <p className="mt-8 text-sm font-semibold text-[#9aa1a0]">ยังไม่มีข้อมูลรายการย้อนหลัง</p>
        </div>

        {error && <p className="mt-4 rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

        <button type="button" onClick={save} className="mt-8 h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white">
          บันทึก
        </button>
      </div>
      {confirmingDelete && (
        <ConfirmDeleteDialog
          title="ยืนยันการลบหมวด"
          body="คุณต้องการลบหมวดนี้ใช่หรือไม่?"
          confirmLabel="ลบหมวด"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}

function TotalBudgetModal({
  budget,
  budgetCycleLabel,
  onClose,
  onSave,
}: {
  budget: number;
  budgetCycleLabel: string;
  onClose: () => void;
  onSave: (budget: number) => void;
}) {
  const [amount, setAmount] = useState(budget > 0 ? String(budget) : "");
  const [error, setError] = useState("");

  function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("ใส่งบรวมก่อนบันทึก");
      return;
    }
    onSave(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-[#eef1ef]" />
        <div className="flex items-center justify-end">
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#6b7280]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="text-center text-2xl font-black">ตั้งงบรวม</h2>

        <label className="mt-8 block">
          <span className="inline-flex items-center gap-2 text-sm font-black">
            งบรายจ่ายทั้งหมด
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8a928e]">
              <CalendarDays className="h-3.5 w-3.5" /> {budgetCycleLabel}
            </span>
          </span>
          <div className="mt-2 flex h-12 items-center rounded-md border border-black/10 px-3 shadow-sm focus-within:border-[#DC143C]">
            <span className="font-bold text-[#8a928e]">฿</span>
            <input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} className="min-w-0 flex-1 border-0 px-2 text-base outline-none" />
          </div>
          <span className="mt-2 block text-xs font-semibold text-[#8a928e]">งบรวมใช้คุมรายจ่ายทั้งหมด ไม่แยกตามหมวด</span>
        </label>

        {error && <p className="mt-4 rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

        <button type="button" onClick={save} className="mt-8 h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white">
          บันทึก
        </button>
      </div>
    </div>
  );
}

function BudgetCycleModal({
  onClose,
  onSave,
  startDay,
  value,
}: {
  onClose: () => void;
  onSave: (value: "daily" | "weekly" | "monthly", startDay: number) => void;
  startDay: number;
  value: "daily" | "weekly" | "monthly";
}) {
  const [draft, setDraft] = useState(value);
  const [draftStartDay, setDraftStartDay] = useState(startDay);
  const options: { label: string; value: "daily" | "weekly" | "monthly" }[] = [
    { label: "รายวัน", value: "daily" },
    { label: "รายสัปดาห์", value: "weekly" },
    { label: "รายเดือน", value: "monthly" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white px-5 pb-6 pt-4 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-[#eef1ef]" />
        <div className="flex items-center justify-end">
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-full text-[#6b7280]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="text-center text-2xl font-black">รอบงบ</h2>

        <div className="mt-7 space-y-3">
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => setDraft(option.value)} className={`flex h-12 w-full items-center justify-between rounded-md border px-4 text-left text-base font-bold ${draft === option.value ? "border-[#DC143C] bg-[#fff3f5]" : "border-black/10 bg-white"}`}>
              {option.label}
              {draft === option.value && <span className="text-[#151b18]">✓</span>}
            </button>
          ))}
        </div>

        {draft === "monthly" && <div className="mt-7">
          <p className="text-sm font-black">วันที่เริ่มต้นงบประมาณ</p>
          <select
            value={draftStartDay}
            onChange={(event) => setDraftStartDay(Number(event.target.value))}
            className="mt-3 h-11 w-full rounded-md border border-black/10 bg-white px-4 text-sm font-bold text-[#555f5b] shadow-sm outline-none focus:border-[#DC143C]"
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>{day === 1 ? "วันแรกของเดือน" : day}</option>
            ))}
          </select>
        </div>}

        <button type="button" onClick={() => onSave(draft, draft === "monthly" ? draftStartDay : 1)} className="mt-14 h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white">
          บันทึก
        </button>
      </div>
    </div>
  );
}

function TransactionsScreen({
  lineUserId,
  transactions,
  onCreate,
  onEdit,
  onTransactionsChanged,
}: {
  lineUserId: string;
  transactions: Transaction[];
  onCreate: () => void;
  onEdit: (transaction: Transaction) => void;
  onTransactionsChanged: (transactions: Transaction[]) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [categoryFilter, setCategoryFilter] = useState("ทั้งหมด");
  const [startDate, setStartDate] = useState(() => monthStartInputValue());
  const [endDate, setEndDate] = useState(() => todayInputValue());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<"category" | "date" | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [showRecurringScreen, setShowRecurringScreen] = useState(false);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>(() => loadStoredRecurringItems(lineUserId));
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringError, setRecurringError] = useState("");
  const typeButtons: { value: "all" | "expense" | "income"; label: string }[] = [
    { value: "all", label: "ทั้งหมด" },
    { value: "expense", label: "รายจ่าย" },
    { value: "income", label: "รายรับ" },
  ];
  const categoryOptions = useMemo(() => {
    const base =
      typeFilter === "income"
        ? loadStoredIncomeCategories()
        : typeFilter === "expense"
          ? loadStoredExpenseCategories()
          : [...loadStoredExpenseCategories(), ...loadStoredIncomeCategories()];
    const used = transactions
      .filter((transaction) => typeFilter === "all" || transaction.type === typeFilter)
      .filter((transaction) => isWithinDateRange(transaction.date, startDate, endDate))
      .map((transaction) => displayCategory(transaction.category, transaction.type));
    return ["ทั้งหมด", ...Array.from(new Set([...base, ...used]))];
  }, [transactions, typeFilter, startDate, endDate]);
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
      if (!isWithinDateRange(transaction.date, startDate, endDate)) return false;
      if (categoryFilter !== "ทั้งหมด" && displayCategory(transaction.category, transaction.type) !== categoryFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, startDate, endDate]);
  const filteredTotal = filteredTransactions.reduce(
    (sum, transaction) => sum + (transaction.type === "income" ? transaction.amount : -transaction.amount),
    0,
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedTransactions = useMemo(
    () => filteredTransactions.filter((transaction) => selectedIdSet.has(transaction.id)),
    [filteredTransactions, selectedIdSet],
  );
  const allVisibleSelected = filteredTransactions.length > 0 && filteredTransactions.every((transaction) => selectedIdSet.has(transaction.id));

  const persistRecurringItems = useCallback((nextItems: RecurringItem[]) => {
    setRecurringItems(nextItems);
    saveStoredRecurringItems(lineUserId, nextItems);
  }, [lineUserId]);

  const syncLocalRecurringItems = useCallback(async (localItems: RecurringItem[]) => {
    if (!lineUserId) return;
    setRecurringSaving(true);
    setRecurringError("");
    try {
      const created = await Promise.all(
        localItems.map((item) => createRecurringTransaction(itemToApiRecurringInput(item), lineUserId).then(apiRecurringToItem)),
      );
      persistRecurringItems(created);
    } catch {
      setRecurringError("ซิงก์รายการจดประจำไม่สำเร็จ");
    } finally {
      setRecurringSaving(false);
    }
  }, [lineUserId, persistRecurringItems]);

  useEffect(() => {
    if (!lineUserId) return;
    let mounted = true;
    const localItems = loadStoredRecurringItems(lineUserId);
    getRecurringTransactions(lineUserId)
      .then((items) => {
        if (!mounted) return;
        const mapped = items.map(apiRecurringToItem);
        if (mapped.length === 0 && localItems.length > 0) {
          void syncLocalRecurringItems(localItems);
          return;
        }
        setRecurringItems(mapped);
        saveStoredRecurringItems(lineUserId, mapped);
      })
      .catch(() => {
        if (mounted) setRecurringError("โหลดรายการจดประจำไม่สำเร็จ");
      });
    return () => {
      mounted = false;
    };
  }, [lineUserId, syncLocalRecurringItems]);

  async function createRecurringItem(item: RecurringItem) {
    if (!lineUserId) return;
    setRecurringSaving(true);
    setRecurringError("");
    try {
      const created = await createRecurringTransaction(itemToApiRecurringInput(item), lineUserId);
      persistRecurringItems([apiRecurringToItem(created), ...recurringItems]);
    } catch {
      setRecurringError("บันทึกรายการจดประจำไม่สำเร็จ");
    } finally {
      setRecurringSaving(false);
    }
  }

  async function updateRecurringItem(item: RecurringItem) {
    if (!lineUserId) return;
    setRecurringSaving(true);
    setRecurringError("");
    try {
      const updated = typeof item.id === "number"
        ? await updateRecurringTransaction(item.id, itemToApiRecurringInput(item), lineUserId)
        : await createRecurringTransaction(itemToApiRecurringInput(item), lineUserId);
      persistRecurringItems(recurringItems.map((current) => (current.id === item.id ? apiRecurringToItem(updated) : current)));
    } catch {
      try {
        const created = await createRecurringTransaction(itemToApiRecurringInput(item), lineUserId);
        persistRecurringItems(recurringItems.map((current) => (current.id === item.id ? apiRecurringToItem(created) : current)));
      } catch {
        setRecurringError("แก้ไขรายการจดประจำไม่สำเร็จ");
      }
    } finally {
      setRecurringSaving(false);
    }
  }

  async function removeRecurringItem(item: RecurringItem) {
    if (!lineUserId || typeof item.id !== "number") {
      persistRecurringItems(recurringItems.filter((current) => current.id !== item.id));
      return;
    }
    setRecurringSaving(true);
    setRecurringError("");
    try {
      await deleteRecurringTransaction(item.id, lineUserId);
      persistRecurringItems(recurringItems.filter((current) => current.id !== item.id));
    } catch {
      setRecurringError("ลบรายการจดประจำไม่สำเร็จ");
    } finally {
      setRecurringSaving(false);
    }
  }

  async function updateRecurringItems(nextItems: RecurringItem[]) {
    if (!lineUserId) return;
    setRecurringSaving(true);
    setRecurringError("");
    try {
      const updated = await Promise.all(
        nextItems.map((item) =>
          typeof item.id === "number"
            ? updateRecurringTransaction(item.id, itemToApiRecurringInput(item), lineUserId)
                .catch(() => createRecurringTransaction(itemToApiRecurringInput(item), lineUserId))
                .then(apiRecurringToItem)
            : createRecurringTransaction(itemToApiRecurringInput(item), lineUserId).then(apiRecurringToItem),
        ),
      );
      persistRecurringItems(updated);
    } catch {
      setRecurringError("อัปเดตรายการจดประจำไม่สำเร็จ");
    } finally {
      setRecurringSaving(false);
    }
  }

  function selectType(value: "all" | "expense" | "income") {
    setTypeFilter(value);
    setCategoryFilter("ทั้งหมด");
  }

  function enterMultiSelectMode() {
    setMultiSelectMode(true);
    setSelectedIds([]);
    setBulkError("");
  }

  function exitMultiSelectMode() {
    setMultiSelectMode(false);
    setSelectedIds([]);
    setBulkAction(null);
    setConfirmBulkDelete(false);
    setBulkError("");
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredTransactions.map((transaction) => transaction.id));
  }

  async function saveBulkCategory(nextType: "expense" | "income", nextCategory: string) {
    if (selectedTransactions.length === 0) return;
    setBulkSaving(true);
    setBulkError("");
    try {
      const updated = await Promise.all(
        selectedTransactions.map((transaction) =>
          updateTransaction(
            transaction.id,
            {
              date: transaction.date,
              type: nextType,
              amount: transaction.amount,
              category: nextCategory,
              description: transaction.description,
              mode: transaction.mode,
            },
            lineUserId || undefined,
          ),
        ),
      );
      const updatedById = new Map(updated.map((transaction) => [transaction.id, transaction]));
      onTransactionsChanged(transactions.map((transaction) => updatedById.get(transaction.id) ?? transaction));
      exitMultiSelectMode();
    } catch {
      setBulkError("แก้ไขหมวดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBulkSaving(false);
    }
  }

  async function saveBulkDate(nextDate: string) {
    if (selectedTransactions.length === 0) return;
    setBulkSaving(true);
    setBulkError("");
    try {
      const updated = await Promise.all(
        selectedTransactions.map((transaction) =>
          updateTransaction(
            transaction.id,
            {
              date: nextDate,
              type: transaction.type,
              amount: transaction.amount,
              category: transaction.category,
              description: transaction.description,
              mode: transaction.mode,
            },
            lineUserId || undefined,
          ),
        ),
      );
      const updatedById = new Map(updated.map((transaction) => [transaction.id, transaction]));
      onTransactionsChanged(transactions.map((transaction) => updatedById.get(transaction.id) ?? transaction));
      exitMultiSelectMode();
    } catch {
      setBulkError("แก้ไขวันที่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBulkSaving(false);
    }
  }

  async function deleteBulkTransactions() {
    if (selectedTransactions.length === 0) return;
    setBulkSaving(true);
    setBulkError("");
    try {
      await Promise.all(selectedTransactions.map((transaction) => deleteTransaction(transaction.id, lineUserId || undefined)));
      const deletingIds = new Set(selectedTransactions.map((transaction) => transaction.id));
      onTransactionsChanged(transactions.filter((transaction) => !deletingIds.has(transaction.id)));
      exitMultiSelectMode();
    } catch {
      setBulkError("ลบรายการไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBulkSaving(false);
    }
  }

  if (showRecurringScreen) {
    return (
      <RecurringTransactionsScreen
        items={recurringItems}
        onBack={() => setShowRecurringScreen(false)}
        error={recurringError}
        saving={recurringSaving}
        onCreate={(item) => void createRecurringItem(item)}
        onDelete={(item) => void removeRecurringItem(item)}
        onUpdate={(item) => void updateRecurringItem(item)}
        onUpdateMany={(items) => void updateRecurringItems(items)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {multiSelectMode && (
        <BulkSelectHeader
          allVisibleSelected={allVisibleSelected}
          selectedCount={selectedIds.length}
          onClose={exitMultiSelectMode}
          onToggleAll={toggleAllVisible}
        />
      )}
      {bulkError && <p className="rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{bulkError}</p>}
      {!multiSelectMode && (
        <>
      <section className="rounded-md border border-black/10 bg-white p-3 shadow-sm">
        <button type="button" onClick={() => setShowDatePicker(true)} className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-black/10 bg-white px-3 text-sm font-black text-[#151b18] shadow-sm">
            <span>{formatThaiDateRange(startDate, endDate)}</span>
            <CalendarDays className="h-5 w-5 text-[#6b756f]" />
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">คัดกรองประเภทรายการ</p>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {typeButtons.map((item) => {
                const isActive = typeFilter === item.value;
                const activeClass = item.value === "income" ? "bg-[#6dc5ad] text-[#082f24]" : "bg-[#DC143C] text-white";
                return (
                  <button key={item.value} type="button" onClick={() => selectType(item.value)} className={"h-8 shrink-0 rounded-md px-4 text-xs font-black " + (isActive ? activeClass : "bg-[#f0f2f1] text-[#555f5b]")}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" aria-label="ส่งออก" className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-[#0d4a2b] shadow-sm">
            <Download className="h-5 w-5" />
            <span className="-mt-2 text-[10px] font-black">ส่งออก</span>
          </button>
        </div>
      </section>
      {typeFilter !== "all" && (
        <section className="rounded-md border border-black/10 bg-white p-3 shadow-sm">
          <p className="text-sm font-black">หมวด</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categoryOptions.map((category) => {
              const isActive = categoryFilter === category;
              const activeClass = typeFilter === "income" ? "bg-[#6dc5ad] text-[#082f24]" : "bg-[#DC143C] text-white";
              return (
                <button key={category} type="button" onClick={() => setCategoryFilter(category)} className={"h-8 rounded-md px-3 text-xs font-black " + (isActive ? activeClass : "bg-[#f0f2f1] text-[#555f5b]")}>
                  {category}
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={enterMultiSelectMode} className="h-9 rounded-md border border-black/10 bg-white px-3 text-sm font-black text-[#8a928e] shadow-sm">
          เลือกหลายรายการ
        </button>
        <button type="button" onClick={() => setShowRecurringScreen(true)} className="h-9 rounded-md border border-black/10 bg-white px-3 text-sm font-black text-[#8a928e] shadow-sm">
          ตั้งรายการจดประจำ
        </button>
      </div>
        </>
      )}
      <div className="flex items-end justify-between border-b border-[#9aa1a0] pb-2">
        <p className="text-xs font-semibold text-[#8a928e]">{formatThaiShortDate(startDate)} - {formatThaiShortDate(endDate)}</p>
        <p className={"text-xs font-black " + (filteredTotal >= 0 ? "text-[#10b95f]" : "text-[#DC143C]")}>รวม: {filteredTotal >= 0 ? "+" : "-"}{formatBaht(Math.abs(filteredTotal))}</p>
      </div>
      {filteredTransactions.length > 0 ? (
        multiSelectMode ? (
          <BulkTransactionList selectedIds={selectedIdSet} transactions={filteredTransactions} onToggle={toggleSelected} />
        ) : (
          <TransactionList transactions={filteredTransactions} onEdit={onEdit} />
        )
      ) : (
        <EmptyState title="ไม่มีข้อมูลรายการ" body="ลองเปลี่ยนวันที่ ประเภท หรือหมวดเพื่อดูรายการอื่น" />
      )}
      {!multiSelectMode && (
      <button type="button" onClick={onCreate} aria-label="เพิ่มรายการ" className="fixed bottom-24 right-[calc(50%-11.5rem)] grid h-14 w-14 place-items-center rounded-full bg-[#DC143C] text-3xl font-light text-white shadow-xl">
        +
      </button>
      )}
      {multiSelectMode && selectedIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          saving={bulkSaving}
          onEditCategory={() => setBulkAction("category")}
          onEditDate={() => setBulkAction("date")}
          onDelete={() => setConfirmBulkDelete(true)}
        />
      )}
      {bulkAction === "category" && (
        <BulkCategoryModal
          count={selectedIds.length}
          saving={bulkSaving}
          transactions={selectedTransactions}
          onClose={() => setBulkAction(null)}
          onSave={(nextType, nextCategory) => void saveBulkCategory(nextType, nextCategory)}
        />
      )}
      {bulkAction === "date" && (
        <BulkDateModal
          count={selectedIds.length}
          initialDate={selectedTransactions[0]?.date ?? todayInputValue()}
          saving={bulkSaving}
          onClose={() => setBulkAction(null)}
          onSave={(nextDate) => void saveBulkDate(nextDate)}
        />
      )}
      {confirmBulkDelete && (
        <ConfirmDeleteDialog
          title="ยืนยันการลบรายการ"
          body={`คุณต้องการลบ ${selectedIds.length} รายการนี้หรือไม่?`}
          confirmLabel={`ลบ (${selectedIds.length})`}
          confirming={bulkSaving}
          onCancel={() => setConfirmBulkDelete(false)}
          onConfirm={() => void deleteBulkTransactions()}
        />
      )}
      {showDatePicker && (
        <DateRangePickerModal
          endDate={endDate}
          onClose={() => setShowDatePicker(false)}
          onSave={(nextStartDate, nextEndDate) => {
            setStartDate(nextStartDate);
            setEndDate(nextEndDate);
            setShowDatePicker(false);
          }}
          startDate={startDate}
        />
      )}
    </div>
  );
}

function RecurringTransactionsScreen({
  error,
  items,
  onBack,
  onCreate,
  onDelete,
  onUpdate,
  onUpdateMany,
  saving,
}: {
  error: string;
  items: RecurringItem[];
  onBack: () => void;
  onCreate: (item: RecurringItem) => void;
  onDelete: (item: RecurringItem) => void;
  onUpdate: (item: RecurringItem) => void;
  onUpdateMany: (items: RecurringItem[]) => void;
  saving: boolean;
}) {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<string | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<RecurringItem | null>(null);
  const [previewDateValue, setPreviewDateValue] = useState<string | null>(null);
  const [notifyTime, setNotifyTime] = useState(() => items[0]?.notifyTime ?? "10:00");
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const monthlyExpense = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const monthlyIncome = items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const calendarDays = calendarGridDays(viewMonth);
  const previewDay = previewDateValue
    ? calendarDays.find((day) => inputDateValue(day.date) === previewDateValue)
    : null;
  const previewItems = previewDay ? items.filter((item) => recurringItemOccursOn(item, previewDay.date)) : [];

  function addItem(item: RecurringItem) {
    onCreate(item);
    setNotifyTime(item.notifyTime);
    setShowCreateModal(false);
    setCreateInitialDate(undefined);
  }

  function editItem(item: RecurringItem) {
    onUpdate(item);
    setNotifyTime(item.notifyTime);
    setEditingItem(null);
  }

  function removeItem(item: RecurringItem) {
    onDelete(item);
    setPendingDeleteItem(null);
  }

  function openCreateModal(date?: string) {
    setCreateInitialDate(date);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setCreateInitialDate(undefined);
    setShowCreateModal(false);
  }

  function changeNotifyTime(nextTime: string) {
    setNotifyTime(nextTime);
    if (items.length > 0) {
      onUpdateMany(items.map((item) => ({ ...item, notifyTime: nextTime })));
    }
  }

  const isCurrentMonthView = viewMonth.getFullYear() === new Date().getFullYear() && viewMonth.getMonth() === new Date().getMonth();

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onBack} aria-label="กลับหน้ารายการ" className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-black/10 bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-black text-[#1f2a44]">รายการจดประจำ</h1>
          <p className="mt-1 text-sm font-black leading-snug text-[#151b18]">ตั้งรายการที่จะเกิดขึ้นเป็นประจำ<br />ให้ระบบจดให้อัตโนมัติเมื่อถึงวัน</p>
        </div>
        <span className="h-9 w-9 shrink-0" />
      </div>
      {error && <p className="rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

      <section className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 rounded-md border border-black/10 bg-white p-3 shadow-sm">
        <RecurringStat label="รายจ่ายเฉลี่ยต่อเดือน" amount={monthlyExpense} count={items.filter((item) => item.type === "expense").length} tone="expense" />
        <RecurringStat label="รายรับเฉลี่ยต่อเดือน" amount={monthlyIncome} count={items.filter((item) => item.type === "income").length} tone="income" />
        <div className="text-right">
          <button type="button" onClick={() => openCreateModal()} className="h-11 rounded-md bg-[#DC143C] px-4 text-sm font-black text-white shadow-sm">
            เพิ่มรายการ
          </button>
          <p className="mt-2 text-xs font-semibold text-[#8a928e]">เหลืออีก {Math.max(0, 20 - items.length)} รายการ</p>
        </div>
      </section>

      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-[#1f2a44]">เวลาจด</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#4b5563]">เมื่อถึงเวลาที่ตั้ง ระบบจะจดรายการที่ถูกกำหนดไว้สำหรับวันนั้นและส่งข้อความให้ในแชท</p>
          </div>
          <RecurringTimePicker value={notifyTime} onChange={changeNotifyTime} compact />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-[#151b18]">{viewMode === "calendar" ? "กดวันที่บนปฏิทินเพื่อดูรายการที่กำหนดไว้" : items.length > 0 ? "รายการจดประจำทั้งหมด" : ""}</p>
        <button type="button" onClick={() => setViewMode(viewMode === "calendar" ? "list" : "calendar")} className="h-9 rounded-md border border-black/10 bg-white px-3 text-sm font-black text-[#1f2a44] shadow-sm">
          ดูเป็น{viewMode === "calendar" ? " List" : "ปฏิทิน"} ↩
        </button>
      </div>

      {viewMode === "calendar" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="เดือนก่อนหน้า" className="grid h-9 w-9 place-items-center rounded-md">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-base font-black text-[#1f2a44]">{viewMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
              {!isCurrentMonthView && (
                <button type="button" onClick={() => setViewMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="mt-1 text-xs font-black text-[#DC143C]">
                  กลับเดือนปัจจุบัน
                </button>
              )}
            </div>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="เดือนถัดไป" className="grid h-9 w-9 place-items-center rounded-md">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-[#64748b]">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dateValue = inputDateValue(day.date);
              const dayItems = items.filter((item) => recurringItemOccursOn(item, day.date));
              const isCurrentMonth = day.date.getMonth() === viewMonth.getMonth();
              const isToday = dateValue === todayInputValue();
              return (
                <button
                  key={dateValue}
                  type="button"
                  onClick={() => setPreviewDateValue(dateValue)}
                  title={dayItems.length > 0 ? dayItems.map((item) => `${item.description} ${formatBaht(item.amount)}`).join(", ") : "ไม่มีรายการจดประจำ"}
                  className={`group relative min-h-16 rounded-md p-1.5 text-left text-xs font-bold ${isCurrentMonth ? "bg-[#eef3f8] text-[#111827]" : "bg-[#f7f8f7] text-[#9aa1a0]"} ${isToday ? "border border-[#DC143C] bg-[#FCECEF]" : ""} ${previewDateValue === dateValue ? "ring-2 ring-[#DC143C]/40" : ""}`}
                >
                  <span>{day.date.getDate()}</span>
                  <div className="mt-1 space-y-1">
                    {dayItems.slice(0, 2).map((item) => (
                      <span key={item.id} className={`block truncate rounded px-1 py-0.5 text-[10px] ${item.type === "income" ? "bg-[#eaf8f4] text-[#0d4a2b]" : "bg-[#FCECEF] text-[#DC143C]"}`}>
                        {item.description}
                      </span>
                    ))}
                    {dayItems.length > 2 && <span className="block text-[10px] text-[#64748b]">+{dayItems.length - 2}</span>}
                  </div>
                  {dayItems.length > 0 && (
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-48 -translate-x-1/2 rounded-md border border-black/10 bg-white p-2 text-left shadow-lg group-hover:block group-focus:block">
                      <p className="text-[11px] font-black text-[#151b18]">{formatThaiShortDate(dateValue)}</p>
                      <div className="mt-1 space-y-1">
                        {dayItems.slice(0, 3).map((item) => (
                          <p key={item.id} className="truncate text-[11px] font-semibold text-[#555f5b]">
                            {item.description} · {formatBaht(item.amount)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {previewDay && (
            <RecurringCalendarPreview date={previewDay.date} items={previewItems} />
          )}
        </section>
      ) : items.length > 0 ? (
        <RecurringList items={items} onDelete={(item) => setPendingDeleteItem(item)} onEdit={(item) => setEditingItem(item)} />
      ) : (
        <div className="py-16 text-center text-sm font-semibold text-[#6b7280]">ยังไม่มีรายการจดประจำ</div>
      )}

      {showCreateModal && (
        <RecurringItemModal
          defaultNotifyTime={notifyTime}
          initialDate={createInitialDate}
          onClose={closeCreateModal}
          onSave={addItem}
          saving={saving}
        />
      )}
      {editingItem && (
        <RecurringItemModal
          defaultNotifyTime={notifyTime}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={editItem}
          saving={saving}
        />
      )}
      {pendingDeleteItem && (
        <ConfirmDeleteDialog
          title="ยืนยันการลบรายการจดประจำ"
          body={`คุณต้องการลบ "${pendingDeleteItem.description}" ใช่หรือไม่?`}
          confirmLabel="ลบรายการ"
          onCancel={() => setPendingDeleteItem(null)}
          confirming={saving}
          onConfirm={() => removeItem(pendingDeleteItem)}
        />
      )}
    </div>
  );
}

function RecurringStat({ amount, count, label, tone }: { amount: number; count: number; label: string; tone: "expense" | "income" }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold text-[#6b7280]">▣ {label}</p>
      <p className={`mt-1 text-xl font-black ${tone === "income" ? "text-[#6dc5ad]" : "text-[#DC143C]"}`}>{formatBaht(amount)}</p>
      <p className={`text-xs font-semibold ${tone === "income" ? "text-[#6dc5ad]" : "text-[#DC143C]"}`}>({count} รายการ)</p>
    </div>
  );
}

function RecurringCalendarPreview({ date, items }: { date: Date; items: RecurringItem[] }) {
  const dateValue = inputDateValue(date);

  return (
    <section className="rounded-md border border-black/10 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#151b18]">{formatThaiLongDate(dateValue)}</p>
          <p className="mt-1 text-xs font-semibold text-[#8a928e]">
            {items.length > 0 ? `มีรายการจดประจำ ${items.length} รายการ` : "ยังไม่มีรายการจดประจำในวันนี้"}
          </p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[#f7f8f7] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#151b18]">{item.description}</p>
                <p className="mt-1 text-xs font-semibold text-[#8a928e]">
                  {displayCategory(item.category, item.type)} · {recurringLabel(item)}
                </p>
              </div>
              <p className={`shrink-0 text-sm font-black ${item.type === "income" ? "text-[#0d4a2b]" : "text-[#DC143C]"}`}>
                {item.type === "income" ? "+" : "-"}{formatBaht(item.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecurringTimePicker({ compact = false, onChange, value }: { compact?: boolean; onChange: (value: string) => void; value: string }) {
  const [hour = "00", minute = "00"] = value.split(":");

  function update(nextHour: string, nextMinute: string) {
    onChange(`${nextHour.padStart(2, "0")}:${nextMinute.padStart(2, "0")}`);
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? "shrink-0" : "mt-2"}`}>
      <select value={hour.padStart(2, "0")} onChange={(event) => update(event.target.value, minute)} className={`${compact ? "h-11 w-20 text-sm" : "h-11 flex-1 text-base"} rounded-md border border-black/10 bg-white px-3 font-black shadow-sm outline-none focus:border-[#6DC5AD]`}>
        {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <span className="text-sm font-black text-[#8a928e]">:</span>
      <select value={minute.padStart(2, "0")} onChange={(event) => update(hour, event.target.value)} className={`${compact ? "h-11 w-20 text-sm" : "h-11 flex-1 text-base"} rounded-md border border-black/10 bg-white px-3 font-black shadow-sm outline-none focus:border-[#6DC5AD]`}>
        {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <span className="text-sm font-black text-[#8a928e]">น.</span>
    </div>
  );
}

function RecurringList({ items, onDelete, onEdit }: { items: RecurringItem[]; onDelete: (item: RecurringItem) => void; onEdit: (item: RecurringItem) => void }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} role="button" tabIndex={0} onClick={() => onEdit(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onEdit(item); }} className="rounded-md border border-black/10 bg-white p-3 shadow-sm transition hover:border-[#6DC5AD]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-[#151b18]">{item.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black text-white ${item.type === "income" ? "bg-[#6dc5ad]" : "bg-[#DC143C]"}`}>{item.type === "income" ? "รายรับ" : "รายจ่าย"}</span>
                <span className="rounded-md bg-[#f0f2f1] px-2 py-1 text-xs font-black text-[#64748b]">{displayCategory(item.category, item.type)}</span>
                <span className="rounded-md bg-[#f0f2f1] px-2 py-1 text-xs font-black text-[#64748b]">{recurringLabel(item)}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-base font-black ${item.type === "income" ? "text-[#0d4a2b]" : "text-[#DC143C]"}`}>{formatBaht(item.amount)}</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(item); }} className="mt-2 text-xs font-black text-[#8a928e]">ลบ</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecurringItemModal({
  defaultNotifyTime,
  initialDate,
  item,
  onClose,
  onSave,
  saving = false,
}: {
  defaultNotifyTime: string;
  initialDate?: string;
  item?: RecurringItem;
  onClose: () => void;
  onSave: (item: RecurringItem) => void;
  saving?: boolean;
}) {
  const initial = parseLocalDate(initialDate ?? "") ?? new Date();
  const [type, setType] = useState<"expense" | "income">(item?.type ?? "expense");
  const [category, setCategory] = useState(() => item?.category ?? transactionCategories("expense")[0] ?? "อื่นๆ");
  const [description, setDescription] = useState(item?.description ?? "");
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [interval, setInterval] = useState<RecurringInterval>(item?.interval ?? "monthly");
  const [dayOfWeek, setDayOfWeek] = useState(item?.dayOfWeek ?? initial.getDay());
  const [dayOfMonth, setDayOfMonth] = useState(item?.dayOfMonth ?? initial.getDate());
  const [month, setMonth] = useState(item?.month ?? initial.getMonth() + 1);
  const [notifyTime, setNotifyTime] = useState(item?.notifyTime ?? defaultNotifyTime);
  const categories = transactionCategories(type);
  const canSave = description.trim() && Number(amount) > 0 && category;

  function changeType(nextType: "expense" | "income") {
    setType(nextType);
    setCategory(transactionCategories(nextType)[0] ?? "อื่นๆ");
  }

  function save() {
    if (!canSave) return;
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      type,
      amount: Number(amount),
      category,
      description: description.trim(),
      mode: "personal",
      interval,
      dayOfWeek: interval === "weekly" ? dayOfWeek : undefined,
      dayOfMonth: interval === "monthly" || interval === "yearly" ? dayOfMonth : undefined,
      month: interval === "yearly" ? month : undefined,
      notifyTime,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div role="dialog" aria-modal="true" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-[#f0f2f1]" />
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">เพิ่มรายการจดประจำ</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-10 w-10 place-items-center rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <section>
            <p className="text-base font-black">ประเภทรายการ</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => changeType("expense")} className={`h-12 rounded-md border text-sm font-black ${type === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#F5C6D0] bg-white text-[#DC143C]"}`}>รายจ่าย</button>
              <button type="button" onClick={() => changeType("income")} className={`h-12 rounded-md border text-sm font-black ${type === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#0d4a2b]"}`}>รายรับ</button>
            </div>
          </section>
          <label className="block">
            <span className="text-base font-black">ชื่อรายการ</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="เช่น Netflix, เงินเดือน" className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-base font-black">จำนวนเงิน</span>
              <input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
            </label>
            <label className="block">
              <span className="text-base font-black">หมวด</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-base font-black">รอบจดประจำ</span>
            <select value={interval} onChange={(event) => setInterval(event.target.value as RecurringInterval)} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
              <option value="daily">ทุกวัน</option>
              <option value="weekly">ทุกสัปดาห์</option>
              <option value="monthly">ทุกเดือน</option>
              <option value="yearly">ทุกปี</option>
            </select>
          </label>
          {interval === "weekly" && (
            <label className="block">
              <span className="text-base font-black">วันของสัปดาห์</span>
              <select value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
                {["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
          )}
          {(interval === "monthly" || interval === "yearly") && (
            <div className="grid grid-cols-2 gap-3">
              {interval === "yearly" && (
                <label className="block">
                  <span className="text-base font-black">เดือน</span>
                  <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{new Date(2026, value - 1, 1).toLocaleDateString("th-TH", { month: "long" })}</option>)}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-base font-black">วันที่</span>
                <select value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
          )}
          <label className="block">
            <span className="text-base font-black">เวลาจด</span>
            <RecurringTimePicker value={notifyTime} onChange={setNotifyTime} />
          </label>
          <button type="submit" disabled={!canSave || saving} className="h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white shadow-sm disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
        </form>
      </div>
    </div>
  );
}

function BulkSelectHeader({
  allVisibleSelected,
  onClose,
  onToggleAll,
  selectedCount,
}: {
  allVisibleSelected: boolean;
  onClose: () => void;
  onToggleAll: () => void;
  selectedCount: number;
}) {
  return (
    <section className="-mx-4 -mt-4 flex items-center justify-between border-b border-[#f6c5d0] bg-[#fff5f7] px-4 py-4">
      <button type="button" onClick={onClose} aria-label="ปิดโหมดเลือกหลายรายการ" className="grid h-9 w-9 place-items-center rounded-md text-[#151b18]">
        <X className="h-5 w-5" />
      </button>
      <p className="flex-1 pl-2 text-sm font-black text-[#151b18]">เลือก {selectedCount} รายการ</p>
      <button type="button" onClick={onToggleAll} className="flex items-center gap-2 text-xs font-bold text-[#8a6f78]">
        <span>เลือกทั้งหมด</span>
        <span className={`grid h-5 w-5 place-items-center rounded border ${allVisibleSelected ? "border-[#DC143C] bg-[#DC143C] text-white" : "border-black/10 bg-white"}`}>
          {allVisibleSelected && <Check className="h-3.5 w-3.5" />}
        </span>
      </button>
    </section>
  );
}

function BulkTransactionList({
  onToggle,
  selectedIds,
  transactions,
}: {
  onToggle: (id: number) => void;
  selectedIds: Set<number>;
  transactions: Transaction[];
}) {
  const groups = useMemo(() => groupTransactionsByDate(transactions), [transactions]);

  return (
    <div className="space-y-5 pb-28">
      {groups.map((group) => {
        const total = group.transactions.reduce((sum, transaction) => sum + (transaction.type === "income" ? transaction.amount : -transaction.amount), 0);
        return (
          <section key={group.date} className="space-y-2">
            <div className="flex items-end justify-between border-b border-[#9aa1a0] pb-2">
              <p className="text-xs font-semibold text-[#8a928e]">{formatThaiShortDate(group.date)}</p>
              <p className={`text-xs font-black ${total >= 0 ? "text-[#10b95f]" : "text-[#DC143C]"}`}>
                รวม: {total >= 0 ? "+" : "-"}{formatBaht(Math.abs(total))}
              </p>
            </div>
            <div className="space-y-3">
              {group.transactions.map((transaction) => {
                const selected = selectedIds.has(transaction.id);
                const amountColor = transaction.type === "income" ? "text-[#10b95f]" : "text-[#DC143C]";
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => onToggle(transaction.id)}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left shadow-sm transition ${
                      selected ? "border-[#f2a8bb] bg-[#fff2f5]" : "border-black/10 bg-white active:bg-[#f7f8f7]"
                    }`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? "border-[#DC143C] bg-[#DC143C] text-white" : "border-black/10 bg-white"}`}>
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#151b18]">{transaction.description || displayCategory(transaction.category, transaction.type)}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#8a928e]">
                        {formatTimeFallback(transaction.date)}
                        <span className="rounded-md bg-[#f0f2f1] px-2 py-1 text-[11px] font-black text-[#6b756f]">{displayCategory(transaction.category, transaction.type)}</span>
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-black ${amountColor}`}>
                      {transaction.type === "income" ? "+" : "-"}{formatBaht(transaction.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BulkActionBar({
  onDelete,
  onEditCategory,
  onEditDate,
  saving,
  selectedCount,
}: {
  onDelete: () => void;
  onEditCategory: () => void;
  onEditDate: () => void;
  saving: boolean;
  selectedCount: number;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <button type="button" onClick={onEditCategory} disabled={saving} className="h-12 rounded-md border border-black/10 bg-white text-sm font-black text-[#151b18] shadow-sm disabled:opacity-50">
          แก้หมวด
        </button>
        <button type="button" onClick={onEditDate} disabled={saving} className="h-12 rounded-md border border-black/10 bg-white text-sm font-black text-[#151b18] shadow-sm disabled:opacity-50">
          แก้วันที่
        </button>
        <button type="button" onClick={onDelete} disabled={saving} className="h-12 rounded-md bg-[#e60023] text-sm font-black text-white shadow-sm disabled:opacity-50">
          ลบ ({selectedCount})
        </button>
      </div>
    </div>
  );
}

function BulkCategoryModal({
  count,
  onClose,
  onSave,
  saving,
  transactions,
}: {
  count: number;
  onClose: () => void;
  onSave: (type: "expense" | "income", category: string) => void;
  saving: boolean;
  transactions: Transaction[];
}) {
  const firstType = transactions[0]?.type ?? "expense";
  const sameType = transactions.every((transaction) => transaction.type === firstType);
  const [draftType, setDraftType] = useState<"expense" | "income">(sameType ? firstType : "expense");
  const [draftCategory, setDraftCategory] = useState(() => transactionCategories(sameType ? firstType : "expense")[0] ?? "");
  const categories = transactionCategories(draftType);
  const canSave = Boolean(draftCategory) && count > 0 && !saving;

  function changeType(nextType: "expense" | "income") {
    setDraftType(nextType);
    setDraftCategory(transactionCategories(nextType)[0] ?? "");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-category-title" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-[#f0f2f1]" />
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 id="bulk-category-title" className="text-center text-2xl font-black">แก้ไขหมวด ({count} รายการ)</h2>
        <p className="mt-4 text-center text-sm font-semibold text-[#8a928e]">เลือกหมวดใหม่สำหรับรายการที่เลือก</p>

        <section className="mt-6">
          <p className="text-base font-black">ประเภทรายการ</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => changeType("expense")} className={`h-12 rounded-md border text-sm font-black ${draftType === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#F5C6D0] bg-white text-[#DC143C]"}`}>
              รายจ่าย
            </button>
            <button type="button" onClick={() => changeType("income")} className={`h-12 rounded-md border text-sm font-black ${draftType === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#0d4a2b]"}`}>
              รายรับ
            </button>
          </div>
        </section>

        <label className="mt-5 block">
          <span className="text-base font-black">หมวด</span>
          <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <div className="mt-10 bg-[#fbfbfb] p-3">
          <button type="button" disabled={!canSave} onClick={() => onSave(draftType, draftCategory)} className="h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white shadow-sm disabled:bg-[#e99ab8]">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkDateModal({
  count,
  initialDate,
  onClose,
  onSave,
  saving,
}: {
  count: number;
  initialDate: string;
  onClose: () => void;
  onSave: (date: string) => void;
  saving: boolean;
}) {
  const initial = parseLocalDate(initialDate) ?? new Date();
  const [selectedDate, setSelectedDate] = useState(inputDateValue(initial));
  const [viewMonth, setViewMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const days = calendarGridDays(viewMonth);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-date-title" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-[#f0f2f1]" />
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 id="bulk-date-title" className="text-center text-2xl font-black">แก้ไขวันที่ ({count} รายการ)</h2>
        <p className="mt-4 text-center text-sm font-semibold text-[#8a928e]">เลือกวันที่ใหม่สำหรับรายการที่เลือก</p>
        <p className="mt-4 text-center text-sm font-bold text-[#6b756f]">
          วันที่เลือก: {formatThaiLongDate(selectedDate)}, {hour}:{minute}
        </p>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="เดือนก่อนหน้า" className="grid h-9 w-9 place-items-center rounded-md">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-black">{viewMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
          <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="เดือนถัดไป" className="grid h-9 w-9 place-items-center rounded-md">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-black text-[#8a928e]">
          {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-2 text-center">
          {days.map((day) => {
            const dateValue = inputDateValue(day.date);
            const selected = dateValue === selectedDate;
            const isCurrentMonth = day.date.getMonth() === viewMonth.getMonth();
            return (
              <button
                key={dateValue}
                type="button"
                onClick={() => setSelectedDate(dateValue)}
                className={`h-8 rounded-md text-sm font-bold ${selected ? "bg-[#DC143C] text-white" : isCurrentMonth ? "text-[#151b18] hover:bg-[#f7f8f7]" : "text-[#9aa1a0]"}`}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mx-auto mt-6 flex max-w-[220px] items-center justify-center gap-3 border-t border-black/10 pt-4">
          <select value={hour} onChange={(event) => setHour(event.target.value)} className="h-10 rounded-md border border-black/10 bg-white px-4 text-sm font-bold shadow-sm">
            {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span className="font-black text-[#8a928e]">:</span>
          <select value={minute} onChange={(event) => setMinute(event.target.value)} className="h-10 rounded-md border border-black/10 bg-white px-4 text-sm font-bold shadow-sm">
            {["00", "15", "30", "45"].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="mt-8 bg-[#fbfbfb] p-3">
          <button type="button" disabled={saving} onClick={() => onSave(selectedDate)} className="h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white shadow-sm disabled:bg-[#e99ab8]">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateRangePickerModal({
  endDate,
  onClose,
  onSave,
  startDate,
}: {
  endDate: string;
  onClose: () => void;
  onSave: (startDate: string, endDate: string) => void;
  startDate: string;
}) {
  const initialMonth = parseLocalDate(endDate) ?? new Date();
  const [viewMonth, setViewMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const days = calendarGridDays(viewMonth);

  function selectDay(value: string) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(value);
      setDraftEnd("");
      return;
    }

    if (value < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(value);
      return;
    }

    setDraftEnd(value);
  }

  function applyPreset(preset: "month" | "lastWeek" | "lastTwoWeeks") {
    const today = new Date();
    if (preset === "month") {
      setDraftStart(inputDateValue(new Date(today.getFullYear(), today.getMonth(), 1)));
      setDraftEnd(inputDateValue(today));
      setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      return;
    }

    const daysBack = preset === "lastWeek" ? 6 : 13;
    const start = new Date(today);
    start.setDate(today.getDate() - daysBack);
    setDraftStart(inputDateValue(start));
    setDraftEnd(inputDateValue(today));
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const canSave = Boolean(draftStart && draftEnd);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 px-4 pt-16">
      <div role="dialog" aria-modal="true" aria-label="เลือกช่วงวันที่" className="w-full max-w-sm rounded-md bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="เดือนก่อนหน้า" className="grid h-9 w-9 place-items-center rounded-md text-[#151b18]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-black text-[#151b18]">{viewMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
          <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="เดือนถัดไป" className="grid h-9 w-9 place-items-center rounded-md text-[#151b18]">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-black text-[#8a928e]">
          {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-2 text-center">
          {days.map((day) => {
            const isCurrentMonth = day.date.getMonth() === viewMonth.getMonth();
            const dateValue = inputDateValue(day.date);
            const isStart = dateValue === draftStart;
            const isEnd = dateValue === draftEnd;
            const isInRange = Boolean(draftStart && draftEnd && dateValue > draftStart && dateValue < draftEnd);
            return (
              <button
                key={dateValue}
                type="button"
                onClick={() => selectDay(dateValue)}
                className={[
                  "h-8 text-sm font-bold",
                  isCurrentMonth ? "text-[#151b18]" : "text-[#9aa1a0]",
                  isStart || isEnd ? "rounded-md bg-[#DC143C] text-white" : "",
                  isInRange ? "bg-[#f8e4e8]" : "",
                  !isStart && !isEnd && !isInRange ? "rounded-md hover:bg-[#f7f8f7]" : "",
                ].join(" ")}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => applyPreset("month")} className="h-9 rounded-md border border-black/10 bg-white text-xs font-black shadow-sm">
            เดือนนี้
          </button>
          <button type="button" onClick={() => applyPreset("lastWeek")} className="h-9 rounded-md border border-black/10 bg-white text-xs font-black shadow-sm">
            สัปดาห์ที่ผ่านมา
          </button>
          <button type="button" onClick={() => applyPreset("lastTwoWeeks")} className="h-9 rounded-md border border-black/10 bg-white text-xs font-black shadow-sm">
            2 สัปดาห์ที่ผ่านมา
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <button type="button" onClick={onClose} className="h-11 rounded-md border border-black/10 bg-white text-sm font-black shadow-sm">
            ยกเลิก
          </button>
          <button type="button" disabled={!canSave} onClick={() => onSave(draftStart, draftEnd)} className="h-11 rounded-md bg-[#DC143C] text-sm font-black text-white shadow-sm disabled:opacity-50">
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ profile }: { profile: LineProfile }) {
  const settings = ["เตือนจดประจำวัน", "จัดหมวดด้วยความจำ", "แยกช่องทางชำระเงิน", "รายการจดประจำ", "ประวัติการชำระเงิน", "ตั้งค่าหมวด", "การแจ้งเตือน Streak", "ตั้งค่าสกุลเงิน", "ปรับแต่งข้อความยืนยัน", "ตั้งค่าโซนเวลา", "ตั้งค่าภาษา"];
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [showCurrencyScreen, setShowCurrencyScreen] = useState(false);
  const [showTimezoneScreen, setShowTimezoneScreen] = useState(false);
  const [showConfirmationScreen, setShowConfirmationScreen] = useState(false);
  const [showLanguageScreen, setShowLanguageScreen] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<DailyReminderSettingsInput>(() => loadStoredDailyReminderSettings(profile.line_user_id));
  const [paymentSettings, setPaymentSettings] = useState<PaymentChannelSettings>(() => loadStoredPaymentChannelSettings(profile.line_user_id));
  const [userSettings, setUserSettings] = useState<UserSettingsInput>(defaultUserSettings);
  const [currencySetting, setCurrencySetting] = useState<CurrencySetting>(() => loadStoredCurrencySetting(profile.line_user_id));
  const [timezoneSetting, setTimezoneSetting] = useState<TimezoneSetting>(() => loadStoredTimezoneSetting(profile.line_user_id));
  const [languageSetting, setLanguageSetting] = useState<LanguageCode>(() => loadStoredLanguageSetting(profile.line_user_id));
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.resolve(loadStoredDailyReminderSettings(profile.line_user_id))
      .then((localSettings) => {
        if (!mounted) return null;
        setReminderSettings(localSettings);
        if (!profile.line_user_id) return null;
        return getDailyReminderSettings(profile.line_user_id);
      })
      .then((settings) => {
        if (!mounted || !settings) return;
        const nextSettings = {
          enabled: settings.enabled,
          reminder_time: settings.reminder_time,
          reminder_mode: settings.reminder_mode,
        };
        setReminderSettings(nextSettings);
        saveStoredDailyReminderSettings(profile.line_user_id, nextSettings);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [profile.line_user_id]);

  useEffect(() => {
    let mounted = true;
    if (!profile.line_user_id) return () => {
      mounted = false;
    };
    getUserSettings(profile.line_user_id)
      .then((settings) => {
        if (!mounted) return;
        const nextSettings: UserSettingsInput = {
          memory_categorization_enabled: settings.memory_categorization_enabled,
          streak_notifications_enabled: settings.streak_notifications_enabled,
          timezone: settings.timezone,
          confirmation_show_details: settings.confirmation_show_details,
          confirmation_show_budget: settings.confirmation_show_budget,
          confirmation_show_budget_warning: settings.confirmation_show_budget_warning,
          confirmation_show_payment_options: settings.confirmation_show_payment_options,
        };
        setUserSettings(nextSettings);
        const nextTimezone = findTimezone(nextSettings.timezone);
        setTimezoneSetting(nextTimezone);
        saveStoredTimezoneSetting(profile.line_user_id, nextTimezone);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [profile.line_user_id]);

  useEffect(() => {
    let mounted = true;
    Promise.resolve(loadStoredPaymentChannelSettings(profile.line_user_id)).then((settings) => {
      if (mounted) setPaymentSettings(settings);
    });
    return () => {
      mounted = false;
    };
  }, [profile.line_user_id]);

  useEffect(() => {
    let mounted = true;
    Promise.resolve({
      currency: loadStoredCurrencySetting(profile.line_user_id),
      timezone: loadStoredTimezoneSetting(profile.line_user_id),
      language: loadStoredLanguageSetting(profile.line_user_id),
    }).then((settings) => {
      if (!mounted) return;
      setCurrencySetting(settings.currency);
      setTimezoneSetting(settings.timezone);
      setLanguageSetting(settings.language);
      saveStoredCurrencySetting(profile.line_user_id, settings.currency);
      saveStoredTimezoneSetting(profile.line_user_id, settings.timezone);
    });
    return () => {
      mounted = false;
    };
  }, [profile.line_user_id]);

  async function saveReminderSettings(nextSettings: DailyReminderSettingsInput) {
    setSavingReminder(true);
    setReminderError("");
    setReminderSettings(nextSettings);
    saveStoredDailyReminderSettings(profile.line_user_id, nextSettings);
    try {
      if (profile.line_user_id) {
        await saveDailyReminderSettings(profile.line_user_id, nextSettings);
      }
      setShowReminderModal(false);
    } catch {
      setReminderError("บันทึกการเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSavingReminder(false);
    }
  }

  function savePaymentSettings(nextSettings: PaymentChannelSettings) {
    setPaymentSettings(nextSettings);
    saveStoredPaymentChannelSettings(profile.line_user_id, nextSettings);
  }

  function saveCurrencySetting(nextSetting: CurrencySetting) {
    setCurrencySetting(nextSetting);
    saveStoredCurrencySetting(profile.line_user_id, nextSetting);
  }

  function saveLanguageSetting(nextSetting: LanguageCode) {
    setLanguageSetting(nextSetting);
    saveStoredLanguageSetting(profile.line_user_id, nextSetting);
  }

  function saveTimezoneSetting(nextSetting: TimezoneSetting) {
    setTimezoneSetting(nextSetting);
    saveStoredTimezoneSetting(profile.line_user_id, nextSetting);
    void saveRemoteUserSettings({ ...userSettings, timezone: nextSetting.value });
  }

  function saveRemoteUserSettings(nextSettings: UserSettingsInput) {
    setUserSettings(nextSettings);
    if (!profile.line_user_id) return Promise.resolve();
    return saveUserSettings(profile.line_user_id, nextSettings)
      .then((settings) => {
        setUserSettings({
          memory_categorization_enabled: settings.memory_categorization_enabled,
          streak_notifications_enabled: settings.streak_notifications_enabled,
          timezone: settings.timezone,
          confirmation_show_details: settings.confirmation_show_details,
          confirmation_show_budget: settings.confirmation_show_budget,
          confirmation_show_budget_warning: settings.confirmation_show_budget_warning,
          confirmation_show_payment_options: settings.confirmation_show_payment_options,
        });
      })
      .catch(() => undefined);
  }

  if (showPaymentScreen) {
    return (
      <PaymentChannelsScreen
        settings={paymentSettings}
        onBack={() => setShowPaymentScreen(false)}
        onChange={savePaymentSettings}
      />
    );
  }

  if (showCurrencyScreen) {
    return (
      <CurrencySettingsScreen
        value={currencySetting}
        onBack={() => setShowCurrencyScreen(false)}
        onChange={saveCurrencySetting}
      />
    );
  }

  if (showLanguageScreen) {
    return (
      <LanguageSettingsScreen
        value={languageSetting}
        onBack={() => setShowLanguageScreen(false)}
        onChange={saveLanguageSetting}
      />
    );
  }

  if (showConfirmationScreen) {
    return (
      <ConfirmationMessageSettingsScreen
        value={userSettings}
        onBack={() => setShowConfirmationScreen(false)}
        onChange={(nextSettings) => void saveRemoteUserSettings(nextSettings)}
      />
    );
  }

  if (showTimezoneScreen) {
    return (
      <TimezoneSettingsScreen
        value={timezoneSetting}
        onBack={() => setShowTimezoneScreen(false)}
        onChange={saveTimezoneSetting}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Image src="/brand/moneytrack-pro.png" alt="เงินไปไหน" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-black">เงินไปไหน?</h2>
          <p className="text-sm font-semibold text-[#8a928e]">ผู้ช่วยจดเงินผ่าน LINE</p>
        </div>
        <button type="button" className="rounded-md bg-[#6dc5ad] px-4 py-2 text-sm font-black text-[#082f24]">
          อัปเกรด
        </button>
      </div>
      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-5">
          <Image src="/brand/moneytrack-pro.png" alt="" width={80} height={80} className="h-20 w-20 rounded-md object-cover opacity-80" />
          <div>
            <p className="text-xl font-black">จดต่อเนื่องมา</p>
            <p className="mt-1 text-4xl font-black">0 วัน</p>
            <p className="mt-1 text-sm text-[#555f5b]">เริ่มจดวันนี้เพื่อสร้างนิสัยใหม่</p>
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-[#e5e8e7]">
          <div className="h-3 w-1/2 rounded-full bg-[#6dc5ad]" />
        </div>
      </section>
      <button type="button" className="h-12 w-full rounded-md bg-[#6dc5ad] text-base font-black text-[#082f24]">
        ชวนเพื่อนมาใช้ รับฟรี 1 เดือน
      </button>
      <div className="space-y-3">
        {settings.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              if (index === 0) setShowReminderModal(true);
              if (index === 2) setShowPaymentScreen(true);
              if (index === 7) setShowCurrencyScreen(true);
              if (index === 8) setShowConfirmationScreen(true);
              if (index === 9) setShowTimezoneScreen(true);
              if (index === 10) setShowLanguageScreen(true);
            }}
            className="flex min-h-14 w-full items-center justify-between rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-bold shadow-sm"
          >
            <span className={index === settings.length - 1 ? "text-[#0d4a2b]" : ""}>{item}</span>
            <span className="flex items-center gap-2">
              {index === 0 && (
                <span className={`rounded-full px-2 py-1 text-xs font-black ${reminderSettings.enabled ? "bg-[#EAF8F4] text-[#0D4A2B]" : "bg-[#f0f2f1] text-[#8a928e]"}`}>
                  {reminderSettings.enabled ? `${reminderSettings.reminder_time} น.` : "ปิดอยู่"}
                </span>
              )}
              {index === 2 && (
                <span className={`rounded-full px-2 py-1 text-xs font-black ${paymentSettings.enabled ? "bg-[#EAF8F4] text-[#0D4A2B]" : "bg-[#f0f2f1] text-[#8a928e]"}`}>
                  {paymentSettings.enabled ? `${paymentSettings.channels.length}/10` : "ปิดอยู่"}
                </span>
              )}
              {index === 1 && (
                <SettingsToggle
                  checked={userSettings.memory_categorization_enabled}
                  onToggle={() => void saveRemoteUserSettings({ ...userSettings, memory_categorization_enabled: !userSettings.memory_categorization_enabled })}
                />
              )}
              {index === 6 && (
                <SettingsToggle
                  checked={userSettings.streak_notifications_enabled}
                  onToggle={() => void saveRemoteUserSettings({ ...userSettings, streak_notifications_enabled: !userSettings.streak_notifications_enabled })}
                />
              )}
              {index === 7 && (
                <span className="rounded-full bg-[#EAF8F4] px-2 py-1 text-xs font-black text-[#0D4A2B]">
                  {currencySetting.symbol}
                </span>
              )}
              {index === 9 && (
                <span className="rounded-full bg-[#EAF8F4] px-2 py-1 text-xs font-black text-[#0D4A2B]">
                  {timezoneSetting.label}
                </span>
              )}
              {index === 10 && (
                <span className="rounded-full bg-[#EAF8F4] px-2 py-1 text-xs font-black text-[#0D4A2B]">
                  {languageSetting === "th" ? "ไทย" : "EN"}
                </span>
              )}
              <ChevronRight className="text-[#9aa1a0]" />
            </span>
          </button>
        ))}
        <button type="button" className="flex min-h-14 w-full items-center justify-between rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-bold text-[#DC143C] shadow-sm">
          <span>ลบรายการทั้งหมด</span>
          <Trash2 />
        </button>
      </div>
      {showReminderModal && (
        <DailyReminderSettingsModal
          error={reminderError}
          initialValue={reminderSettings}
          onClose={() => setShowReminderModal(false)}
          onSave={(nextSettings) => void saveReminderSettings(nextSettings)}
          saving={savingReminder}
        />
      )}
    </div>
  );
}

function CurrencySettingsScreen({
  onBack,
  onChange,
  value,
}: {
  onBack: () => void;
  onChange: (value: CurrencySetting) => void;
  value: CurrencySetting;
}) {
  const [query, setQuery] = useState("");
  const filteredCurrencies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return currencyOptions;
    return currencyOptions.filter((currency) => {
      return (
        currency.code.toLowerCase().includes(normalized) ||
        currency.label.toLowerCase().includes(normalized) ||
        currency.symbol.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="w-10" />
        <h2 className="text-xl font-black text-[#151b18]">สกุลเงิน</h2>
        <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-[#64706a] hover:bg-[#f3f5f4]" aria-label="ปิด">
          <X size={22} />
        </button>
      </div>
      <div className="rounded-md border border-black/10 bg-white px-4 py-3 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาสกุลเงิน"
          className="h-10 w-full border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-[#9aa1a0]"
        />
      </div>
      <div className="max-h-[68vh] overflow-y-auto rounded-md bg-white">
        {filteredCurrencies.map((currency) => {
          const selected = currency.code === value.code;
          return (
            <button
              key={currency.code}
              type="button"
              onClick={() => onChange(currency)}
              className={`flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-bold ${selected ? "bg-[#FCECEF] text-[#151b18]" : "bg-white text-[#4d5652] hover:bg-[#f8faf9]"}`}
            >
              <span>
                {currency.label} ({currency.symbol})
              </span>
              {selected && <Check size={16} className="text-[#151b18]" />}
            </button>
          );
        })}
        {filteredCurrencies.length === 0 && (
          <p className="px-4 py-8 text-center text-sm font-semibold text-[#8a928e]">ไม่พบสกุลเงินที่ค้นหา</p>
        )}
      </div>
    </div>
  );
}

function LanguageSettingsScreen({
  onBack,
  onChange,
  value,
}: {
  onBack: () => void;
  onChange: (value: LanguageCode) => void;
  value: LanguageCode;
}) {
  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="w-10" />
        <h2 className="text-xl font-black text-[#151b18]">ภาษา</h2>
        <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-[#64706a] hover:bg-[#f3f5f4]" aria-label="ปิด">
          <X size={22} />
        </button>
      </div>
      <div className="overflow-hidden rounded-md bg-white">
        {languageOptions.map((option) => {
          const selected = option.code === value;
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => onChange(option.code)}
              className={`flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-bold ${selected ? "bg-[#FCECEF] text-[#151b18]" : "bg-white text-[#4d5652] hover:bg-[#f8faf9]"}`}
            >
              <span>{option.label}</span>
              {selected && <Check size={16} className="text-[#151b18]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimezoneSettingsScreen({
  onBack,
  onChange,
  value,
}: {
  onBack: () => void;
  onChange: (value: TimezoneSetting) => void;
  value: TimezoneSetting;
}) {
  const [query, setQuery] = useState("");
  const filteredTimezones = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return timezoneOptions;
    return timezoneOptions.filter((timezone) => {
      return (
        timezone.label.toLowerCase().includes(normalized) ||
        timezone.offset.toLowerCase().includes(normalized) ||
        timezone.value.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="w-10" />
        <h2 className="text-xl font-black text-[#151b18]">ตั้งค่าโซนเวลา</h2>
        <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-[#64706a] hover:bg-[#f3f5f4]" aria-label="ปิด">
          <X size={22} />
        </button>
      </div>
      <div className="rounded-md border border-black/10 bg-white px-4 py-3 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาโซนเวลา"
          className="h-10 w-full border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-[#9aa1a0]"
        />
      </div>
      <p className="px-1 text-sm font-black text-[#151b18]">เลือกโซนเวลาที่ระบบจะแสดงผล</p>
      <div className="max-h-[68vh] overflow-y-auto rounded-md bg-white">
        {filteredTimezones.map((timezone) => {
          const selected = timezone.value === value.value;
          return (
            <button
              key={timezone.value}
              type="button"
              onClick={() => onChange(timezone)}
              className={`flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-bold ${selected ? "bg-[#FCECEF] text-[#151b18]" : "bg-white text-[#4d5652] hover:bg-[#f8faf9]"}`}
            >
              <span>
                {timezone.label} ({timezone.offset})
              </span>
              {selected && <Check size={16} className="text-[#151b18]" />}
            </button>
          );
        })}
        {filteredTimezones.length === 0 && (
          <p className="px-4 py-8 text-center text-sm font-semibold text-[#8a928e]">ไม่พบโซนเวลาที่ค้นหา</p>
        )}
      </div>
    </div>
  );
}

function ConfirmationMessageSettingsScreen({
  onBack,
  onChange,
  value,
}: {
  onBack: () => void;
  onChange: (value: UserSettingsInput) => void;
  value: UserSettingsInput;
}) {
  const options: { key: ConfirmationSettingKey; title: string; description: string; locked?: boolean }[] = [
    { key: "confirmation_show_details", title: "รายละเอียดรายการ", description: "แสดงกล่องหมวด ยอดเงิน และโหมดส่วนตัว/ธุรกิจ" },
    { key: "confirmation_show_budget", title: "งบคงเหลือ", description: "แสดงยอดใช้ไป เทียบกับงบที่ตั้งไว้" },
    { key: "confirmation_show_budget_warning", title: "ข้อความเตือนงบประมาณ", description: "เตือนเมื่อรายจ่ายเข้าใกล้หรือเกินงบ" },
    { key: "confirmation_show_payment_options", title: "ตัวเลือกช่องทางชำระเงิน", description: "แสดงคำแนะนำช่องทางชำระเงินใน Flex message" },
  ];

  function toggle(key: ConfirmationSettingKey) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="w-10" />
        <h2 className="text-center text-xl font-black text-[#151b18]">ปรับแต่งข้อความยืนยันรายการ</h2>
        <button type="button" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full text-[#64706a] hover:bg-[#f3f5f4]" aria-label="ปิด">
          <X size={22} />
        </button>
      </div>
      <p className="text-center text-sm font-semibold leading-6 text-[#6b7280]">
        เลือกว่า Flex message หลังจดรายการควรแสดงส่วนไหนบ้าง
      </p>
      <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {options.map((option) => (
            <div key={option.key} className="flex items-start justify-between gap-4 rounded-md border border-black/10 bg-[#fbfcfc] p-3">
              <div>
                <p className="text-sm font-black text-[#151b18]">{option.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#6b7280]">{option.description}</p>
              </div>
              <SettingsToggle checked={value[option.key]} onToggle={() => toggle(option.key)} />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-md border border-[#F3C7D4] bg-[#FCECEF] p-3 text-xs font-semibold leading-5 text-[#6b2437]">
          ค่าเหล่านี้จะถูกใช้ตอน LINE สร้าง Flex message จริง และบันทึกแยกตามผู้ใช้
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-1 transition ${checked ? "bg-[#6DC5AD]" : "bg-[#dfe4e2]"}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </span>
  );
}

function DailyReminderSettingsModal({
  error,
  initialValue,
  onClose,
  onSave,
  saving,
}: {
  error: string;
  initialValue: DailyReminderSettingsInput;
  onClose: () => void;
  onSave: (value: DailyReminderSettingsInput) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<DailyReminderSettingsInput>(initialValue);
  const modeOptions: { value: DailyReminderSettingsInput["reminder_mode"]; label: string; description: string }[] = [
    { value: "missing_only", label: "เตือนวันที่ยังไม่ได้จด", description: "เตือนเฉพาะวันที่ยังไม่มีรายการ" },
    { value: "daily", label: "เตือนทุกวัน", description: "ส่งเตือนทุกวันตามเวลาที่ตั้งไว้" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-[#edf0ef]" />
        <div className="flex items-center justify-between">
          <span className="h-9 w-9" />
          <h2 className="text-center text-2xl font-black">เตือนจดประจำวัน</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-md text-[#4b5563]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mt-4 rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

        <section className="mt-6 rounded-md border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-black">เปิดใช้งาน</p>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">เงินไปไหนจะส่งข้อความเตือนทุกวัน ตามเวลาที่คุณตั้ง</p>
            </div>
            <button
              type="button"
              aria-pressed={draft.enabled}
              onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
              className={`mt-1 flex h-7 w-12 items-center rounded-full p-1 transition ${draft.enabled ? "justify-end bg-[#6DC5AD]" : "justify-start bg-[#dfe4e2]"}`}
            >
              <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          <div className="mt-4 border-t border-[#e5e7eb] pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#8a928e]">เวลาเตือน</p>
                <p className="mt-1 text-xs font-semibold text-[#8a928e]">เลือกเวลาที่ต้องการให้เตือน</p>
              </div>
              <RecurringTimePicker compact value={draft.reminder_time} onChange={(value) => setDraft((current) => ({ ...current, reminder_time: value }))} />
            </div>
          </div>

          <div className="mt-4 border-t border-[#e5e7eb] pt-4">
            <p className="text-sm font-black text-[#8a928e]">รูปแบบการเตือน</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {modeOptions.map((option) => {
                const isActive = draft.reminder_mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, reminder_mode: option.value }))}
                    className={`min-h-12 rounded-md border px-3 text-sm font-black ${isActive ? "border-[#6DC5AD] bg-[#EAF8F4] text-[#0D4A2B]" : "border-black/10 bg-white text-[#8a928e]"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-semibold text-[#6b7280]">{modeOptions.find((option) => option.value === draft.reminder_mode)?.description}</p>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="text-base font-black">วิธีการทำงาน</h3>
          <ReminderHowItWorksStep step="1." title="ถึงเวลาที่ตั้งไว้" body="ระบบจะตรวจตามเวลาที่เลือกไว้ เช่น 18:00 น." />
          <ReminderHowItWorksStep step="2." title="เงินไปไหนส่ง Flex message" body="กดปุ่ม จดเลย เพื่อเปิดแป้นพิมพ์ในแชทแล้วจดรายการได้ทันที" />
          <ReminderHowItWorksStep step="3." title="เลือกได้ว่าจะเตือนแบบไหน" body="เตือนเฉพาะวันที่ยังไม่ได้จด หรือเตือนทุกวันตามเวลาที่ตั้ง" />
        </section>

        <div className="sticky bottom-0 -mx-5 mt-6 bg-white px-5 pb-1 pt-4">
          <button type="button" disabled={saving} onClick={() => onSave(draft)} className="h-12 w-full rounded-md bg-[#6DC5AD] text-base font-black text-[#082f24] disabled:opacity-60">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReminderHowItWorksStep({ body, step, title }: { body: string; step: string; title: string }) {
  return (
    <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <p className="text-lg font-black text-[#151b18]">{step}</p>
        <div>
          <p className="text-sm font-black text-[#151b18]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#6b7280]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentChannelsScreen({
  onBack,
  onChange,
  settings,
}: {
  onBack: () => void;
  onChange: (settings: PaymentChannelSettings) => void;
  settings: PaymentChannelSettings;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const count = settings.channels.length;

  function update(next: PaymentChannelSettings) {
    onChange({ ...next, channels: next.channels.slice(0, 10) });
  }

  function addChannel(name: string) {
    const trimmed = name.trim();
    if (!trimmed || settings.channels.some((channel) => channel.toLowerCase() === trimmed.toLowerCase()) || settings.channels.length >= 10) {
      return;
    }
    update({ ...settings, channels: [...settings.channels, trimmed] });
    setShowAddModal(false);
  }

  function removeChannel(name: string) {
    update({ ...settings, channels: settings.channels.filter((channel) => channel !== name) });
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="relative text-center">
        <button type="button" onClick={onBack} aria-label="กลับ" className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-md border border-black/10 bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-black">ช่องทางชำระเงิน</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-[#8a928e]">จัดการช่องทางที่ใช้จ่าย แล้วเลือกได้เลยตอนจดรายจ่าย</p>
        <button type="button" className="mx-auto mt-3 inline-flex h-8 items-center gap-1 rounded-full border border-black/10 bg-white px-3 text-xs font-black text-[#555f5b] shadow-sm">
          <span className="text-[#DC143C]">✣</span>
          ดูวิธีใช้
        </button>
      </div>

      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-black">ติดตามช่องทางชำระเงิน</p>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">เปิดเพื่อติดตามแต่ละรายจ่ายว่าจ่ายผ่านช่องทางไหน เช่น เงินสด บัตร หรือพร้อมเพย์</p>
          </div>
          <button
            type="button"
            aria-pressed={settings.enabled}
            onClick={() => update({ ...settings, enabled: !settings.enabled })}
            className={`mt-1 flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${settings.enabled ? "justify-end bg-[#6DC5AD]" : "justify-start bg-[#dfe4e2]"}`}
          >
            <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </section>

      <section className="rounded-md border border-[#e5e7eb] bg-[#fbfcfc] p-4">
        <div className="flex gap-3">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#0D4A2B]" />
          <div>
            <p className="text-sm font-black text-[#1f2a44]">ไม่ว่าเงินสด บัตร หรือ e-wallet ก็รู้ที่มารายจ่ายของตัวเอง</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#6b7280]">ใช้เพื่อแยกช่องทางการชำระเงิน สำหรับคนที่ใช้ทั้งบัตร เงินสด และ e-wallet เป็นประจำ</p>
          </div>
        </div>
      </section>

      <PaymentPreviewCard channels={settings.channels} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black">ช่องทางชำระเงิน</h2>
          <button type="button" onClick={() => setShowSortModal(true)} disabled={count < 2} className="h-9 rounded-md border border-black/10 bg-white px-3 text-sm font-black text-[#151b18] shadow-sm disabled:opacity-50">
            จัดลำดับ ☰
          </button>
        </div>
        <div className="text-right text-xs font-black text-[#8a928e]">{count}/10</div>
        {count > 0 ? (
          <div className="space-y-2">
            {settings.channels.map((channel) => (
              <div key={channel} className="flex min-h-12 items-center justify-between rounded-md border border-black/10 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-[#0D4A2B]" />
                  <span className="text-sm font-black">{channel}</span>
                </div>
                <button type="button" onClick={() => removeChannel(channel)} className="text-sm font-black text-[#DC143C]">
                  ลบ
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[#d9dfdc] bg-white p-5 text-center text-sm font-semibold text-[#8a928e]">ยังไม่มีช่องทางชำระเงิน</div>
        )}
      </section>

      <button type="button" onClick={() => setShowAddModal(true)} disabled={count >= 10} className="h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white shadow-sm disabled:opacity-50">
        <Plus className="mr-1 inline h-5 w-5" />
        เพิ่มช่องทางชำระเงิน
      </button>

      {showAddModal && (
        <PaymentChannelModal
          onClose={() => setShowAddModal(false)}
          onSave={addChannel}
          existing={settings.channels}
        />
      )}
      {showSortModal && (
        <PaymentChannelSortModal
          channels={settings.channels}
          onClose={() => setShowSortModal(false)}
          onSave={(channels) => {
            update({ ...settings, channels });
            setShowSortModal(false);
          }}
        />
      )}
    </div>
  );
}

function PaymentPreviewCard({ channels }: { channels: string[] }) {
  const previewChannels = channels.length > 0 ? channels.slice(0, 3) : ["พร้อมเพย์", "บัตร", "TrueMoney"];
  return (
    <section className="mx-auto w-full max-w-[272px] rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-black">จดสำเร็จ ✅</h3>
          <p className="mt-2 text-xs leading-5 text-[#6b7280]">อย่าลืมตรวจสอบรายการที่จดด้วยนะคะ</p>
        </div>
        <div className="h-12 w-16 overflow-hidden rounded-t-xl">
          <Image src="/brand/moneytrack-pro.png" alt="" width={64} height={64} className="h-16 w-16 object-cover" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-full bg-[#DC143C] px-3 py-1 text-[11px] font-black text-white">รายจ่าย</span>
        <p className="truncate text-base font-black">- อาหารและเครื่องดื่ม</p>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#6b7280]">
        <span>5 มิ.ย. 2569 10:00</span>
        <span className="rounded bg-[#fff8e4] px-1.5 py-0.5 text-[#8a6a00]">💳 เงินสด</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-base font-black">ฟ้ามะลาเต้</p>
        <p className="text-lg font-black text-[#DC143C]">฿180</p>
      </div>
      <div className="my-4 border-t border-[#e5e7eb]" />
      <p className="text-xs font-black text-[#1f2a44]">แตะเพื่อเปลี่ยนช่องทางชำระ</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {previewChannels.map((channel) => (
          <span key={channel} className="max-w-[92px] truncate rounded-full bg-[#f0f2f1] px-2 py-1 text-[11px] font-black text-[#4b5563]">
            {channel}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold text-[#9aa1a0]">อยากได้ช่องทางอื่น กดในแอปได้เลย</p>
    </section>
  );
}

function PaymentChannelModal({ existing, onClose, onSave }: { existing: string[]; onClose: () => void; onSave: (name: string) => void }) {
  const suggestions = ["เงินสด", "พร้อมเพย์", "บัตรเครดิต", "บัตรเดบิต", "TrueMoney", "โอนเงิน", "Rabbit LINE Pay", "อื่นๆ"];
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !existing.some((channel) => channel.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-[#edf0ef]" />
        <div className="flex items-center justify-between">
          <span className="h-9 w-9" />
          <h2 className="text-xl font-black">เพิ่มช่องทางชำระเงิน</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-5 block text-sm font-black" htmlFor="payment-channel-name">ตั้งชื่อช่องทาง</label>
        <input
          id="payment-channel-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 h-12 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]"
          placeholder="เช่น เงินสด, พร้อมเพย์, บัตร"
        />
        <p className="mt-2 text-xs font-semibold text-[#8a928e]">พิมพ์ชื่อเอง หรือเลือกจากตัวอย่างด้านล่าง</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {suggestions.map((item) => (
            <button key={item} type="button" onClick={() => setName(item)} className="h-11 rounded-md border border-black/10 bg-white text-sm font-black shadow-sm">
              {item}
            </button>
          ))}
        </div>
        <button type="button" disabled={!canSave} onClick={() => onSave(trimmed)} className="mt-6 h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white disabled:opacity-50">
          บันทึก
        </button>
      </div>
    </div>
  );
}

function PaymentChannelSortModal({ channels, onClose, onSave }: { channels: string[]; onClose: () => void; onSave: (channels: string[]) => void }) {
  const [draft, setDraft] = useState(channels);

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.length) return;
    const next = [...draft];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setDraft(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-[#edf0ef]" />
        <div className="flex items-center justify-between">
          <span className="h-9 w-9" />
          <h2 className="text-xl font-black text-[#DC143C]">จัดลำดับช่องทางชำระเงิน</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 place-items-center rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-[#8a928e]">กดขึ้น/ลง เพื่อเรียงช่องทางที่ใช้บ่อยไว้ก่อน</p>
        <div className="mt-5 space-y-2">
          {draft.map((channel, index) => (
            <div key={channel} className="flex items-center gap-3 rounded-md border border-black/10 bg-white p-3 shadow-sm">
              <GripVertical className="h-5 w-5 text-[#64748b]" />
              <span className="min-w-0 flex-1 truncate text-sm font-black">{channel}</span>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-md border border-black/10 px-2 py-1 text-xs font-black disabled:opacity-40">ขึ้น</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === draft.length - 1} className="rounded-md border border-black/10 px-2 py-1 text-xs font-black disabled:opacity-40">ลง</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onSave(draft)} className="mt-6 h-12 w-full rounded-md bg-[#DC143C] text-base font-black text-white">
          บันทึก
        </button>
      </div>
    </div>
  );
}

function SummaryProfileCard({ plan, profile }: { plan: UserPlan; profile: LineProfile }) {
  const planLabel = plan === "pro" ? "ผู้ใช้งานPro" : "ผู้ใช้งานฟรี";
  return (
    <section className="flex items-center gap-3 rounded-md border border-black/10 bg-white p-4 shadow-sm">
      <Image src={profile.picture_url ?? "/brand/moneytrack-pro.png"} alt={profile.display_name} width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized={Boolean(profile.picture_url)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-black">{profile.display_name}</p>
        <p className="mt-1 text-xs font-semibold text-[#8a928e]">{planLabel}</p>
      </div>
      <Image src="/brand/moneytrack-pro.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover opacity-80" />
    </section>
  );
}

function MetricBox({
  active = false,
  label,
  onClick,
  value,
  tone,
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
  value: number;
  tone: "expense" | "income";
}) {
  const classes = tone === "expense" ? "border-[#DC143C]/70 bg-[#fff3f5] text-[#DC143C]" : "border-[#6dc5ad]/80 bg-[#eef8f5] text-[#5fc8ba]";
  const activeClass = active ? "ring-2 ring-offset-2 " + (tone === "expense" ? "ring-[#DC143C]/30" : "ring-[#6dc5ad]/35") : "";
  return (
    <button type="button" onClick={onClick} className={`rounded-md border-2 p-3 text-left shadow-sm transition active:scale-[0.99] ${classes} ${activeClass}`}>
      <p className="text-xs font-bold text-[#55605b]">{label}</p>
      <p className="mt-2 truncate text-xl font-black">{formatBaht(value)}</p>
    </button>
  );
}

function SummaryExpandedChart({
  budgetLimit,
  categoryRows,
  focus,
  remainingBudget,
  spentInPeriod,
  streakDays,
  topCategory,
  transactionCount,
  usedPercent,
}: {
  budgetLimit: number;
  categoryRows: { budget: number; label: string; spent: number }[];
  focus: "expense" | "income";
  remainingBudget: number;
  spentInPeriod: number;
  streakDays: number;
  topCategory?: [string, number];
  transactionCount: number;
  usedPercent: number;
}) {
  const isIncome = focus === "income";
  const mainColor = isIncome ? "#6dc5ad" : "#d83286";
  const paleColor = isIncome ? "#dff4ef" : "#f7d4e4";
  const donutStyle = {
    background: `conic-gradient(${mainColor} ${usedPercent * 3.6}deg, ${paleColor} 0deg)`,
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-[150px_1fr] items-center gap-5">
        <div className="grid h-36 w-36 place-items-center rounded-full" style={donutStyle}>
          <div className="h-20 w-20 rounded-full bg-white" />
        </div>
        <dl className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#7a817d]">{isIncome ? "รายรับในรอบนี้" : "จดต่อเนื่องมา"}</dt>
            <dd className="font-black text-[#151b18]">{isIncome ? formatBaht(spentInPeriod) : `🔥 ${streakDays} วัน`}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#7a817d]">จำนวนรายการ</dt>
            <dd className="font-black text-[#151b18]">{transactionCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#7a817d]">{isIncome ? "หมวดสูงสุด" : "งบที่ตั้งไว้"}</dt>
            <dd className="font-black text-[#151b18]">{isIncome ? (topCategory?.[0] ?? "-") : budgetLimit > 0 ? formatBaht(budgetLimit) : "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#7a817d]">{isIncome ? "ยอดหมวดสูงสุด" : "งบคงเหลือ"}</dt>
            <dd className="font-black text-[#151b18]">{isIncome ? formatBaht(topCategory?.[1] ?? 0) : budgetLimit > 0 ? formatBaht(remainingBudget) : "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#7a817d]">{isIncome ? "รับแล้ว" : "ใช้ไปแล้ว"}</dt>
            <dd className="font-black text-[#151b18]">{formatBaht(spentInPeriod)}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4">
        {categoryRows.length > 0 ? categoryRows.map((row) => {
          const max = row.budget > 0 ? row.budget : Math.max(row.spent, 1);
          const width = row.spent > 0 ? Math.max(4, Math.min(100, (row.spent / max) * 100)) : 0;
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-3 text-sm font-black">
                <span>{row.label}</span>
                <span>{isIncome ? formatBaht(row.spent) : formatBudgetPair(row.spent, row.budget)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full" style={{ backgroundColor: paleColor }}>
                <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: mainColor }} />
              </div>
            </div>
          );
        }) : (
          <p className="rounded-md bg-[#f7f8f7] p-4 text-center text-sm font-semibold text-[#7a817d]">{isIncome ? "ยังไม่มีรายรับในรอบงบนี้" : "ยังไม่มีรายจ่ายในรอบงบนี้"}</p>
        )}
      </div>

      {topCategory && (
        <p className="text-center text-xs font-semibold text-[#7a817d]">
          {isIncome ? "หมวดรายรับสูงสุดคือ" : "หมวดที่ใช้เยอะสุดคือ"} <span className="font-black text-[#151b18]">{topCategory[0]}</span>
        </p>
      )}
    </div>
  );
}

type HistoryChartPoint = {
  label: string;
  tooltipTitle: string;
  income: number;
  expense: number;
};

function IncomeExpenseHistoryChart({
  budgetLimit,
  mode,
  transactions,
}: {
  budgetLimit: number;
  mode: "monthly" | "daily";
  transactions: Transaction[];
}) {
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const currentMonthKey = currentYear * 12 + currentMonthIndex;
  const [monthlyYear, setMonthlyYear] = useState(currentYear);
  const [dailyMonthKey, setDailyMonthKey] = useState(currentMonthKey);
  const dailyYear = Math.floor(dailyMonthKey / 12);
  const dailyMonthIndex = dailyMonthKey % 12;
  const points = mode === "daily" ? buildDailyHistoryPoints(transactions, dailyYear, dailyMonthIndex) : buildMonthlyHistoryPoints(transactions, monthlyYear);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePoint = activeIndex === null ? null : points[Math.min(activeIndex, points.length - 1)] ?? null;
  const tooltipLeft = activeIndex === null ? 0 : Math.min(70, Math.max(8, (activeIndex / Math.max(1, points.length - 1)) * 100 - 10));
  const max = Math.max(1, budgetLimit, ...points.flatMap((item) => [item.income, item.expense]));
  const budgetLineTop = budgetLimit > 0 ? Math.min(94, Math.max(6, 94 - (budgetLimit / max) * 88)) : null;
  const averageExpense = points.reduce((sum, item) => sum + item.expense, 0) / Math.max(1, points.length);
  const averageIncome = points.reduce((sum, item) => sum + item.income, 0) / Math.max(1, points.length);
  const rangeLabel = mode === "daily" ? dailyRangeLabel(points) : monthlyRangeLabel(points, monthlyYear);
  const canGoNextPeriod = mode === "monthly" ? monthlyYear < currentYear : dailyMonthKey < currentMonthKey;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          aria-label={mode === "monthly" ? "ปีก่อนหน้า" : "ช่วงก่อนหน้า"}
          onClick={() => {
            if (mode === "monthly") {
              setActiveIndex(null);
              setMonthlyYear((year) => year - 1);
            } else {
              setActiveIndex(null);
              setDailyMonthKey((monthKey) => monthKey - 1);
            }
          }}
          className="grid h-9 w-9 place-items-center rounded-full text-[#151b18] active:bg-[#f4f5f4]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-xs font-bold text-[#7a817d]">{rangeLabel}</p>
        <button
          type="button"
          aria-label={mode === "monthly" ? "ปีถัดไป" : "ช่วงถัดไป"}
          disabled={!canGoNextPeriod}
          onClick={() => {
            if (!canGoNextPeriod) return;
            if (mode === "monthly") {
              setActiveIndex(null);
              setMonthlyYear((year) => Math.min(currentYear, year + 1));
            } else {
              setActiveIndex(null);
              setDailyMonthKey((monthKey) => Math.min(currentMonthKey, monthKey + 1));
            }
          }}
          className={`grid h-9 w-9 place-items-center rounded-full active:bg-[#f4f5f4] ${canGoNextPeriod ? "text-[#151b18]" : "text-[#d8ddda]"}`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mt-4 min-h-0 flex-1 px-2 pb-7 pt-2" onPointerLeave={() => setActiveIndex(null)}>
        <div className="pointer-events-none absolute inset-x-2 top-2 h-[calc(100%-2rem)] rounded-sm">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#e8ecea]" />
          <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-[#e8ecea]" />
          <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-[#e8ecea]" />
          <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-[#e8ecea]" />
          {budgetLineTop !== null && (
            <div className="absolute inset-x-0 z-20" style={{ top: `${budgetLineTop}%` }}>
              <div className="border-t border-dashed border-[#151b18]" />
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 rounded-full bg-[#344055] px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                งบรายจ่าย ฿{formatBudgetAmount(budgetLimit)}
              </span>
            </div>
          )}
        </div>

        {mode === "daily" ? (
          <DailyHistoryLine points={points} max={max} activeIndex={activeIndex} onActivate={setActiveIndex} />
        ) : (
          <div className="relative z-10 flex h-full items-end justify-between gap-1">
            {points.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveIndex(index)}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerDown={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                className="relative flex h-full min-w-0 flex-1 touch-manipulation flex-col items-center justify-end gap-2 outline-none"
                aria-label={`${item.tooltipTitle} รายจ่าย ${formatBaht(item.expense)} รายรับ ${formatBaht(item.income)}`}
              >
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div className="w-2 rounded-t-md bg-[#DC143C] sm:w-3" style={{ height: item.expense > 0 ? `${Math.max(8, (item.expense / max) * 100)}%` : "0%" }} />
                  <div className="w-3 rounded-t-md bg-[#8bded7] sm:w-5" style={{ height: item.income > 0 ? `${Math.max(8, (item.income / max) * 100)}%` : "0%" }} />
                </div>
                <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-[#777f7b] sm:text-[11px]">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {activePoint && (
          <div
            className="pointer-events-none absolute top-6 z-20 min-w-36 rounded-md border border-black/10 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `${tooltipLeft}%` }}
          >
            <p className="font-bold text-[#151b18]">{activePoint.tooltipTitle}</p>
            <p className="mt-1 font-medium text-[#6b756f]">รายจ่าย: {formatBaht(activePoint.expense)}</p>
            <p className="mt-1 font-medium text-[#6b756f]">รายรับ: {formatBaht(activePoint.income)}</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-center gap-5 text-xs font-semibold">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#DC143C]" />รายจ่าย</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#6dc5ad]" />รายรับ</span>
      </div>
      <p className="mt-6 text-center text-xs font-medium text-[#8a928e]">เอานิ้วจิ้มบนกราฟเพื่อดูค่าได้เลย</p>
      <div className="mt-5 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-[11px] font-semibold text-[#555f5b]">รายจ่ายเฉลี่ยต่อ{mode === "daily" ? "วัน" : "เดือน"}</p>
          <p className="mt-1 text-lg font-bold text-[#DC143C]">{formatBaht(averageExpense)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-[#555f5b]">รายรับเฉลี่ยต่อ{mode === "daily" ? "วัน" : "เดือน"}</p>
          <p className="mt-1 text-lg font-bold text-[#6dc5ad]">{formatBaht(averageIncome)}</p>
        </div>
      </div>
    </div>
  );
}

function DailyHistoryLine({
  activeIndex,
  max,
  onActivate,
  points,
}: {
  activeIndex: number | null;
  max: number;
  onActivate: (index: number) => void;
  points: HistoryChartPoint[];
}) {
  const expensePath = linePoints(points.map((point) => point.expense), max);
  const incomePath = linePoints(points.map((point) => point.income), max);
  const activeX = activeIndex === null ? 0 : pointX(activeIndex, points.length);
  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;
  const activeValue = Math.max(activePoint?.income ?? 0, activePoint?.expense ?? 0);
  const activeY = 94 - (activeValue / max) * 88;

  return (
    <div className="relative z-10 h-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <polyline points={expensePath} fill="none" stroke="#DC143C" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
        <polyline points={incomePath} fill="none" stroke="#8bded7" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
        {activePoint && <circle cx={activeX} cy={activeY} r="1.2" fill="#151b18" stroke="#8bded7" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onActivate(index)}
            onPointerEnter={() => onActivate(index)}
            onPointerDown={() => onActivate(index)}
            onFocus={() => onActivate(index)}
            className="touch-manipulation outline-none"
            aria-label={`${item.tooltipTitle} รายจ่าย ${formatBaht(item.expense)} รายรับ ${formatBaht(item.income)}`}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 -bottom-7 flex justify-between text-[10px] font-medium text-[#777f7b] sm:text-[11px]">
        {dailyTickLabels(points.length).map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
    </div>
  );
}

function buildMonthlyHistoryPoints(transactions: Transaction[], year: number): HistoryChartPoint[] {
  const now = new Date();
  const lastMonthIndex = year === now.getFullYear() ? now.getMonth() : 11;
  const points = Array.from({ length: lastMonthIndex + 1 }, (_, monthIndex) => {
    const label = thaiMonthName(monthIndex);
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return {
      label,
      tooltipTitle: `1 ${label} - ${lastDay} ${label} ${year + 543}`,
      income: 0,
      expense: 0,
    };
  });

  for (const transaction of transactions) {
    const parsed = parseLocalDate(transaction.date);
    if (!parsed || parsed.getFullYear() !== year) continue;
    const point = points[parsed.getMonth()];
    if (!point) continue;
    if (transaction.type === "income") point.income += transaction.amount;
    if (transaction.type === "expense") point.expense += transaction.amount;
  }

  return points;
}

function buildDailyHistoryPoints(transactions: Transaction[], year: number, month: number): HistoryChartPoint[] {
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month + 1, 0).getDate();
  const points = Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      label: String(day),
      tooltipTitle: `${day} ${thaiMonthName(month)} ${year + 543}`,
      income: 0,
      expense: 0,
      dateKey,
    };
  });

  for (const transaction of transactions) {
    const parsed = parseLocalDate(transaction.date);
    if (!parsed || parsed.getFullYear() !== year || parsed.getMonth() !== month) continue;
    const point = points[parsed.getDate() - 1];
    if (!point) continue;
    if (transaction.type === "income") point.income += transaction.amount;
    if (transaction.type === "expense") point.expense += transaction.amount;
  }

  return points;
}

function dailyRangeLabel(points: HistoryChartPoint[]) {
  const title = points[0]?.tooltipTitle ?? "";
  const parts = title.split(" ");
  return parts.length >= 3 ? `${parts[1]} ${parts[2]}` : "รายวัน";
}

function monthlyRangeLabel(points: HistoryChartPoint[], year: number) {
  const first = points[0]?.label ?? "ม.ค.";
  const last = points[points.length - 1]?.label ?? "ธ.ค.";
  return `${first} - ${last} ${String(year + 543).slice(-2)}`;
}

function dailyTickLabels(days: number) {
  if (days <= 7) {
    return Array.from({ length: days }, (_, index) => index + 1);
  }

  const labels = Array.from({ length: Math.floor((days - 1) / 3) + 1 }, (_, index) => index * 3 + 1);
  if (labels[labels.length - 1] !== days) labels.push(days);
  return labels;
}

function summaryCategoryRows(spentByCategory: Record<string, number>, budgets: Record<string, number>) {
  const labels = Array.from(new Set([...expenseCategories, ...Object.keys(budgets), ...Object.keys(spentByCategory)]));
  return labels
    .map((label) => ({
      label,
      spent: spentByCategory[label] ?? 0,
      budget: budgets[label] ?? 0,
    }))
    .filter((row) => row.spent > 0 || row.budget > 0)
    .sort((a, b) => (b.spent || b.budget) - (a.spent || a.budget))
    .slice(0, 6);
}

function summaryIncomeRows(incomeByCategory: Record<string, number>) {
  return Object.entries(incomeByCategory)
    .map(([label, spent]) => ({ label, spent, budget: 0 }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);
}

function formatBudgetPair(spent: number, budget: number) {
  if (budget > 0) return `${formatBaht(spent)} / ${formatBudgetAmount(budget)}`;
  return `${formatBaht(spent)} / -`;
}

function linePoints(values: number[], max: number) {
  return values.map((value, index) => `${pointX(index, values.length)},${94 - (value / max) * 88}`).join(" ");
}

function pointX(index: number, length: number) {
  return length <= 1 ? 0 : (index / (length - 1)) * 100;
}

function thaiMonthName(monthIndex: number) {
  return ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][monthIndex] ?? "ม.ค.";
}

const expensePieColors = ["#DC143C", "#F06292", "#7B1E3A", "#6DC5AD", "#FFD335", "#344055", "#9AA1A0"];

function ExpenseCategoryDonut({ categories }: { categories: { category: string; amount: number }[] }) {
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  const slices = categories.slice(0, 7).map((item, index) => ({
    name: displayCategory(item.category, "expense"),
    value: item.amount,
    color: expensePieColors[index % expensePieColors.length],
  }));
  const top = slices[0];

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-[190px_1fr] sm:items-center">
      <div className="relative mx-auto h-52 w-full max-w-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="82%" paddingAngle={2} stroke="#FFFFFF" strokeWidth={3}>
              {slices.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${formatBaht(Number(value))} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`, name]}
              contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] font-bold text-[#8a928e]">รวมรายจ่าย</p>
            <p className="text-lg font-black text-[#151b18]">{formatBaht(total)}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {top && (
          <div className="rounded-md border border-[#F5C6D0] bg-[#FCECEF] p-3">
            <p className="text-xs font-bold text-[#8a5260]">หมวดที่ใช้เยอะสุด</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-base font-black text-[#151b18]">{top.name}</p>
              <p className="text-lg font-black text-[#DC143C]">{formatBaht(top.value)}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {slices.slice(0, 6).map((item) => (
            <div key={item.name} className="flex min-w-0 items-center gap-2 rounded-md bg-[#f7f8f7] px-2 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#555f5b]">{item.name}</span>
              <span className="text-xs font-black text-[#151b18]">{total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ExpenseComparison = {
  currentExpense: number;
  previousExpense: number;
  change: number;
  changePercent: number;
  transactionCount: number;
  averagePerTransaction: number;
};

function buildExpenseComparison(transactions: Transaction[]): ExpenseComparison {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const currentExpenses = transactions.filter((transaction) => {
    const parsed = parseLocalDate(transaction.date);
    return transaction.type === "expense" && parsed !== null && parsed >= currentMonthStart && parsed < nextMonthStart;
  });
  const previousExpenses = transactions.filter((transaction) => {
    const parsed = parseLocalDate(transaction.date);
    return transaction.type === "expense" && parsed !== null && parsed >= previousMonthStart && parsed < currentMonthStart;
  });

  const currentExpense = currentExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const previousExpense = previousExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const change = currentExpense - previousExpense;

  return {
    currentExpense,
    previousExpense,
    change,
    changePercent: previousExpense > 0 ? (change / previousExpense) * 100 : 0,
    transactionCount: currentExpenses.length,
    averagePerTransaction: currentExpenses.length > 0 ? currentExpense / currentExpenses.length : 0,
  };
}

function ExpenseComparePanel({ comparison }: { comparison: ExpenseComparison }) {
  const isHigher = comparison.change > 0;
  const changeLabel = comparison.previousExpense > 0 ? `${isHigher ? "+" : ""}${comparison.changePercent.toFixed(1)}%` : "เดือนแรก";

  return (
    <div className="mt-5">
      <h3 className="text-base font-black text-[#151b18]">เทียบรายจ่าย</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ExpenseCompareCard label="เดือนนี้" value={comparison.currentExpense} helper={`${comparison.transactionCount} รายการ`} tone="primary" />
        <ExpenseCompareCard label="เดือนก่อน" value={comparison.previousExpense} helper={comparison.previousExpense > 0 ? `ต่าง ${formatBaht(Math.abs(comparison.change))}` : "ยังไม่มีข้อมูล"} tone="muted" />
        <ExpenseCompareCard label="การเปลี่ยนแปลง" textValue={changeLabel} helper={isHigher ? "ใช้มากขึ้น" : comparison.change < 0 ? "ใช้ลดลง" : "ใกล้เคียงเดิม"} tone={isHigher ? "danger" : "good"} />
        <ExpenseCompareCard label="เฉลี่ยต่อรายการ" value={comparison.averagePerTransaction} helper="ดูความหนักของแต่ละจ่าย" tone="muted" />
      </div>
    </div>
  );
}

function ExpenseCompareCard({
  helper,
  label,
  textValue,
  tone,
  value,
}: {
  helper: string;
  label: string;
  textValue?: string;
  tone: "primary" | "muted" | "danger" | "good";
  value?: number;
}) {
  const toneClass = {
    primary: "border-[#F5C6D0] bg-[#FCECEF] text-[#DC143C]",
    muted: "border-black/10 bg-white text-[#151b18]",
    danger: "border-[#F5C6D0] bg-[#FCECEF] text-[#DC143C]",
    good: "border-[#c9eee5] bg-[#EAF8F4] text-[#0d4a2b]",
  }[tone];
  return (
    <div className={`rounded-md border p-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-bold text-[#6b756f]">{label}</p>
      <p className="mt-1 truncate text-lg font-black">{textValue ?? formatBaht(value ?? 0)}</p>
      <p className="mt-1 min-h-8 text-[11px] font-semibold leading-snug text-[#7a817d]">{helper}</p>
    </div>
  );
}

type SavingsInsight = {
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  targetSavings: number;
  targetPercent: number;
  projectedSavings: number;
  daysPassed: number;
  daysInMonth: number;
  topExpenseCategory: string;
  topExpenseAmount: number;
  summary: string;
  riskTone: "good" | "warning" | "danger";
  actions: string[];
};

function buildSavingsInsight(transactions: Transaction[]): SavingsInsight {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = Math.max(1, now.getDate());
  const categoryTotals: Record<string, number> = {};
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    const parsed = parseLocalDate(transaction.date);
    if (!parsed || parsed < monthStart || parsed >= nextMonthStart) continue;
    if (transaction.type === "income") {
      income += transaction.amount;
      continue;
    }
    expense += transaction.amount;
    const category = displayCategory(transaction.category, "expense");
    categoryTotals[category] = (categoryTotals[category] ?? 0) + transaction.amount;
  }

  const savings = income - expense;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const targetSavings = income * 0.2;
  const targetPercent = targetSavings > 0 ? Math.min(100, Math.max(0, (Math.max(0, savings) / targetSavings) * 100)) : 0;
  const projectedSavings = (savings / daysPassed) * daysInMonth;
  const [topExpenseCategory = "-", topExpenseAmount = 0] = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] ?? [];

  let riskTone: SavingsInsight["riskTone"] = "good";
  let summary = "เดือนนี้เงินออมอยู่ในเกณฑ์ดี รักษาจังหวะรายจ่ายแบบนี้ต่อได้";
  if (savings < 0) {
    riskTone = "danger";
    summary = "เดือนนี้ยังไม่เหลือออม เพราะรายจ่ายสูงกว่ารายรับ ควรชะลอรายจ่ายที่ไม่จำเป็นก่อน";
  } else if (savingsRate < 10) {
    riskTone = "danger";
    summary = "อัตราออมยังต่ำกว่า 10% ควรตั้งเป้าลดรายจ่ายบางหมวดเพื่อให้มีเงินเหลือจริง";
  } else if (savingsRate < 20) {
    riskTone = "warning";
    summary = "เริ่มมีเงินออมแล้ว แต่ยังต่ำกว่าเป้าหมาย 20% ลองเพิ่มช่องว่างระหว่างรายรับกับรายจ่ายอีกเล็กน้อย";
  }

  const actions = [
    topExpenseAmount > 0
      ? `ถ้าลดหมวด ${topExpenseCategory} ลง 10% จะออมเพิ่มได้ประมาณ ${formatBaht(topExpenseAmount * 0.1)}`
      : "เริ่มจดรายจ่ายให้ครบก่อน ระบบจะหาโอกาสออมให้แม่นขึ้น",
    targetSavings > savings
      ? `ยังขาดจากเป้าออมประมาณ ${formatBaht(Math.max(0, targetSavings - Math.max(0, savings)))}`
      : "เดือนนี้แตะเป้าออม 20% แล้ว ลองกันเงินส่วนนี้ไว้ก่อนใช้จ่ายเพิ่ม",
  ];

  return {
    income,
    expense,
    savings,
    savingsRate,
    targetSavings,
    targetPercent,
    projectedSavings,
    daysPassed,
    daysInMonth,
    topExpenseCategory,
    topExpenseAmount,
    summary,
    riskTone,
    actions,
  };
}

function SavingsInsightPanel({ insight }: { insight: SavingsInsight }) {
  const donutColor = insight.riskTone === "good" ? "#6dc5ad" : insight.riskTone === "warning" ? "#f59e0b" : "#DC143C";
  const savingsPositive = insight.savings >= 0;
  const projectedPositive = insight.projectedSavings >= 0;

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#8a928e]">Savings Insight</p>
            <h2 className="mt-1 text-xl font-black">วิเคราะห์เงินออม</h2>
          </div>
          <span className="rounded-md bg-[#eaf8f4] px-2 py-1 text-xs font-black text-[#0d4a2b]">เป้า 20%</span>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
          <div className="mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(${donutColor} ${insight.targetPercent}%, #edf0ef 0)` }}>
            <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center shadow-inner">
              <div>
                <p className="text-3xl font-black" style={{ color: donutColor }}>{Math.round(insight.targetPercent)}%</p>
                <p className="mt-1 text-xs font-bold text-[#8a928e]">ของเป้าออม</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SavingsMetric label="ออมเดือนนี้" value={formatBaht(insight.savings)} tone={savingsPositive ? "good" : "danger"} />
            <SavingsMetric label="เป้าหมายออม" value={formatBaht(insight.targetSavings)} tone="muted" />
            <SavingsMetric label="อัตราออม" value={`${Math.round(insight.savingsRate)}%`} tone={insight.savingsRate >= 20 ? "good" : insight.savingsRate >= 10 ? "warning" : "danger"} />
            <SavingsMetric label="คาดการณ์สิ้นเดือน" value={formatBaht(insight.projectedSavings)} tone={projectedPositive ? "good" : "danger"} />
          </div>
        </div>
      </section>

      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <h3 className="text-base font-black">สรุปเงินออม</h3>
        <p className="mt-3 rounded-md bg-[#f7f8f7] p-3 text-sm font-semibold leading-6 text-[#4f5b56]">{insight.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-black/10 p-3">
            <p className="text-xs font-bold text-[#8a928e]">รายรับเดือนนี้</p>
            <p className="mt-1 font-black text-[#0d4a2b]">{formatBaht(insight.income)}</p>
          </div>
          <div className="rounded-md border border-black/10 p-3">
            <p className="text-xs font-bold text-[#8a928e]">รายจ่ายเดือนนี้</p>
            <p className="mt-1 font-black text-[#DC143C]">{formatBaht(insight.expense)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <h3 className="text-base font-black">โอกาสเพิ่มเงินออม</h3>
        <div className="mt-3 space-y-2">
          {insight.actions.map((action) => (
            <div key={action} className="rounded-md border border-[#d9eee8] bg-[#f6fcfa] p-3 text-sm font-semibold leading-6 text-[#315c51]">
              {action}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-[#8a928e]">คำนวณจากข้อมูลเดือนนี้ {insight.daysPassed}/{insight.daysInMonth} วัน</p>
      </section>
    </div>
  );
}

function SavingsMetric({ label, value, tone }: { label: string; value: string; tone: "good" | "warning" | "danger" | "muted" }) {
  const toneClass = {
    good: "border-[#c9eee5] bg-[#EAF8F4] text-[#0d4a2b]",
    warning: "border-[#fde6b5] bg-[#fff8e8] text-[#a16207]",
    danger: "border-[#f5c6d0] bg-[#FCECEF] text-[#DC143C]",
    muted: "border-black/10 bg-white text-[#151b18]",
  }[tone];
  return (
    <div className={`min-h-20 rounded-md border p-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-bold text-[#6b756f]">{label}</p>
      <p className="mt-2 truncate text-lg font-black">{value}</p>
    </div>
  );
}

function TransactionList({ transactions, onEdit }: { transactions: Transaction[]; onEdit: (transaction: Transaction) => void }) {
  return (
    <div className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm">
      {transactions.map((transaction) => (
        <button key={transaction.id} type="button" onClick={() => onEdit(transaction)} className="flex w-full items-center justify-between gap-3 border-b border-black/5 px-4 py-3 text-left last:border-b-0 active:bg-[#f7f8f7]">
          <div className="min-w-0">
            <p className="truncate text-base font-black">{transaction.description || transaction.category}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[#8a928e]">{transaction.date} · {displayCategory(transaction.category, transaction.type)}</p>
          </div>
          <p className={`shrink-0 text-base font-black ${transaction.type === "income" ? "text-[#0d4a2b]" : "text-[#DC143C]"}`}>
            {transaction.type === "income" ? "+" : "-"}{formatBaht(transaction.amount)}
          </p>
        </button>
      ))}
    </div>
  );
}

function SummaryTransactionList({ transactions, onEdit }: { transactions: Transaction[]; onEdit: (transaction: Transaction) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#8a928e]">{formatThaiShortDate(transactions[0]?.date)}</p>
      <div className="space-y-2 border-t border-black/10 pt-2">
        {transactions.map((transaction) => (
          <button key={transaction.id} type="button" onClick={() => onEdit(transaction)} className="flex w-full items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-4 py-3 text-left shadow-sm active:bg-[#f7f8f7]">
            <div className="min-w-0">
              <p className="truncate text-base font-black">{transaction.description || transaction.category}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8a928e]">{formatTimeFallback(transaction.date)}</span>
                <span className="rounded-md bg-[#f0f2f1] px-2 py-1 text-xs font-black text-[#6b756f]">{displayCategory(transaction.category, transaction.type)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className={`text-sm font-black ${transaction.type === "income" ? "text-[#10b95f]" : "text-[#DC143C]"}`}>
                {transaction.type === "income" ? "+" : "-"}{formatBaht(transaction.amount)}
              </p>
              <ChevronRight className="h-4 w-4 text-[#9aa1a0]" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransactionCreateModal({
  lineUserId,
  onClose,
  onCreated,
}: {
  lineUserId: string;
  onClose: () => void;
  onCreated: (transaction: Transaction) => void;
}) {
  const [draft, setDraft] = useState<TransactionInput>({
    date: todayInputValue(),
    type: "expense",
    amount: 0,
    category: transactionCategories("expense")[0] ?? "อื่นๆ",
    description: "",
    mode: "personal",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const categories = ensureCategoryOption(transactionCategories(draft.type), draft.category);

  async function save() {
    if (!draft.description.trim() || Number(draft.amount) <= 0) {
      setError("กรอกรายละเอียดและจำนวนเงินก่อนบันทึก");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created = await createTransaction({
        ...draft,
        amount: Number(draft.amount),
        description: draft.description.trim(),
      }, lineUserId || undefined);
      onCreated(created);
    } catch {
      setError("เพิ่มรายการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">เพิ่มรายการ</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-10 w-10 place-items-center rounded-md border border-black/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="block">
            <span className="text-base font-black">รายละเอียด</span>
            <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="เช่น ข้าวมันไก่" className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
          </label>

          <section>
            <p className="text-base font-black">ประเภทรายการ</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDraft({ ...draft, type: "expense", category: transactionCategories("expense")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#F5C6D0] bg-white text-[#DC143C]"}`}>
                รายจ่าย
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, type: "income", category: transactionCategories("income")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#0d4a2b]"}`}>
                รายรับ
              </button>
            </div>
          </section>

          <label className="block">
            <span className="text-base font-black">หมวด</span>
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-base font-black">จำนวนเงิน</span>
            <div className="mt-2 flex items-center gap-3">
              <input type="number" min="1" value={draft.amount || ""} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} placeholder="0" className="h-11 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
              <span className="font-bold text-[#6b7280]">฿</span>
            </div>
          </label>

          <label className="block">
            <span className="text-base font-black">วันที่</span>
            <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
          </label>

          {error && <p className="rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

          <button type="submit" disabled={saving} className="h-12 w-full rounded-md bg-[#6DC5AD] text-base font-black text-[#082f24] disabled:opacity-60">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TransactionEditModal({
  lineUserId,
  transaction,
  onClose,
  onDeleted,
  onSaved,
}: {
  lineUserId: string;
  transaction: Transaction;
  onClose: () => void;
  onDeleted: (transactionId: number) => void;
  onSaved: (transaction: Transaction) => void;
}) {
  const [draft, setDraft] = useState<Transaction>(() => ({ ...transaction, category: displayCategory(transaction.category, transaction.type) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const categories = ensureCategoryOption(transactionCategories(draft.type), draft.category);

  async function save() {
    setSaving(true);
    setError("");
    const payload: TransactionInput = {
      date: draft.date,
      type: draft.type,
      amount: Number(draft.amount),
      category: draft.category,
      description: draft.description,
      mode: draft.mode,
    };

    try {
      const updated = await updateTransaction(draft.id, payload, lineUserId || undefined);
      onSaved(updated);
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError("");
    try {
      await deleteTransaction(draft.id, lineUserId || undefined);
      onDeleted(draft.id);
    } catch {
      setError("ลบรายการไม่สำเร็จ");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 pt-12">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-md bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">แก้ไขรายการ</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirmingDelete(true)} disabled={saving} aria-label="ลบรายการ" className="grid h-10 w-10 place-items-center rounded-md bg-[#DC143C] text-white disabled:opacity-60">
              <Trash2 className="h-5 w-5" />
            </button>
            <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-10 w-10 place-items-center rounded-md border border-black/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="block">
            <span className="text-base font-black">รายละเอียด</span>
            <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
          </label>

          <section>
            <p className="text-base font-black">ประเภทรายการ</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDraft({ ...draft, type: "expense", category: transactionCategories("expense")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#F5C6D0] bg-white text-[#DC143C]"}`}>
                รายจ่าย
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, type: "income", category: transactionCategories("income")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#0d4a2b]"}`}>
                รายรับ
              </button>
            </div>
          </section>

          <label className="block">
            <span className="text-base font-black">หมวด</span>
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]">
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-base font-black">จำนวนเงิน</span>
            <div className="mt-2 flex items-center gap-3">
              <input type="number" min="1" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} className="h-11 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
              <span className="font-bold text-[#6b7280]">฿</span>
            </div>
          </label>

          <label className="block">
            <span className="text-base font-black">วันที่</span>
            <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]" />
          </label>

          {error && <p className="rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

          <button type="submit" disabled={saving} className="h-12 w-full rounded-md bg-[#6DC5AD] text-base font-black text-[#082f24] disabled:opacity-60">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </div>
      {confirmingDelete && (
        <ConfirmDeleteDialog
          title="ยืนยันการลบรายการ"
          body="คุณต้องการลบรายการนี้ใช่หรือไม่?"
          confirmLabel="ลบรายการ"
          confirming={saving}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  body,
  confirmLabel,
  confirming = false,
  onCancel,
  onConfirm,
  title,
}: {
  body: string;
  confirmLabel: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-5">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" className="w-full max-w-md rounded-md bg-white p-6 shadow-2xl">
        <h3 id="confirm-delete-title" className="text-lg font-black text-[#151b18]">{title}</h3>
        <p className="mt-3 text-sm font-semibold text-[#6b7280]">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={confirming} className="h-10 rounded-md border border-black/10 bg-white px-5 text-sm font-black text-[#151b18] shadow-sm disabled:opacity-60">
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm} disabled={confirming} className="h-10 rounded-md bg-[#DC143C] px-5 text-sm font-black text-white shadow-sm disabled:opacity-60">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, action, actionHref }: { title: string; action: string; actionHref: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-black">{title}</h2>
      <Link href={actionHref} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-black text-[#55605b] shadow-sm">
        {action}
      </Link>
    </div>
  );
}

function Segmented({ first, second, active, onFirst, onSecond }: { first: string; second: string; active: "first" | "second"; onFirst?: () => void; onSecond?: () => void }) {
  return (
    <div className="grid grid-cols-2 rounded-md bg-[#eef1ef] p-1">
      <button type="button" onClick={onFirst} className={`h-10 rounded-md text-sm font-black ${active === "first" ? "bg-white text-[#151b18] shadow-sm" : "text-[#7f8884]"}`}>
        {first}
      </button>
      <button type="button" onClick={onSecond} className={`h-10 rounded-md text-sm font-black ${active === "second" ? "bg-white text-[#151b18] shadow-sm" : "text-[#7f8884]"}`}>
        {second}
      </button>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#cbd5d1] bg-white px-5 py-7 text-center">
      <WalletCards className="mx-auto h-10 w-10 text-[#6dc5ad]" />
      <p className="mt-3 text-base font-black text-[#555f5b]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#8a928e]">{body}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#6dc5ad]" />
        <p className="mt-3 text-lg font-black text-[#555f5b]">กำลังโหลดข้อมูล</p>
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: LiffTab }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 grid h-20 w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-black/10 bg-white">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <Link key={tab.id} href={tab.href} className={`flex flex-col items-center justify-center gap-1 text-xs font-black ${isActive ? "text-[#0d4a2b]" : "text-[#9aa1a0]"}`}>
            <Icon className="h-6 w-6" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function dailyReminderStorageKey(lineUserId?: string) {
  return lineUserId ? `moneytrack_daily_reminder_${lineUserId}` : "moneytrack_daily_reminder";
}

function loadStoredDailyReminderSettings(lineUserId?: string): DailyReminderSettingsInput {
  const fallback: DailyReminderSettingsInput = { enabled: false, reminder_time: "18:00", reminder_mode: "missing_only" };
  if (typeof window === "undefined") return fallback;
  try {
    const value = JSON.parse(window.localStorage.getItem(dailyReminderStorageKey(lineUserId)) ?? "null");
    if (
      value &&
      typeof value.enabled === "boolean" &&
      typeof value.reminder_time === "string" &&
      /^\d{2}:\d{2}$/.test(value.reminder_time) &&
      (value.reminder_mode === "missing_only" || value.reminder_mode === "daily")
    ) {
      return value;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function saveStoredDailyReminderSettings(lineUserId: string | undefined, value: DailyReminderSettingsInput) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(dailyReminderStorageKey(lineUserId), JSON.stringify(value));
  }
}

function paymentChannelStorageKey(lineUserId?: string) {
  return lineUserId ? `moneytrack_payment_channels_${lineUserId}` : "moneytrack_payment_channels";
}

function loadStoredPaymentChannelSettings(lineUserId?: string): PaymentChannelSettings {
  const fallback: PaymentChannelSettings = { enabled: false, channels: [] };
  if (typeof window === "undefined") return fallback;
  try {
    const value = JSON.parse(window.localStorage.getItem(paymentChannelStorageKey(lineUserId)) ?? "null");
    if (
      value &&
      typeof value.enabled === "boolean" &&
      Array.isArray(value.channels) &&
      value.channels.every((channel: unknown) => typeof channel === "string")
    ) {
      return {
        enabled: value.enabled,
        channels: value.channels.map((channel: string) => channel.trim()).filter(Boolean).slice(0, 10),
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function saveStoredPaymentChannelSettings(lineUserId: string | undefined, value: PaymentChannelSettings) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(paymentChannelStorageKey(lineUserId), JSON.stringify(value));
  }
}

function currencyStorageKey(lineUserId?: string) {
  return lineUserId ? `moneytrack_currency_${lineUserId}` : "moneytrack_currency";
}

function loadStoredCurrencySetting(lineUserId?: string): CurrencySetting {
  if (typeof window === "undefined") return currencyOptions[0];
  const storedCode = window.localStorage.getItem(currencyStorageKey(lineUserId));
  return currencyOptions.find((currency) => currency.code === storedCode) ?? currencyOptions[0];
}

function loadActiveCurrencySetting(): CurrencySetting {
  if (typeof window === "undefined") return currencyOptions[0];
  const storedCode = window.localStorage.getItem("moneytrack_active_currency");
  return currencyOptions.find((currency) => currency.code === storedCode) ?? currencyOptions[0];
}

function saveStoredCurrencySetting(lineUserId: string | undefined, value: CurrencySetting) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(currencyStorageKey(lineUserId), value.code);
    window.localStorage.setItem("moneytrack_active_currency", value.code);
  }
}

function languageStorageKey(lineUserId?: string) {
  return lineUserId ? `moneytrack_language_${lineUserId}` : "moneytrack_language";
}

function loadStoredLanguageSetting(lineUserId?: string): LanguageCode {
  if (typeof window === "undefined") return "th";
  const value = window.localStorage.getItem(languageStorageKey(lineUserId));
  return value === "en" ? "en" : "th";
}

function saveStoredLanguageSetting(lineUserId: string | undefined, value: LanguageCode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(languageStorageKey(lineUserId), value);
  }
}

function timezoneStorageKey(lineUserId?: string) {
  return lineUserId ? `moneytrack_timezone_${lineUserId}` : "moneytrack_timezone";
}

function findTimezone(value: string | null): TimezoneSetting {
  return timezoneOptions.find((timezone) => timezone.value === value) ?? timezoneOptions.find((timezone) => timezone.value === "Asia/Bangkok") ?? timezoneOptions[0];
}

function loadStoredTimezoneSetting(lineUserId?: string): TimezoneSetting {
  if (typeof window === "undefined") return findTimezone("Asia/Bangkok");
  return findTimezone(window.localStorage.getItem(timezoneStorageKey(lineUserId)));
}

function loadActiveTimezoneSetting(): TimezoneSetting {
  if (typeof window === "undefined") return findTimezone("Asia/Bangkok");
  return findTimezone(window.localStorage.getItem("moneytrack_active_timezone"));
}

function saveStoredTimezoneSetting(lineUserId: string | undefined, value: TimezoneSetting) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(timezoneStorageKey(lineUserId), value.value);
    window.localStorage.setItem("moneytrack_active_timezone", value.value);
  }
}

function recurringStorageKey(lineUserId?: string) {
  return lineUserId ? `moneytrack_recurring_items_${lineUserId}` : "moneytrack_recurring_items";
}

function loadStoredRecurringItems(lineUserId?: string): RecurringItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(recurringStorageKey(lineUserId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RecurringItem => {
      return (
        item &&
        (typeof item.id === "string" || typeof item.id === "number") &&
        (item.type === "income" || item.type === "expense") &&
        typeof item.amount === "number" &&
        typeof item.category === "string" &&
        typeof item.description === "string" &&
        (item.interval === "daily" || item.interval === "weekly" || item.interval === "monthly" || item.interval === "yearly") &&
        typeof item.notifyTime === "string"
      );
    });
  } catch {
    return [];
  }
}

function saveStoredRecurringItems(lineUserId: string | undefined, value: RecurringItem[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(recurringStorageKey(lineUserId), JSON.stringify(value));
  }
}

function apiRecurringToItem(item: {
  id: number;
  type: "expense" | "income";
  amount: number;
  category: string;
  description: string;
  mode: "personal" | "business";
  interval: RecurringInterval;
  day_of_week?: number | null;
  day_of_month?: number | null;
  month?: number | null;
  notify_time: string;
}): RecurringItem {
  return {
    id: item.id,
    type: item.type,
    amount: item.amount,
    category: item.category,
    description: item.description,
    mode: item.mode,
    interval: item.interval,
    dayOfWeek: item.day_of_week ?? undefined,
    dayOfMonth: item.day_of_month ?? undefined,
    month: item.month ?? undefined,
    notifyTime: item.notify_time,
  };
}

function itemToApiRecurringInput(item: RecurringItem): RecurringTransactionInput {
  return {
    type: item.type,
    amount: item.amount,
    category: item.category,
    description: item.description,
    mode: item.mode,
    interval: item.interval,
    day_of_week: item.interval === "weekly" ? item.dayOfWeek ?? 0 : null,
    day_of_month: item.interval === "monthly" || item.interval === "yearly" ? item.dayOfMonth ?? 1 : null,
    month: item.interval === "yearly" ? item.month ?? 1 : null,
    notify_time: item.notifyTime,
  };
}

function recurringItemOccursOn(item: RecurringItem, date: Date) {
  if (item.interval === "daily") return true;
  if (item.interval === "weekly") return item.dayOfWeek === date.getDay();
  if (item.interval === "monthly") return item.dayOfMonth === date.getDate();
  return item.month === date.getMonth() + 1 && item.dayOfMonth === date.getDate();
}

function recurringLabel(item: RecurringItem) {
  if (item.interval === "daily") return "ทุกวัน";
  if (item.interval === "weekly") {
    const day = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"][item.dayOfWeek ?? 0];
    return `ทุกวัน${day}`;
  }
  if (item.interval === "monthly") return `ทุกเดือน วันที่ ${item.dayOfMonth ?? 1}`;
  const monthLabel = new Date(2026, (item.month ?? 1) - 1, 1).toLocaleDateString("th-TH", { month: "short" });
  return `ทุกปี ${item.dayOfMonth ?? 1} ${monthLabel}`;
}

function loadStoredUserPlan(): UserPlan {
  if (typeof window === "undefined") return "free";
  return window.localStorage.getItem("moneytrack_user_plan") === "pro" ? "pro" : "free";
}

function loadStoredBudgetMode(): BudgetMode {
  if (typeof window === "undefined") return "category";
  return window.localStorage.getItem("moneytrack_budget_mode") === "total" ? "total" : "category";
}

function loadStoredExpenseCategories(): string[] {
  if (typeof window === "undefined") return expenseCategories;
  try {
    const value = JSON.parse(window.localStorage.getItem("moneytrack_expense_categories") ?? "null");
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : expenseCategories;
  } catch {
    return expenseCategories;
  }
}

function loadStoredIncomeCategories(): string[] {
  if (typeof window === "undefined") return incomeCategories;
  try {
    const value = JSON.parse(window.localStorage.getItem("moneytrack_income_categories") ?? "null");
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : incomeCategories;
  } catch {
    return incomeCategories;
  }
}

function saveStoredExpenseCategories(value: string[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_expense_categories", JSON.stringify(value));
  }
}

function saveStoredIncomeCategories(value: string[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_income_categories", JSON.stringify(value));
  }
}

function transactionCategories(type: "expense" | "income") {
  return type === "income" ? loadStoredIncomeCategories() : loadStoredExpenseCategories();
}

function ensureCategoryOption(categories: string[], category: string) {
  return categories.includes(category) ? categories : [...categories, category];
}

function displayCategory(category: string, type: "expense" | "income") {
  const mapped = categoryNameMap[category] ?? category;
  const defaults = type === "income" ? incomeCategories : expenseCategories;
  const stored = transactionCategories(type);
  if (stored.includes(mapped)) return mapped;

  const defaultIndex = defaults.indexOf(mapped);
  if (defaultIndex >= 0 && stored[defaultIndex]) {
    return stored[defaultIndex];
  }

  return mapped;
}

function saveStoredBudgetMode(value: BudgetMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_budget_mode", value);
  }
}

function loadStoredBudgetCycle(): BudgetCycle {
  if (typeof window === "undefined") return "monthly";
  const value = window.localStorage.getItem("moneytrack_budget_cycle");
  return value === "daily" || value === "weekly" || value === "monthly" ? value : "monthly";
}

function saveStoredBudgetCycle(value: BudgetCycle) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_budget_cycle", value);
  }
}

function loadStoredBudgetStartDay() {
  if (typeof window === "undefined") return 1;
  const value = Number(window.localStorage.getItem("moneytrack_budget_start_day") ?? 1);
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : 1;
}

function saveStoredBudgetStartDay(value: number) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_budget_start_day", String(value));
  }
}

function loadStoredExpenseBudgets(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem("moneytrack_expense_budgets") ?? "{}");
    return typeof value === "object" && value !== null ? value : {};
  } catch {
    return {};
  }
}

function saveStoredExpenseBudgets(value: Record<string, number>) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_expense_budgets", JSON.stringify(value));
  }
}

function loadStoredTotalBudget() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem("moneytrack_total_budget") ?? 0) || 0;
}

function saveStoredTotalBudget(value: number) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("moneytrack_total_budget", String(value));
  }
}

async function syncLineBudgetSettings({
  profile,
  expenseCategories,
  incomeCategories,
  budgetMode,
  budgetCycle = loadStoredBudgetCycle(),
  budgetStartDay = loadStoredBudgetStartDay(),
  expenseBudgets,
  totalBudget,
}: {
  profile: LineProfile;
  expenseCategories: string[];
  incomeCategories: string[];
  budgetMode: BudgetMode;
  budgetCycle?: BudgetCycle;
  budgetStartDay?: number;
  expenseBudgets: Record<string, number>;
  totalBudget: number;
}) {
  if (!profile.line_user_id) return;

  const monthlyBudgets =
    budgetMode === "total"
      ? totalBudget > 0
        ? { __total__: totalBudget }
        : {}
      : Object.fromEntries(Object.entries(expenseBudgets).filter(([, value]) => value > 0));

  try {
    await upsertLineUser({
      line_user_id: profile.line_user_id,
      display_name: profile.display_name,
      picture_url: profile.picture_url,
    });
    await saveLineUserOnboarding(profile.line_user_id, {
      discovery_source: "liff_categories",
      expense_categories: expenseCategories,
      income_categories: incomeCategories,
      monthly_budgets: monthlyBudgets,
      budget_cycle: budgetCycle,
      budget_start_day: budgetStartDay,
    });
  } catch {
    // Keep local budget settings usable even if the backend is temporarily unavailable.
  }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartInputValue() {
  const now = new Date();
  return inputDateValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function inputDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinDateRange(value: string, startDate: string, endDate: string) {
  const date = parseLocalDate(value);
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function formatThaiDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) return `${startDate} - ${endDate}`;
  return `${start.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} - ${end.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`;
}

function calendarGridDays(viewMonth: Date) {
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(gridStart);
    value.setDate(gridStart.getDate() + index);
    return { date: value };
  });
}

function isInBudgetPeriod(value: string, cycle: BudgetCycle, startDay: number) {
  const transactionDate = parseLocalDate(value);
  if (!transactionDate) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (cycle === "daily") {
    return transactionDate.getTime() === today.getTime();
  }

  if (cycle === "weekly") {
    const day = today.getDay() || 7;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - day + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return transactionDate >= startOfWeek && transactionDate <= endOfWeek;
  }

  const currentPeriodStart = dateWithClampedDay(today.getFullYear(), today.getMonth(), startDay);
  const start = today >= currentPeriodStart
    ? currentPeriodStart
    : dateWithClampedDay(today.getFullYear(), today.getMonth() - 1, startDay);
  const end = dateWithClampedDay(start.getFullYear(), start.getMonth() + 1, startDay);
  return transactionDate >= start && transactionDate < end;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateWithClampedDay(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

async function loadLineProfile(): Promise<LineProfile> {
  const liffId = resolveLiffId();
  if (!liffId || typeof window === "undefined") {
    return getCachedLineProfile();
  }

  await loadLiffSdk();
  if (!window.liff) {
    return getCachedLineProfile();
  }

  await window.liff.init({ liffId });
  if (!window.liff.isLoggedIn()) {
    window.liff.login({ redirectUri: window.location.href });
    return getCachedLineProfile();
  }

  const liffProfile = await window.liff.getProfile();
  const profile = {
    line_user_id: liffProfile.userId,
    display_name: liffProfile.displayName,
    picture_url: liffProfile.pictureUrl ?? null,
  };
  cacheLineProfile(profile);
  return profile;
}

function resolveLiffId() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || DEFAULT_LIFF_ID;
  return liffId === KNOWN_WRONG_LIFF_ID ? DEFAULT_LIFF_ID : liffId;
}

function getCachedLineProfile(): LineProfile {
  const fallback = { line_user_id: "", display_name: "ผู้ใช้งาน", picture_url: null };
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(LINE_PROFILE_CACHE_KEY);
    if (!value) return fallback;
    const parsed = JSON.parse(value) as Partial<LineProfile>;
    if (!parsed.line_user_id || !parsed.display_name) return fallback;
    return {
      line_user_id: parsed.line_user_id,
      display_name: parsed.display_name,
      picture_url: parsed.picture_url ?? null,
    };
  } catch {
    return fallback;
  }
}

function cacheLineProfile(profile: LineProfile) {
  if (typeof window === "undefined" || !profile.line_user_id) return;
  window.localStorage.setItem(LINE_PROFILE_CACHE_KEY, JSON.stringify(profile));
}

function loadLiffSdk(): Promise<void> {
  if (window.liff) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://static.line-scdn.net/liff/edge/2/sdk.js"]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load LIFF SDK")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load LIFF SDK"));
    document.head.appendChild(script);
  });
}

function formatThaiShortDate(value?: string) {
  if (!value) return "วันนี้";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function formatThaiLongDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function groupTransactionsByDate(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = transaction.date;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return Array.from(groups.entries()).map(([date, items]) => ({ date, transactions: items }));
}

function formatTimeFallback(value?: string) {
  if (!value || !value.includes("T")) return "วันนี้";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "วันนี้";
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: loadActiveTimezoneSetting().value });
}

function formatBudgetAmount(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function formatBaht(value: number) {
  const currency = loadActiveCurrencySetting();
  return `${currency.symbol}${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
