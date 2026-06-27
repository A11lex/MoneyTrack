"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  LayoutList,
  Loader2,
  Settings,
  Tags,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { createTransaction, deleteTransaction, getDashboard, getTransactions, saveLineUserOnboarding, updateTransaction, upsertLineUser } from "@/lib/api";
import type { DashboardData, Transaction, TransactionInput } from "@/lib/types";

type LiffTab = "summary" | "insights" | "categories" | "transactions" | "settings";
type UserPlan = "free" | "pro";
type BudgetMode = "category" | "total";
type BudgetCycle = "daily" | "weekly" | "monthly";
type LineProfile = {
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
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
  const [profile, setProfile] = useState<LineProfile>({ line_user_id: "", display_name: "ผู้ใช้งาน", picture_url: null });
  const [plan] = useState<UserPlan>(() => loadStoredUserPlan());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getDashboard(), getTransactions()])
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

  useEffect(() => {
    loadLineProfile()
      .then(setProfile)
      .catch(() => setProfile({ line_user_id: "", display_name: "ผู้ใช้งาน", picture_url: null }));
  }, []);

  const latest = useMemo(() => transactions.slice(0, 4), [transactions]);

  function refreshDashboard() {
    getDashboard()
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
    <main className="min-h-screen bg-[#f8faf9] text-[#151b18]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white">
        <LiffHeader title={titleFor(tab)} />
        <section className="flex-1 px-4 pb-24 pt-4">
          {loading ? (
            <LoadingState />
          ) : (
            <>
              {tab === "summary" && <SummaryScreen dashboard={dashboard} latest={latest} onEdit={setEditingTransaction} profile={profile} plan={plan} />}
              {tab === "insights" && <InsightsScreen dashboard={dashboard} transactions={transactions} />}
              {tab === "categories" && <CategoriesScreen profile={profile} transactions={transactions} />}
              {tab === "transactions" && <TransactionsScreen transactions={transactions} onCreate={() => setCreatingTransaction(true)} onEdit={setEditingTransaction} />}
              {tab === "settings" && <SettingsScreen />}
            </>
          )}
        </section>
        <BottomNav active={tab} />
        {editingTransaction && (
          <TransactionEditModal
            key={editingTransaction.id}
            transaction={editingTransaction}
            onClose={() => setEditingTransaction(null)}
            onDeleted={handleTransactionDeleted}
            onSaved={handleTransactionSaved}
          />
        )}
        {creatingTransaction && (
          <TransactionCreateModal
            onClose={() => setCreatingTransaction(false)}
            onCreated={handleTransactionCreated}
          />
        )}
      </div>
    </main>
  );
}

function LiffHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur">
      <div>
        <h1 className="text-xl font-black">{title}</h1>
        <p className="text-xs font-semibold text-[#8a928e]">money-track-sandy.vercel.app</p>
      </div>
      <button type="button" aria-label="ปิด" onClick={() => window.close()} className="grid h-10 w-10 place-items-center rounded-full text-[#151b18]">
        <X className="h-6 w-6" />
      </button>
    </header>
  );
}

function SummaryScreen({
  dashboard,
  latest,
  onEdit,
  plan,
  profile,
}: {
  dashboard: DashboardData | null;
  latest: Transaction[];
  onEdit: (transaction: Transaction) => void;
  plan: UserPlan;
  profile: LineProfile;
}) {
  const summary = dashboard?.summary;
  const net = summary?.net_balance ?? 0;
  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;
  const isPositive = net >= 0;

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
          <MetricBox label="รายจ่าย" value={expense} tone="expense" />
          <MetricBox label="รายรับ" value={income} tone="income" />
        </div>
        <Link href="/liff/insights" className="mx-auto mt-8 flex h-10 w-24 items-center justify-center gap-1 rounded-full border border-black/10 bg-white text-sm font-black text-[#DC143C] shadow-sm">
          ดูเพิ่ม
          <ChevronRight className="h-4 w-4 rotate-90" />
        </Link>
      </section>

      <SectionTitle title="รายการล่าสุด" actionHref="/liff/transactions" action="ดูทั้งหมด" />
      {latest.length > 0 ? <SummaryTransactionList transactions={latest} onEdit={onEdit} /> : <EmptyState title="ยังไม่มีข้อมูลรายการ" body="ลองพิมพ์ในแชท เช่น ข้าว 80 หรือ รับเงินลูกค้า 2500" />}
    </div>
  );
}

