"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
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

import { deleteTransaction, getDashboard, getTransactions, updateTransaction } from "@/lib/api";
import type { DashboardData, Transaction, TransactionInput } from "@/lib/types";

type LiffTab = "summary" | "insights" | "categories" | "transactions" | "settings";

const tabs: { id: LiffTab; label: string; href: string; icon: React.ElementType }[] = [
  { id: "summary", label: "สรุป", href: "/liff/summary", icon: Home },
  { id: "insights", label: "วิเคราะห์", href: "/liff/insights", icon: BarChart3 },
  { id: "categories", label: "หมวด / งบ", href: "/liff/categories", icon: Tags },
  { id: "transactions", label: "รายการ", href: "/liff/transactions", icon: LayoutList },
  { id: "settings", label: "ตั้งค่า", href: "/liff/settings", icon: Settings },
];

const expenseCategories = ["อาหาร", "เดินทาง", "ที่พัก", "ค่าโทรศัพท์", "ค่าเน็ต", "ค่าน้ำค่าไฟ", "ช้อปปิ้ง", "Subscription", "กาแฟ", "ผ่อนรถ", "อื่นๆ"];
const incomeCategories = ["เงินเดือน", "ธุรกิจส่วนตัว", "งานพิเศษ", "ค่าคอมมิชชั่น", "ขายของ", "เงินปันผล", "อื่นๆ"];

