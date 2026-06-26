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

import { getDashboard, getTransactions } from "@/lib/api";
import type { DashboardData, Transaction } from "@/lib/types";

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

  return (
    <main className="min-h-screen bg-[#f8faf9] text-[#151b18]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white">
        <LiffHeader title={titleFor(tab)} />
        <section className="flex-1 px-5 pb-28 pt-5">
          {loading ? (
            <LoadingState />
          ) : (
            <>
              {tab === "summary" && <SummaryScreen dashboard={dashboard} latest={latest} />}
              {tab === "insights" && <InsightsScreen dashboard={dashboard} />}
              {tab === "categories" && <CategoriesScreen />}
              {tab === "transactions" && <TransactionsScreen transactions={transactions} />}
              {tab === "settings" && <SettingsScreen />}
            </>
          )}
        </section>
        <BottomNav active={tab} />
      </div>
    </main>
  );
}

function LiffHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/5 bg-white/95 px-5 py-4 backdrop-blur">
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-sm font-semibold text-[#8a928e]">money-track-sandy.vercel.app</p>
      </div>
      <button type="button" aria-label="ปิด" onClick={() => window.close()} className="grid h-11 w-11 place-items-center rounded-full text-[#151b18]">
        <X className="h-8 w-8" />
      </button>
    </header>
  );
}

function SummaryScreen({ dashboard, latest }: { dashboard: DashboardData | null; latest: Transaction[] }) {
  const summary = dashboard?.summary;
  const net = summary?.net_balance ?? 0;
  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;

  return (
    <div className="space-y-6">
      <ProfileCard />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black">สรุป</h2>
        <button className="rounded-md border border-black/10 bg-white px-4 py-3 text-lg font-bold shadow-sm" type="button">
          เดือนนี้
        </button>
      </div>
      <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
        <div className="text-center">
          <p className="text-xl font-bold text-[#3d4742]">เหลือเก็บ</p>
          <p className={`mt-2 text-5xl font-black ${net >= 0 ? "text-[#14b86a]" : "text-[#d72d78]"}`}>{formatBaht(net)}</p>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <MetricBox label="รายจ่าย" value={expense} tone="expense" />
          <MetricBox label="รายรับ" value={income} tone="income" />
        </div>
        <Link href="/liff/insights" className="mx-auto mt-7 flex h-12 w-36 items-center justify-center rounded-full border border-black/10 bg-white text-lg font-black text-[#0d4a2b] shadow-sm">
          ดูเพิ่ม
        </Link>
      </section>
      <SectionTitle title="รายการล่าสุด" actionHref="/liff/transactions" action="ดูทั้งหมด" />
      {latest.length > 0 ? <TransactionList transactions={latest} /> : <EmptyState title="ยังไม่มีข้อมูลรายการ" body="ลองพิมพ์ในแชท เช่น ข้าว 80 หรือ รับเงินลูกค้า 2500" />}
    </div>
  );
}

