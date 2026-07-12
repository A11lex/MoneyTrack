"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";

import { deleteTransaction, getLineUserSetup, getTransaction, getUserSettings, updateTransaction } from "@/lib/api";
import { classifyAppError, type AppErrorKind } from "@/lib/app-flow";
import type { Transaction, TransactionInput } from "@/lib/types";

const accent = "#DC143C";
const green = "#6DC5AD";
const DEFAULT_LIFF_ID = "2010521304-BrGvBhsP";
const KNOWN_WRONG_LIFF_ID = "2010521304-BrGvBhsp";
const DEFAULT_FRONTEND_ORIGIN = "https://money-track-sandy.vercel.app";

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

type LiffClient = {
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  logout?: () => void;
  getProfile: () => Promise<{ userId: string }>;
  getDecodedIDToken?: () => { sub?: string } | null;
  getContext?: () => { userId?: string } | null;
  closeWindow?: () => void;
};

export default function EditTransactionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const transactionId = Number(params.id);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [lineUserId, setLineUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadFailure, setLoadFailure] = useState<AppErrorKind | null>(() => (
    Number.isFinite(transactionId) ? null : "not_found"
  ));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expenseOptions, setExpenseOptions] = useState<string[]>(() => loadStoredExpenseCategories());
  const [incomeOptions, setIncomeOptions] = useState<string[]>(() => loadStoredIncomeCategories());
  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!Number.isFinite(transactionId)) {
      return;
    }
    loadLineUserId()
      .catch(() => "")
      .then((loadedLineUserId) => {
        if (!loadedLineUserId) {
          throw new Error("LINE profile is required");
        }
        setLineUserId(loadedLineUserId);
        return Promise.all([
          getTransaction(transactionId, loadedLineUserId),
          getLineUserSetup(loadedLineUserId).catch(() => null),
          getUserSettings(loadedLineUserId).catch(() => null),
        ]);
      })
      .then(([item, setup, settings]) => {
        const nextExpenseOptions = setup?.expense_categories.length ? setup.expense_categories : loadStoredExpenseCategories();
        const nextIncomeOptions = setup?.income_categories.length ? setup.income_categories : loadStoredIncomeCategories();
        setExpenseOptions(nextExpenseOptions);
        setIncomeOptions(nextIncomeOptions);
        setPaymentOptions(settings?.confirmation_show_payment_options ? settings.payment_channels : []);
        setTransaction({
          ...item,
          category: displayCategory(item.category, item.type, nextExpenseOptions, nextIncomeOptions),
        });
      })
      .catch((loadError: unknown) => {
        setLoadFailure(classifyAppError(loadError));
      });
  }, [transactionId]);

  const categories = useMemo(
    () => ensureCategoryOption(transaction?.type === "income" ? incomeOptions : expenseOptions, transaction?.category ?? ""),
    [expenseOptions, incomeOptions, transaction?.type, transaction?.category],
  );

  async function save() {
    if (!transaction) return;
    setSaving(true);
    setError("");
    const payload: TransactionInput = {
      date: transaction.date,
      type: transaction.type,
      amount: Number(transaction.amount),
      category: transaction.category,
      description: transaction.description,
      mode: transaction.mode,
      payment_channel: transaction.payment_channel,
    };
    try {
      if (!lineUserId) {
        setError("ไม่พบ LINE ID กรุณาเปิดผ่าน LINE อีกครั้ง");
        return;
      }
      await updateTransaction(transaction.id, payload, lineUserId);
      router.push("/liff/transactions");
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!transaction) return;
    setSaving(true);
    setError("");
    try {
      if (!lineUserId) {
        setError("ไม่พบ LINE ID กรุณาเปิดผ่าน LINE อีกครั้ง");
        return;
      }
      await deleteTransaction(transaction.id, lineUserId);
      router.push("/liff/transactions");
    } catch {
      setError("ลบรายการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!transaction) {
    if (loadFailure) {
      const content = transactionLoadFailureContent(loadFailure);
      return (
        <main className="moneytrack-liff grid min-h-screen place-items-center bg-[#f8faf9] px-5 text-[#151b18]">
          <section className="w-full max-w-sm rounded-md border border-black/10 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FDECEF] text-xl font-black text-[#DC143C]">!</div>
            <h1 className="mt-4 text-xl font-black">{content.title}</h1>
            <p className="mt-2 text-sm leading-6 text-[#66706b]">{content.description}</p>
            <div className="mt-6 grid gap-2">
              {loadFailure === "not_found" ? (
                <button type="button" onClick={() => router.replace("/liff/summary")} className="h-11 rounded-md bg-[#6DC5AD] font-bold text-[#082F24]">
                  กลับหน้าสรุป
                </button>
              ) : (
                <button type="button" onClick={() => retryTransactionLoad(loadFailure)} className="h-11 rounded-md bg-[#6DC5AD] font-bold text-[#082F24]">
                  ลองอีกครั้ง
                </button>
              )}
              <button type="button" onClick={closeLiffWindow} className="h-10 rounded-md border border-black/10 bg-white text-sm font-bold">
                ปิดหน้านี้
              </button>
            </div>
          </section>
        </main>
      );
    }
    return (
      <main className="moneytrack-liff grid min-h-screen place-items-center bg-white text-[#151b18]">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#6DC5AD]" />
          <p className="mt-3 text-lg font-black">{error || "กำลังโหลดรายการ"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="moneytrack-liff min-h-screen bg-[#f8faf9] text-[#151b18]">
      <div className="mx-auto min-h-screen w-full max-w-xl bg-white px-4 py-5 sm:px-6 sm:py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-black">แก้ไขรายการ</h1>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={saving}
            aria-label="ลบรายการ"
            className="grid h-10 w-10 place-items-center rounded-md text-white disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </header>

        <form className="mt-6 space-y-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="block">
            <span className="text-base font-black">รายละเอียด</span>
            <input
              value={transaction.description}
              onChange={(event) => setTransaction({ ...transaction, description: event.target.value })}
              className="mt-2 h-11 w-full rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]"
            />
          </label>

          <section>
            <p className="text-base font-black">ประเภทรายการ</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <TypeButton
                active={transaction.type === "expense"}
                label="รายจ่าย"
                color={accent}
                onClick={() => setTransaction({ ...transaction, type: "expense", category: expenseOptions[0] ?? "อื่นๆ" })}
              />
              <TypeButton
                active={transaction.type === "income"}
                label="รายรับ"
                color={green}
                onClick={() => setTransaction({ ...transaction, type: "income", category: incomeOptions[0] ?? "อื่นๆ" })}
              />
            </div>
          </section>

          <label className="block">
            <span className="text-base font-black">หมวด</span>
            <select
              value={transaction.category}
              onChange={(event) => setTransaction({ ...transaction, category: event.target.value })}
              className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4 text-base shadow-sm outline-none focus:border-[#6DC5AD]"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-base font-black">จำนวนเงิน</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={transaction.amount}
                onChange={(event) => setTransaction({ ...transaction, amount: Number(event.target.value) })}
                className="h-11 min-w-0 flex-1 rounded-md border border-black/10 px-3 text-base shadow-sm outline-none focus:border-[#6DC5AD]"
              />
              <span className="font-bold text-[#6b7280]">฿</span>
            </div>
          </label>

          {paymentOptions.length > 0 && (
            <label className="block">
              <span className="text-base font-black">ช่องทางชำระเงิน</span>
              <select
                value={transaction.payment_channel ?? ""}
                onChange={(event) => setTransaction({ ...transaction, payment_channel: event.target.value || null })}
                className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4 text-base shadow-sm outline-none focus:border-[#6DC5AD]"
              >
                <option value="">ยังไม่ระบุ</option>
                {(transaction.payment_channel && !paymentOptions.includes(transaction.payment_channel)
                  ? [transaction.payment_channel, ...paymentOptions]
                  : paymentOptions
                ).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-base font-black">วันที่และเวลา</span>
            <div className="mt-2 flex h-11 items-center gap-3 rounded-md border border-black/10 px-3 shadow-sm">
              <CalendarDays className="h-5 w-5" />
              <input
                type="date"
                value={transaction.date}
                onChange={(event) => setTransaction({ ...transaction, date: event.target.value })}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </div>
          </label>

          {error && <p className="rounded-md bg-[#FCECEF] p-3 text-sm font-bold text-[#DC143C]">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-md text-base font-black text-[#082f24] disabled:opacity-60"
            style={{ backgroundColor: green }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </div>
      {confirmingDelete && (
        <ConfirmDeleteDialog
          confirming={saving}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </main>
  );
}

function transactionLoadFailureContent(kind: AppErrorKind) {
  if (kind === "not_found") {
    return {
      title: "ไม่พบรายการนี้แล้ว",
      description: "รายการอาจถูกลบ หรือเป็นลิงก์จาก Flex Message ก่อนย้ายฐานข้อมูล",
    };
  }
  if (kind === "authentication") {
    return {
      title: "ยืนยันบัญชี LINE ไม่สำเร็จ",
      description: "กรุณาเปิดหน้านี้จากเมนูใน LINE หรือลองเข้าสู่ระบบใหม่อีกครั้ง",
    };
  }
  return {
    title: "โหลดรายการไม่สำเร็จ",
    description: "Backend อาจกำลังเริ่มทำงานหรือเชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง",
  };
}

function closeLiffWindow() {
  const lineWindow = window as Window & { liff?: LiffClient };
  if (lineWindow.liff?.closeWindow) {
    lineWindow.liff.closeWindow();
    return;
  }
  window.history.back();
}

function retryTransactionLoad(kind: AppErrorKind) {
  const lineWindow = window as Window & { liff?: LiffClient };
  if (kind === "authentication") lineWindow.liff?.logout?.();
  window.location.reload();
}

function ConfirmDeleteDialog({
  confirming = false,
  onCancel,
  onConfirm,
}: {
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-5">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" className="w-full max-w-md rounded-md bg-white p-6 shadow-2xl">
        <h2 id="confirm-delete-title" className="text-lg font-black text-[#151b18]">ยืนยันการลบรายการ</h2>
        <p className="mt-3 text-sm font-semibold text-[#6b7280]">คุณต้องการลบรายการนี้ใช่หรือไม่?</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={confirming} className="h-10 rounded-md border border-black/10 bg-white px-5 text-sm font-black text-[#151b18] shadow-sm disabled:opacity-60">
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm} disabled={confirming} className="h-10 rounded-md px-5 text-sm font-black text-white shadow-sm disabled:opacity-60" style={{ backgroundColor: accent }}>
            ลบรายการ
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-md border text-base font-black"
      style={{
        borderColor: color,
        backgroundColor: active ? `${color}1A` : "#FFFFFF",
        color,
      }}
    >
      {label}
    </button>
  );
}

async function loadLineUserId(): Promise<string> {
  const liffId = resolveLiffId();
  if (!liffId || typeof window === "undefined") {
    return "";
  }

  await ensureLiffSdk();
  const lineWindow = window as Window & { liff?: LiffClient };
  if (!lineWindow.liff) {
    return "";
  }

  await lineWindow.liff.init({ liffId });
  if (!lineWindow.liff.isLoggedIn()) {
    lineWindow.liff.login({ redirectUri: resolveLiffRedirectUri(liffId) });
    return "";
  }

  try {
    const contextUserId = lineWindow.liff.getContext?.()?.userId;
    const profile = await lineWindow.liff.getProfile();
    return contextUserId || profile.userId;
  } catch {
    return lineWindow.liff.getContext?.()?.userId || lineWindow.liff.getDecodedIDToken?.()?.sub || "";
  }
}

function resolveLiffId() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || DEFAULT_LIFF_ID;
  return liffId === KNOWN_WRONG_LIFF_ID ? DEFAULT_LIFF_ID : liffId;
}

function resolveLiffRedirectUri(liffId: string) {
  const url = new URL(window.location.href);
  const frontendOrigin = (process.env.NEXT_PUBLIC_FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN).replace(/\/$/, "");

  if (url.hostname !== "liff.line.me") {
    return `${frontendOrigin}${normalizeLiffAppPath(url.pathname)}${url.search}`;
  }

  const statePath = url.searchParams.get("liff.state");
  const decodedStatePath = statePath ? decodeURIComponent(statePath) : "";
  const pathFromLiffUrl = url.pathname.startsWith(`/${liffId}`) ? url.pathname.slice(liffId.length + 1) : "";
  const path = normalizeLiffAppPath(decodedStatePath || pathFromLiffUrl || "/liff/transactions");
  return `${frontendOrigin}${path}${url.search}`;
}

function normalizeLiffAppPath(value: string) {
  const path = value.startsWith("/") ? value : `/${value}`;
  return path.startsWith("/liff/transactions") ? path : "/liff/transactions";
}

function ensureLiffSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const lineWindow = window as Window & { liff?: LiffClient };
  if (lineWindow.liff) return Promise.resolve();

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

function ensureCategoryOption(categories: string[], category: string) {
  return category && !categories.includes(category) ? [...categories, category] : categories;
}

function displayCategory(category: string, type: "expense" | "income", expenseOptions: string[], incomeOptions: string[]) {
  const mapped = categoryNameMap[category] ?? category;
  const defaults = type === "income" ? incomeCategories : expenseCategories;
  const stored = type === "income" ? incomeOptions : expenseOptions;
  if (stored.includes(mapped)) return mapped;

  const defaultIndex = defaults.indexOf(mapped);
  if (defaultIndex >= 0 && stored[defaultIndex]) {
    return stored[defaultIndex];
  }

  return mapped;
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
