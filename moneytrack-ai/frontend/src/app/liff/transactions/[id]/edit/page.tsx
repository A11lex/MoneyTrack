"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";

import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/api";
import type { Transaction, TransactionInput } from "@/lib/types";

const accent = "#DC143C";
const green = "#6DC5AD";
const DEFAULT_LIFF_ID = "2010521304-BrGvBhsp";

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
  getProfile: () => Promise<{ userId: string }>;
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(transactionId)) {
      router.replace("/liff/summary");
      return;
    }
    loadLineUserId()
      .catch(() => "")
      .then((loadedLineUserId) => {
        if (!loadedLineUserId) {
          throw new Error("LINE profile is required");
        }
        setLineUserId(loadedLineUserId);
        return getTransaction(transactionId, loadedLineUserId);
      })
      .then((item) => setTransaction({ ...item, category: displayCategory(item.category, item.type) }))
      .catch(() => {
        router.replace("/liff/summary");
      });
  }, [router, transactionId]);

  const categories = useMemo(
    () => ensureCategoryOption(transactionCategories(transaction?.type ?? "expense"), transaction?.category ?? ""),
    [transaction?.type, transaction?.category],
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
    };
    try {
      await updateTransaction(transaction.id, payload, lineUserId || undefined);
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
      await deleteTransaction(transaction.id, lineUserId || undefined);
      router.push("/liff/transactions");
    } catch {
      setError("ลบรายการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!transaction) {
    return (
      <main className="grid min-h-screen place-items-center bg-white text-[#151b18]">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#6DC5AD]" />
          <p className="mt-3 text-lg font-black">{error || "กำลังโหลดรายการ"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#151b18]">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 py-5">
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
                onClick={() => setTransaction({ ...transaction, type: "expense", category: transactionCategories("expense")[0] ?? "อื่นๆ" })}
              />
              <TypeButton
                active={transaction.type === "income"}
                label="รายรับ"
                color={green}
                onClick={() => setTransaction({ ...transaction, type: "income", category: transactionCategories("income")[0] ?? "อื่นๆ" })}
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
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || DEFAULT_LIFF_ID;
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
    lineWindow.liff.login({ redirectUri: window.location.href });
    return "";
  }

  const profile = await lineWindow.liff.getProfile();
  return profile.userId;
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

function transactionCategories(type: "expense" | "income") {
  return type === "income" ? loadStoredIncomeCategories() : loadStoredExpenseCategories();
}

function ensureCategoryOption(categories: string[], category: string) {
  return category && !categories.includes(category) ? [...categories, category] : categories;
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
