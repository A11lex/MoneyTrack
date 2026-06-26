"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";

import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/api";
import type { Transaction, TransactionInput } from "@/lib/types";

const accent = "#DC143C";
const green = "#6DC5AD";

const expenseCategories = ["Food", "Transport", "Rent / Home", "Utilities", "Debt Payment", "Shopping", "Health", "Business Cost", "Other Expense"];
const incomeCategories = ["Salary", "Freelance", "Business Revenue", "Other Income"];

export default function EditTransactionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const transactionId = Number(params.id);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isFinite(transactionId)) return;
    getTransaction(transactionId)
      .then(setTransaction)
      .catch(() => setError("โหลดรายการไม่สำเร็จ"));
  }, [transactionId]);

  const categories = useMemo(
    () => (transaction?.type === "income" ? incomeCategories : expenseCategories),
    [transaction?.type],
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
      await updateTransaction(transaction.id, payload);
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
      await deleteTransaction(transaction.id);
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
            onClick={remove}
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
                onClick={() => setTransaction({ ...transaction, type: "expense", category: "Other Expense" })}
              />
              <TypeButton
                active={transaction.type === "income"}
                label="รายรับ"
                color={green}
                onClick={() => setTransaction({ ...transaction, type: "income", category: "Other Income" })}
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
    </main>
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