function InsightsScreen({ dashboard, transactions }: { dashboard: DashboardData | null; transactions: Transaction[] }) {
  const [chartMode, setChartMode] = useState<"monthly" | "daily">("monthly");
  const categories = dashboard?.charts.expense_by_category ?? [];
  const maxCategory = Math.max(1, ...categories.map((category) => category.amount));

  return (
    <div className="space-y-4">
      <Segmented first="รายรับรายจ่าย" second="เก็บออม" active="first" />
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
          <IncomeExpenseHistoryChart key={chartMode} mode={chartMode} transactions={transactions} />
        </div>
      </section>
      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#8a928e]">จุดที่ใช้เงินเยอะ</p>
            <h2 className="mt-1 text-xl font-black">รายจ่ายตามหมวด</h2>
          </div>
          {categories.length > 0 && <span className="text-xs font-bold text-[#8a928e]">Top 5</span>}
        </div>
        <div className="mt-4 space-y-4">
          {categories.length > 0 ? categories.slice(0, 5).map((item) => <CategoryBar key={item.category} label={displayCategory(item.category, "expense")} amount={item.amount} max={maxCategory} />) : <EmptyState title="ยังไม่มีรายจ่าย" body="เมื่อเริ่มจด ระบบจะแสดงหมวดที่ใช้เงินเยอะให้ทันที" />}
        </div>
      </section>
    </div>
  );
}