function InsightsScreen({ dashboard }: { dashboard: DashboardData | null }) {
  const chart = dashboard?.charts.income_vs_expense ?? [];
  const categories = dashboard?.charts.expense_by_category ?? [];

  return (
    <div className="space-y-5">
      <Segmented first="รายรับรายจ่าย" second="เก็บออม" active="first" />
      <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black leading-tight">ประวัติรายรับรายจ่าย</h2>
          <button className="rounded-md border border-black/10 px-3 py-2 text-base font-bold" type="button">
            รายเดือน
          </button>
        </div>
        <div className="mt-7 h-64">
          <MiniBars data={chart} />
        </div>
        <div className="mt-4 flex justify-center gap-5 text-base font-bold">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#d72d78]" />รายจ่าย</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#6dc5ad]" />รายรับ</span>
        </div>
      </section>
      <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-3xl font-black">รายจ่ายตามหมวด</h2>
        <div className="mt-5 space-y-4">
          {categories.length > 0 ? categories.slice(0, 5).map((item) => <CategoryBar key={item.category} label={item.category} amount={item.amount} max={Math.max(...categories.map((category) => category.amount))} />) : <EmptyState title="ยังไม่มีรายจ่าย" body="เมื่อเริ่มจด ระบบจะแสดงหมวดที่ใช้เงินเยอะให้ทันที" />}
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
        <button type="button" onClick={() => setKind("expense")} className={`h-16 rounded-md border text-xl font-black ${kind === "expense" ? "border-[#d72d78] bg-[#fff0f6] text-[#d72d78]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
          รายจ่าย
        </button>
        <button type="button" onClick={() => setKind("income")} className={`h-16 rounded-md border text-xl font-black ${kind === "income" ? "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]" : "border-[#d8eee8] bg-white text-[#6dc5ad]"}`}>
          รายรับ
        </button>
      </div>
      <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xl font-black">งบที่ตั้งไว้</p>
            <p className="mt-3 text-2xl font-black text-[#9aa1a0]">ยังไม่ได้ตั้งงบ</p>
          </div>
          <div>
            <p className="text-xl font-black">ชนิดงบ</p>
            <button className="mt-3 rounded-md border border-black/10 px-4 py-3 text-lg font-bold" type="button">
              แยกหมวด
            </button>
          </div>
        </div>
        <div className="mt-5 rounded-md bg-[#eaf8f4] p-4 text-[#0d4a2b]">
          <p className="font-black">เงินสำรองฉุกเฉิน</p>
          <p className="mt-1 text-sm font-semibold">เริ่มจากตั้งงบเก็บเดือนละนิดก่อนก็ได้</p>
        </div>
      </section>
      <button type="button" className="inline-flex h-12 items-center gap-2 rounded-md border border-black/10 bg-white px-4 text-lg font-black shadow-sm">
        <LayoutList className="h-5 w-5" /> จัดเรียง
      </button>
      <div className="space-y-3">
        {items.map((item) => (
          <button key={item} type="button" className="flex h-20 w-full items-center justify-between rounded-md border border-black/10 bg-white px-5 text-left text-xl font-black shadow-sm">
            {item}
            <span className="inline-flex items-center gap-3 text-base font-bold text-[#8a928e]">
              งบ ไม่มีตั้งงบ <ChevronRight />
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="h-16 w-full rounded-md bg-[#6dc5ad] text-xl font-black text-[#082f24]">
        + เพิ่มหมวด
      </button>
    </div>
  );
}

function TransactionsScreen({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="space-y-5">
      <button type="button" className="flex h-16 w-full items-center justify-center gap-4 rounded-md border border-black/10 bg-white text-xl font-black shadow-sm">
        1 มิ.ย. 2569 — 30 มิ.ย. 2569 <CalendarDays />
      </button>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-2xl font-black">คัดกรองประเภทรายการ</p>
          <div className="mt-3 flex gap-2">
            {["ทั้งหมด", "รายจ่าย", "รายรับ"].map((item, index) => (
              <button key={item} type="button" className={`h-10 rounded-md px-4 text-base font-black ${index === 0 ? "bg-[#d72d78] text-white" : "bg-[#eceef1] text-[#555f5b]"}`}>
                {item}
              </button>
            ))}
          </div>
        </section>
        <button type="button" className="grid w-24 place-items-center rounded-md border border-black/10 bg-white text-lg font-black shadow-sm">
          <Download />
          ส่งออก
        </button>
      </div>
      {transactions.length > 0 ? <TransactionList transactions={transactions} /> : <EmptyState title="ไม่มีข้อมูลรายการ" body="กดปุ่ม + หรือจดผ่านแชท LINE เพื่อเพิ่มรายการแรก" />}
      <button type="button" className="fixed bottom-28 right-[calc(50%-12rem)] grid h-20 w-20 place-items-center rounded-full bg-[#d72d78] text-5xl font-light text-white shadow-xl">
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
        <Image src="/brand/moneytrack-pro.png" alt="เงินไปไหน" width={72} height={72} className="h-18 w-18 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-3xl font-black">เงินไปไหน?</h2>
          <p className="text-lg font-semibold text-[#8a928e]">ผู้ช่วยจดเงินผ่าน LINE</p>
        </div>
        <button type="button" className="rounded-md bg-[#6dc5ad] px-5 py-3 text-lg font-black text-[#082f24]">
          อัปเกรด
        </button>
      </div>
      <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <Image src="/brand/moneytrack-pro.png" alt="" width={96} height={96} className="h-24 w-24 rounded-md object-cover opacity-80" />
          <div>
            <p className="text-2xl font-black">จดต่อเนื่องมา</p>
            <p className="mt-2 text-5xl font-black">0 วัน</p>
            <p className="mt-2 text-lg text-[#555f5b]">เริ่มจดวันนี้เพื่อสร้างนิสัยใหม่</p>
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-[#e5e8e7]">
          <div className="h-3 w-1/2 rounded-full bg-[#6dc5ad]" />
        </div>
      </section>
      <button type="button" className="h-16 w-full rounded-md bg-[#6dc5ad] text-xl font-black text-[#082f24]">
        ชวนเพื่อนมาใช้ รับฟรี 1 เดือน
      </button>
      <div className="space-y-3">
        {settings.map((item, index) => (
          <button key={item} type="button" className="flex h-18 w-full items-center justify-between rounded-md border border-black/10 bg-white px-5 text-left text-xl font-bold shadow-sm">
            <span className={index === settings.length - 1 ? "text-[#0d4a2b]" : ""}>{item}</span>
            <ChevronRight className="text-[#9aa1a0]" />
          </button>
        ))}
        <button type="button" className="flex h-18 w-full items-center justify-between rounded-md border border-black/10 bg-white px-5 text-left text-xl font-bold text-[#d72d78] shadow-sm">
          <span>ลบรายการทั้งหมด</span>
          <Trash2 />
        </button>
      </div>
    </div>
  );
}

function ProfileCard() {
  return (
    <section className="flex items-center gap-4 rounded-md border border-black/10 bg-white p-5 shadow-sm">
      <Image src="/brand/moneytrack-pro.png" alt="เงินไปไหน" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-3xl font-black">เงินไปไหน?</p>
        <p className="mt-1 text-lg font-semibold text-[#8a928e]">หลานฟรี</p>
      </div>
      <span className="rounded-full border border-[#6dc5ad]/40 bg-[#eaf8f4] px-3 py-2 text-xs font-black text-[#0d4a2b]">ใช้ฟรี</span>
    </section>
  );
}

function MetricBox({ label, value, tone }: { label: string; value: number; tone: "expense" | "income" }) {
  const classes = tone === "expense" ? "border-[#d72d78] bg-[#fff0f6] text-[#d72d78]" : "border-[#6dc5ad] bg-[#eaf8f4] text-[#0d4a2b]";
  return (
    <div className={`rounded-md border-2 p-4 ${classes}`}>
      <p className="text-lg font-bold text-[#3d4742]">{label}</p>
      <p className="mt-3 text-3xl font-black">{formatBaht(value)}</p>
    </div>
  );
}

function MiniBars({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  const months = data.length > 0 ? data.slice(-6) : ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."].map((month) => ({ month, income: 0, expense: 0 }));
  return (
    <div className="flex h-full items-end justify-between gap-3 border-b border-dashed border-[#dfe5e2] px-3">
      {months.map((item) => (
        <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-44 items-end gap-1">
            <div className="w-3 rounded-t bg-[#d72d78]" style={{ height: `${Math.max(6, (item.expense / max) * 160)}px` }} />
            <div className="w-3 rounded-t bg-[#6dc5ad]" style={{ height: `${Math.max(6, (item.income / max) * 160)}px` }} />
          </div>
          <span className="text-sm font-black text-[#777f7b]">{item.month}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryBar({ label, amount, max }: { label: string; amount: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-lg font-black">
        <span>{label}</span>
        <span>{formatBaht(amount)}</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-[#edf4f2]">
        <div className="h-3 rounded-full bg-[#6dc5ad]" style={{ width: `${Math.max(8, (amount / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center justify-between rounded-md border border-black/10 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xl font-black">{transaction.description || transaction.category}</p>
            <p className="mt-1 text-sm font-semibold text-[#8a928e]">{transaction.date} · {transaction.category}</p>
          </div>
          <p className={`text-xl font-black ${transaction.type === "income" ? "text-[#0d4a2b]" : "text-[#d72d78]"}`}>
            {transaction.type === "income" ? "+" : "-"}{formatBaht(transaction.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ title, action, actionHref }: { title: string; action: string; actionHref: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-black">{title}</h2>
      <Link href={actionHref} className="rounded-md border border-black/10 bg-white px-4 py-3 text-lg font-bold shadow-sm">
        {action}
      </Link>
    </div>
  );
}

function Segmented({ first, second, active }: { first: string; second: string; active: "first" | "second" }) {
  return (
    <div className="grid grid-cols-2 rounded-md bg-[#f3f5f4] p-1">
      <button type="button" className={`h-14 rounded-md text-xl font-black ${active === "first" ? "bg-white shadow-sm" : "text-[#7f8884]"}`}>
        {first}
      </button>
      <button type="button" className={`h-14 rounded-md text-xl font-black ${active === "second" ? "bg-white shadow-sm" : "text-[#7f8884]"}`}>
        {second}
      </button>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#cbd5d1] bg-white p-8 text-center">
      <WalletCards className="mx-auto h-12 w-12 text-[#6dc5ad]" />
      <p className="mt-3 text-xl font-black text-[#555f5b]">{title}</p>
      <p className="mt-2 text-base leading-6 text-[#8a928e]">{body}</p>
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
    <nav className="fixed bottom-0 left-1/2 z-30 grid h-24 w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-black/10 bg-white">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <Link key={tab.id} href={tab.href} className={`flex flex-col items-center justify-center gap-1 text-sm font-black ${isActive ? "text-[#0d4a2b]" : "text-[#9aa1a0]"}`}>
            <Icon className="h-7 w-7" />
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