export function LiffAppView({ tab }: { tab: LiffTab }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
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
              {tab === "summary" && <SummaryScreen dashboard={dashboard} latest={latest} onEdit={setEditingTransaction} />}
              {tab === "insights" && <InsightsScreen dashboard={dashboard} />}
              {tab === "categories" && <CategoriesScreen />}
              {tab === "transactions" && <TransactionsScreen transactions={transactions} onEdit={setEditingTransaction} />}
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

function SummaryScreen({ dashboard, latest, onEdit }: { dashboard: DashboardData | null; latest: Transaction[]; onEdit: (transaction: Transaction) => void }) {
  const summary = dashboard?.summary;
  const net = summary?.net_balance ?? 0;
  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;
  const isPositive = net >= 0;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm">
        <div className="bg-[#0d4a2b] px-4 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/65">MoneyTrack AI</p>
              <h2 className="mt-1 text-xl font-black">ภาพรวมเดือนนี้</h2>
            </div>
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black text-white">มิ.ย. 2569</span>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-white/70">คงเหลือสุทธิ</p>
            <p className={`mt-1 text-4xl font-black leading-none ${isPositive ? "text-[#6dc5ad]" : "text-[#ffb4c2]"}`}>{formatBaht(net)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3">
          <MetricBox label="รายจ่าย" value={expense} tone="expense" />
          <MetricBox label="รายรับ" value={income} tone="income" />
        </div>
        <Link href="/liff/insights" className="mx-3 mb-3 flex h-10 items-center justify-center rounded-md bg-[#eef8f5] text-sm font-black text-[#0d4a2b]">
          ดูรายละเอียดการเงิน
        </Link>
      </section>
      <SectionTitle title="รายการล่าสุด" actionHref="/liff/transactions" action="ดูทั้งหมด" />
      {latest.length > 0 ? <TransactionList transactions={latest} onEdit={onEdit} /> : <EmptyState title="ยังไม่มีข้อมูลรายการ" body="ลองพิมพ์ในแชท เช่น ข้าว 80 หรือ รับเงินลูกค้า 2500" />}
    </div>
  );
}

function InsightsScreen({ dashboard }: { dashboard: DashboardData | null }) {
  const chart = dashboard?.charts.income_vs_expense ?? [];
  const categories = dashboard?.charts.expense_by_category ?? [];
  const maxCategory = Math.max(1, ...categories.map((category) => category.amount));

  return (
    <div className="space-y-4">
      <Segmented first="รายรับรายจ่าย" second="เก็บออม" active="first" />
      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#8a928e]">ภาพรวมย้อนหลัง</p>
            <h2 className="mt-1 text-xl font-black leading-tight">รายรับเทียบรายจ่าย</h2>
          </div>
          <button className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-bold" type="button">
            รายเดือน
          </button>
        </div>
        <div className="mt-5 h-56">
          <MiniBars data={chart} />
        </div>
        <div className="mt-4 flex justify-center gap-5 text-sm font-bold">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#DC143C]" />รายจ่าย</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#6dc5ad]" />รายรับ</span>
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
          {categories.length > 0 ? categories.slice(0, 5).map((item) => <CategoryBar key={item.category} label={item.category} amount={item.amount} max={maxCategory} />) : <EmptyState title="ยังไม่มีรายจ่าย" body="เมื่อเริ่มจด ระบบจะแสดงหมวดที่ใช้เงินเยอะให้ทันที" />}
        </div>
      </section>
    </div>
  );
}

function CategoriesScreen() {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const items = kind === "expense" ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setKind("expense")} className={`h-12 rounded-md border text-base font-black ${kind === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
          รายจ่าย
        </button>
        <button type="button" onClick={() => setKind("income")} className={`h-12 rounded-md border text-base font-black ${kind === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
          รายรับ
        </button>
      </div>
      <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-base font-black">งบที่ตั้งไว้</p>
            <p className="mt-2 text-xl font-black text-[#9aa1a0]">ยังไม่ได้ตั้งงบ</p>
          </div>
          <div>
            <p className="text-base font-black">ชนิดงบ</p>
            <button className="mt-2 rounded-md border border-black/10 px-3 py-2 text-sm font-bold" type="button">
              แยกหมวด
            </button>
          </div>
        </div>
        <div className="mt-5 rounded-md bg-[#eaf8f4] p-4 text-[#0d4a2b]">
          <p className="font-black">เงินสำรองฉุกเฉิน</p>
          <p className="mt-1 text-sm font-semibold">เริ่มจากตั้งงบเก็บเดือนละนิดก่อนก็ได้</p>
        </div>
      </section>
      <button type="button" className="inline-flex h-11 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-base font-black shadow-sm">
        <LayoutList className="h-5 w-5" /> จัดเรียง
      </button>
      <div className="space-y-3">
        {items.map((item) => (
          <button key={item} type="button" className="flex min-h-16 w-full items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-4 py-3 text-left text-base font-black shadow-sm">
            {item}
            <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#8a928e]">
              งบ ไม่มีตั้งงบ <ChevronRight />
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="h-12 w-full rounded-md bg-[#6dc5ad] text-base font-black text-[#082f24]">
        + เพิ่มหมวด
      </button>
    </div>
  );
}

function TransactionsScreen({ transactions, onEdit }: { transactions: Transaction[]; onEdit: (transaction: Transaction) => void }) {
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
      <button type="button" className="fixed bottom-24 right-[calc(50%-11.5rem)] grid h-14 w-14 place-items-center rounded-full bg-[#DC143C] text-3xl font-light text-white shadow-xl">
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

function MetricBox({ label, value, tone }: { label: string; value: number; tone: "expense" | "income" }) {
  const classes = tone === "expense" ? "bg-[#fff3f5] text-[#DC143C]" : "bg-[#eef8f5] text-[#0d4a2b]";
  return (
    <div className={`rounded-md p-3 ${classes}`}>
      <p className="text-xs font-bold text-[#55605b]">{label}</p>
      <p className="mt-1 truncate text-lg font-black">{formatBaht(value)}</p>
    </div>
  );
}

function MiniBars({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  const months = data.length > 0 ? data.slice(-6) : ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."].map((month) => ({ month, income: 0, expense: 0 }));
  return (
    <div className="flex h-full items-end justify-between gap-3 rounded-md bg-[#fbfcfb] px-3 pb-2 pt-4">
      {months.map((item) => (
        <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-40 items-end gap-1">
            <div className="w-3 rounded-t bg-[#DC143C]" style={{ height: `${Math.max(6, (item.expense / max) * 144)}px` }} />
            <div className="w-3 rounded-t bg-[#6dc5ad]" style={{ height: `${Math.max(6, (item.income / max) * 144)}px` }} />
          </div>
          <span className="text-xs font-black text-[#777f7b]">{item.month}</span>
        </div>
      ))}
    </div>
  );
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
            <p className="mt-1 truncate text-xs font-semibold text-[#8a928e]">{transaction.date} · {transaction.category}</p>
          </div>
          <p className={`shrink-0 text-base font-black ${transaction.type === "income" ? "text-[#0d4a2b]" : "text-[#DC143C]"}`}>
            {transaction.type === "income" ? "+" : "-"}{formatBaht(transaction.amount)}
          </p>
        </button>
      ))}
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
  const [draft, setDraft] = useState<Transaction>(transaction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const categories = draft.type === "income" ? ["Salary", "Freelance", "Business Revenue", "Other Income"] : ["Food", "Transport", "Rent / Home", "Utilities", "Debt Payment", "Shopping", "Health", "Business Cost", "Other Expense"];

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
            <button type="button" onClick={remove} disabled={saving} aria-label="ลบรายการ" className="grid h-10 w-10 place-items-center rounded-md bg-[#DC143C] text-white disabled:opacity-60">
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
              <button type="button" onClick={() => setDraft({ ...draft, type: "expense", category: "Other Expense" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "expense" ? "border-[#DC143C] bg-[#FCECEF] text-[#DC143C]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
                รายจ่าย
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, type: "income", category: "Other Income" })} className={`h-12 rounded-md border text-base font-black ${draft.type === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
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

function formatBaht(value: number) {
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