function CategoriesScreen({ profile, transactions }: { profile: LineProfile; transactions: Transaction[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [storedExpenseCategories, setStoredExpenseCategories] = useState<string[]>(() => loadStoredExpenseCategories());
  const [storedIncomeCategories, setStoredIncomeCategories] = useState<string[]>(() => loadStoredIncomeCategories());
  const [showExpenseCategoryModal, setShowExpenseCategoryModal] = useState(false);
  const [showIncomeCategoryModal, setShowIncomeCategoryModal] = useState(false);
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setKind("expense")} className={`h-12 rounded-md border text-base font-black ${kind === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
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
      <button type="button" className="inline-flex h-11 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-base font-black shadow-sm">
        <LayoutList className="h-5 w-5" /> จัดเรียง
      </button>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              if (kind === "income") {
                setSelectedIncomeCategory(item);
                return;
              }
              setSelectedExpenseCategory(item);
            }}
            className="flex min-h-16 w-full items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-black shadow-sm"
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
                    {expenseBudgets[item] > 0 ? formatBudgetAmount(expenseBudgets[item]) : "ไม่มีตั้งงบ"}
                  </span>
                  <ChevronRight className="h-5 w-5 text-[#9aa1a0]" />
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
            setSelectedExpenseCategory(category);
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

function TransactionsScreen({ transactions, onCreate, onEdit }: { transactions: Transaction[]; onCreate: () => void; onEdit: (transaction: Transaction) => void }) {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-black/10 bg-white p-3 shadow-sm">
        <button type="button" className="flex h-11 w-full items-center justify-between rounded-md bg-[#f7f8f7] px-3 text-sm font-black text-[#151b18]">
          <span>1 มิ.ย. 2569 - 30 มิ.ย. 2569</span>
          <CalendarDays className="h-5 w-5 text-[#6b756f]" />
        </button>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto">
            {["ทั้งหมด", "รายจ่าย", "รายรับ"].map((item, index) => (
              <button key={item} type="button" className={`h-9 shrink-0 rounded-full px-4 text-sm font-black ${index === 0 ? "bg-[#DC143C] text-white" : "bg-[#f0f2f1] text-[#555f5b]"}`}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" aria-label="ส่งออก" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-[#0d4a2b]">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </section>
      <SectionTitle title="รายการทั้งหมด" actionHref="/liff/summary" action="สรุป" />
      {transactions.length > 0 ? <TransactionList transactions={transactions} onEdit={onEdit} /> : <EmptyState title="ไม่มีข้อมูลรายการ" body="กดปุ่ม + หรือจดผ่านแชท LINE เพื่อเพิ่มรายการแรก" />}
      <button type="button" onClick={onCreate} aria-label="เพิ่มรายการ" className="fixed bottom-24 right-[calc(50%-11.5rem)] grid h-14 w-14 place-items-center rounded-full bg-[#DC143C] text-3xl font-light text-white shadow-xl">
        +
      </button>
    </div>
  );
}

function SettingsScreen() {
  const settings = ["เตือนจดประจำวัน", "จัดหมวดด้วยความจำ", "แยกช่องทางชำระเงิน", "รายการจดประจำ", "ประวัติการชำระเงิน", "ตั้งค่าหมวด", "การแจ้งเตือน Streak", "ตั้งค่าสกุลเงิน", "ปรับแต่งข้อความยืนยัน", "ตั้งค่าโซนเวลา", "ตั้งค่าภาษา"];

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
          <button key={item} type="button" className="flex min-h-14 w-full items-center justify-between rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-bold shadow-sm">
            <span className={index === settings.length - 1 ? "text-[#0d4a2b]" : ""}>{item}</span>
            <ChevronRight className="text-[#9aa1a0]" />
          </button>
        ))}
        <button type="button" className="flex min-h-14 w-full items-center justify-between rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-bold text-[#DC143C] shadow-sm">
          <span>ลบรายการทั้งหมด</span>
          <Trash2 />
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

function MetricBox({ label, value, tone }: { label: string; value: number; tone: "expense" | "income" }) {
  const classes = tone === "expense" ? "border-[#DC143C]/70 bg-[#fff3f5] text-[#DC143C]" : "border-[#6dc5ad]/80 bg-[#eef8f5] text-[#5fc8ba]";
  return (
    <div className={`rounded-md border-2 p-3 shadow-sm ${classes}`}>
      <p className="text-xs font-bold text-[#55605b]">{label}</p>
      <p className="mt-2 truncate text-xl font-black">{formatBaht(value)}</p>
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
  mode,
  transactions,
}: {
  mode: "monthly" | "daily";
  transactions: Transaction[];
}) {
  const currentYear = new Date().getFullYear();
  const [monthlyYear, setMonthlyYear] = useState(currentYear);
  const points = mode === "daily" ? buildDailyHistoryPoints(transactions) : buildMonthlyHistoryPoints(transactions, monthlyYear);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePoint = activeIndex === null ? null : points[Math.min(activeIndex, points.length - 1)] ?? null;
  const tooltipLeft = activeIndex === null ? 0 : Math.min(70, Math.max(8, (activeIndex / Math.max(1, points.length - 1)) * 100 - 10));
  const max = Math.max(1, ...points.flatMap((item) => [item.income, item.expense]));
  const averageExpense = points.reduce((sum, item) => sum + item.expense, 0) / Math.max(1, points.length);
  const averageIncome = points.reduce((sum, item) => sum + item.income, 0) / Math.max(1, points.length);
  const rangeLabel = mode === "daily" ? dailyRangeLabel(points) : monthlyRangeLabel(points, monthlyYear);
  const canGoNextYear = mode === "monthly" && monthlyYear < currentYear;

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
            }
          }}
          className="grid h-9 w-9 place-items-center rounded-full text-[#151b18] active:bg-[#f4f5f4]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-black text-[#7a817d]">{rangeLabel}</p>
        <button
          type="button"
          aria-label={mode === "monthly" ? "ปีถัดไป" : "ช่วงถัดไป"}
          disabled={mode === "monthly" && !canGoNextYear}
          onClick={() => {
            if (canGoNextYear) {
              setActiveIndex(null);
              setMonthlyYear((year) => Math.min(currentYear, year + 1));
            }
          }}
          className={`grid h-9 w-9 place-items-center rounded-full active:bg-[#f4f5f4] ${canGoNextYear ? "text-[#151b18]" : "text-[#d8ddda]"}`}
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
                <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black text-[#777f7b] sm:text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {activePoint && (
          <div
            className="pointer-events-none absolute top-6 z-20 min-w-36 rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-lg"
            style={{ left: `${tooltipLeft}%` }}
          >
            <p className="font-black text-[#151b18]">{activePoint.tooltipTitle}</p>
            <p className="mt-1 font-semibold text-[#6b756f]">รายจ่าย: {formatBaht(activePoint.expense)}</p>
            <p className="mt-1 font-semibold text-[#6b756f]">รายรับ: {formatBaht(activePoint.income)}</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-center gap-5 text-sm font-black">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#DC143C]" />รายจ่าย</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#6dc5ad]" />รายรับ</span>
      </div>
      <p className="mt-6 text-center text-sm font-semibold text-[#8a928e]">เอานิ้วจิ้มบนกราฟเพื่อดูค่าได้เลย</p>
      <div className="mt-5 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xs font-bold text-[#555f5b]">รายจ่ายเฉลี่ยต่อ{mode === "daily" ? "วัน" : "เดือน"}</p>
          <p className="mt-1 text-xl font-black text-[#DC143C]">{formatBaht(averageExpense)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-[#555f5b]">รายรับเฉลี่ยต่อ{mode === "daily" ? "วัน" : "เดือน"}</p>
          <p className="mt-1 text-xl font-black text-[#6dc5ad]">{formatBaht(averageIncome)}</p>
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
      <div className="absolute inset-x-0 -bottom-7 flex justify-between text-[10px] font-black text-[#777f7b] sm:text-xs">
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

function buildDailyHistoryPoints(transactions: Transaction[]): HistoryChartPoint[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = today.getDate();
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

function linePoints(values: number[], max: number) {
  return values.map((value, index) => `${pointX(index, values.length)},${94 - (value / max) * 88}`).join(" ");
}

function pointX(index: number, length: number) {
  return length <= 1 ? 0 : (index / (length - 1)) * 100;
}

function thaiMonthName(monthIndex: number) {
  return ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][monthIndex] ?? "ม.ค.";
}

function CategoryBar({ label, amount, max }: { label: string; amount: number; max: number }) {
  const percent = Math.round((amount / max) * 100);
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm font-black">
        <span>{label}</span>
        <span className="text-[#DC143C]">{formatBaht(amount)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-[#edf4f2]">
          <div className="h-2 rounded-full bg-[#6dc5ad]" style={{ width: `${Math.max(8, percent)}%` }} />
        </div>
        <span className="w-9 text-right text-xs font-bold text-[#8a928e]">{percent}%</span>
      </div>
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
  onClose,
  onCreated,
}: {
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
      });
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
              <button type="button" onClick={() => setDraft({ ...draft, type: "expense", category: transactionCategories("expense")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
                รายจ่าย
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, type: "income", category: transactionCategories("income")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
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
  transaction,
  onClose,
  onDeleted,
  onSaved,
}: {
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
      const updated = await updateTransaction(draft.id, payload);
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
      await deleteTransaction(draft.id);
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
              <button type="button" onClick={() => setDraft({ ...draft, type: "expense", category: transactionCategories("expense")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
                รายจ่าย
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, type: "income", category: transactionCategories("income")[0] ?? "อื่นๆ" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
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

function Segmented({ first, second, active }: { first: string; second: string; active: "first" | "second" }) {
  return (
    <div className="grid grid-cols-2 rounded-md bg-[#eef1ef] p-1">
      <button type="button" className={`h-10 rounded-md text-sm font-black ${active === "first" ? "bg-white text-[#151b18] shadow-sm" : "text-[#7f8884]"}`}>
        {first}
      </button>
      <button type="button" className={`h-10 rounded-md text-sm font-black ${active === "second" ? "bg-white text-[#151b18] shadow-sm" : "text-[#7f8884]"}`}>
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

function titleFor(tab: LiffTab) {
  const found = tabs.find((item) => item.id === tab);
  return found?.label ?? "เงินไปไหน?";
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
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId || typeof window === "undefined") {
    return { line_user_id: "", display_name: "ผู้ใช้งาน", picture_url: null };
  }

  await loadLiffSdk();
  if (!window.liff) {
    return { line_user_id: "", display_name: "ผู้ใช้งาน", picture_url: null };
  }

  await window.liff.init({ liffId });
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    return { line_user_id: "", display_name: "ผู้ใช้งาน", picture_url: null };
  }

  const liffProfile = await window.liff.getProfile();
  return {
    line_user_id: liffProfile.userId,
    display_name: liffProfile.displayName,
    picture_url: liffProfile.pictureUrl ?? null,
  };
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

function formatTimeFallback(value?: string) {
  if (!value || !value.includes("T")) return "วันนี้";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "วันนี้";
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatBudgetAmount(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function formatBaht(value: number) {
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
