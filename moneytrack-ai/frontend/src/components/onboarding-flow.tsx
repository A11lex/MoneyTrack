"use client";

import type { ElementType, ReactNode } from "react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  HandCoins,
  Home,
  Loader2,
  Megaphone,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";

import { getLineUserSetup, saveLineUserOnboarding, upsertLineUser } from "@/lib/api";

type Step = "welcome" | "source" | "expense" | "income" | "done";

const steps: Step[] = ["welcome", "source", "expense", "income", "done"];

type LineProfile = {
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
};

const mockProfile: LineProfile = {
  line_user_id: "mock-line-user",
  display_name: "LINE User",
  picture_url: null,
};

const DEFAULT_LIFF_ID = "2010521304-BrGvBhsP";
const KNOWN_WRONG_LIFF_ID = "2010521304-BrGvBhsp";
const DEFAULT_FRONTEND_ORIGIN = "https://money-track-sandy.vercel.app";

type LiffProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};
type LiffDecodedIDToken = {
  sub?: string;
  name?: string;
  picture?: string;
};
type LiffContext = {
  userId?: string;
};

type LiffClient = {
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  getProfile: () => Promise<LiffProfile>;
  getDecodedIDToken?: () => LiffDecodedIDToken | null;
  getContext?: () => LiffContext | null;
  closeWindow?: () => void;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

const sources = [
  { label: "คนรู้จัก", icon: Megaphone },
  { label: "TikTok", icon: Sparkles },
  { label: "Facebook", icon: CircleDollarSign },
  { label: "Instagram", icon: PiggyBank },
  { label: "Google", icon: TrendingUp },
  { label: "อื่น ๆ", icon: MoreHorizontal },
];

const expenseCategories = [
  { label: "Food", text: "อาหาร", icon: Utensils, recommended: true },
  { label: "Transport", text: "เดินทาง", icon: Truck, recommended: true },
  { label: "Rent / Home", text: "ที่พัก", icon: Home, recommended: true },
  { label: "Shopping", text: "ช้อปปิ้ง", icon: ShoppingBag },
  { label: "Utilities", text: "ค่าน้ำค่าไฟ", icon: ReceiptText, recommended: true },
  { label: "Other Expense", text: "อื่น ๆ", icon: Plus, isOther: true },
];

const incomeCategories = [
  { label: "Salary", text: "เงินเดือน", icon: WalletCards, recommended: true },
  { label: "Business Revenue", text: "ธุรกิจส่วนตัว", icon: BriefcaseBusiness, recommended: true },
  { label: "Freelance", text: "งานพิเศษ", icon: Sparkles, recommended: true },
  { label: "Other Income", text: "อื่น ๆ", icon: HandCoins, isOther: true },
];

export function OnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [source, setSource] = useState("คนรู้จัก");
  const [expenses, setExpenses] = useState<string[]>(["Food", "Transport", "Rent / Home", "Utilities"]);
  const [income, setIncome] = useState<string[]>(["Salary", "Business Revenue", "Freelance"]);
  const [showExpenseCustom, setShowExpenseCustom] = useState(false);
  const [showIncomeCustom, setShowIncomeCustom] = useState(false);
  const [expenseCustomName, setExpenseCustomName] = useState("");
  const [incomeCustomName, setIncomeCustomName] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [profile, setProfile] = useState<LineProfile>(mockProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  useEffect(() => {
    let mounted = true;
    loadLineProfile()
      .then(async (loadedProfile) => {
        if (!mounted) return;
        setProfile(loadedProfile);
        if (!loadedProfile.line_user_id) return;

        const setup = await getLineUserSetup(loadedProfile.line_user_id);
        if (setup?.onboarding_completed) {
          window.location.replace("/liff/summary");
        }
      })
      .catch(() => {
        if (mounted) setProfile(mockProfile);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await upsertLineUser(profile);
      await saveLineUserOnboarding(profile.line_user_id, {
        discovery_source: source,
        expense_categories: expenses,
        income_categories: income,
        monthly_budgets: {
          Food: 15000,
          Transport: 3000,
          Utilities: 4000,
        },
      });
      setStepIndex(steps.indexOf("done"));
    } catch {
      setError("ยังบันทึกไม่ได้ ลองตรวจสอบ backend แล้วกดอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  function addCustomCategory(kind: "expense" | "income") {
    const name = kind === "expense" ? expenseCustomName.trim() : incomeCustomName.trim();
    const selected = kind === "expense" ? expenses : income;
    const setSelected = kind === "expense" ? setExpenses : setIncome;
    const setInput = kind === "expense" ? setExpenseCustomName : setIncomeCustomName;

    if (!name) {
      setCustomError("ใส่ชื่อหมวดก่อนกดเพิ่ม");
      return;
    }

    if (selected.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setCustomError("มีหมวดนี้แล้ว");
      return;
    }

    setSelected([...selected, name]);
    setInput("");
    setCustomError(null);
  }

  function next() {
    if (step === "income") {
      finish();
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  }

  function back() {
    setStepIndex((value) => Math.max(value - 1, 0));
  }

  return (
    <main className="min-h-screen bg-white text-[#1b1405]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#6dc5ad]/18 blur-3xl" />
        <div className="absolute left-5 top-28 rotate-[-18deg] text-5xl text-[#6dc5ad]/20">฿</div>
        <div className="absolute right-8 top-36 rotate-12 text-4xl text-[#6dc5ad]/24">฿</div>
        <div className="absolute bottom-28 left-10 rotate-6 text-5xl text-[#0d3b22]/8">฿</div>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-[0_0_50px_rgba(13,74,43,0.08)]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#0d4a2b]/10 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Image src="/brand/moneytrack-pro.png" alt="เงินไปไหน" width={44} height={44} className="h-11 w-11 rounded-full object-cover ring-2 ring-white" priority />
            <div>
              <p className="text-lg font-black leading-none text-[#251704]">เงินไปไหน?</p>
              <p className="mt-1 text-xs font-bold text-[#0d4a2b]">จัดการง่าย เห็นภาพชัด</p>
            </div>
          </div>
          <div className="flex rounded-full bg-[#eaf8f4] p-1 text-sm font-black text-[#0d4a2b]">
            <button type="button" onClick={() => setLanguage("th")} className={`rounded-full px-3 py-2 ${language === "th" ? "bg-white text-[#1b1405] shadow-sm" : ""}`}>
              ไทย
            </button>
            <button type="button" onClick={() => setLanguage("en")} className={`rounded-full px-3 py-2 ${language === "en" ? "bg-white text-[#1b1405] shadow-sm" : ""}`}>
              EN
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col px-5 py-7">
          {step !== "done" && (
            <>
              <p className="text-center text-base font-black text-[#7b6220]">ติดตั้งครั้งแรก</p>
              <div className="mt-5 grid grid-cols-5 gap-3" aria-hidden="true">
                {steps.map((item, index) => (
                  <div key={item} className={`h-2 rounded-full ${index <= stepIndex ? "bg-[#6dc5ad]" : "bg-[#edf4f2]"}`} />
                ))}
              </div>
              <span className="sr-only">Progress {Math.round(progress)}%</span>
            </>
          )}

          {step === "welcome" && (
            <div className="flex flex-1 flex-col pt-8">
              <div className="mx-auto w-full max-w-[18rem]">
                <Image src="/brand/moneytrack-pro.png" alt="เงินไปไหน จัดการจ่าย เห็นภาพชัด เก็บเงินอยู่" width={1040} height={1040} className="w-full rounded-[1.75rem] object-cover shadow-[0_18px_45px_rgba(95,65,9,0.24)] ring-4 ring-white/80" priority />
              </div>
              <div className="mt-8 rounded-md border border-[#6dc5ad]/35 bg-white p-5 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#418b7b]">MoneyTrack AI</p>
                <h1 className="mt-3 text-3xl font-black leading-tight text-[#221603]">ยินดีต้อนรับสู่เงินไปไหน?</h1>
                <p className="mt-4 text-base leading-7 text-[#665728]">ผู้ช่วยจดรายรับรายจ่ายผ่าน LINE พิมพ์สั้น ๆ แล้วให้ระบบจัดหมวด สรุปเงิน และเตือนก่อนใช้เกินงบ</p>
                <div className="mt-5 rounded-md bg-[#eaf8f4] px-4 py-3 text-sm font-black text-[#0d4a2b]">ใช้เวลาไม่ถึง 1 นาที ตั้งค่าให้พร้อมใช้งาน</div>
              </div>
              <PrimaryButton onClick={next}>เริ่มต้นใช้งาน</PrimaryButton>
            </div>
          )}

          {step === "source" && (
            <StepPanel title="รู้จักเงินไปไหนจากช่องทางไหน?" subtitle="เลือก 1 ข้อ เพื่อให้เรารู้จักผู้ใช้งานจริงมากขึ้น">
              <div className="grid grid-cols-2 gap-3">
                {sources.map((item) => (
                  <ChoiceButton key={item.label} selected={source === item.label} onClick={() => setSource(item.label)}>
                    <item.icon className="h-7 w-7 text-[#0d4a2b]" />
                    {item.label}
                  </ChoiceButton>
                ))}
              </div>
              <FooterNav onBack={back} onNext={next} />
            </StepPanel>
          )}

          {step === "expense" && (
            <StepPanel title="เลือกหมวดรายจ่าย" subtitle="เลือกหมวดที่ใช้บ่อย หรือกดอื่น ๆ เพื่อเพิ่มหมวดเองได้ไม่จำกัด">
              <CategoryGrid options={expenseCategories} selected={expenses} onToggle={(value) => toggle(value, expenses, setExpenses)} onOtherClick={() => setShowExpenseCustom(true)} />
              {showExpenseCustom && (
                <CustomCategoryInput
                  id="expense-custom-category"
                  label="เพิ่มหมวดรายจ่ายเอง"
                  value={expenseCustomName}
                  selected={customValues(expenseCategories, expenses)}
                  onChange={setExpenseCustomName}
                  onAdd={() => addCustomCategory("expense")}
                  onRemove={(value) => setExpenses(expenses.filter((item) => item !== value))}
                />
              )}
              {customError && <p className="mt-3 rounded-md border border-[#d94025]/20 bg-[#fff0e6] p-3 text-sm font-bold text-[#9d2b14]">{customError}</p>}
              <FooterNav onBack={back} onNext={next} />
            </StepPanel>
          )}

          {step === "income" && (
            <StepPanel title="เลือกหมวดรายรับ" subtitle="เลือกแหล่งรายรับหลัก หรือกดอื่น ๆ เพื่อเพิ่มหมวดเองได้ไม่จำกัด">
              <CategoryGrid options={incomeCategories} selected={income} onToggle={(value) => toggle(value, income, setIncome)} onOtherClick={() => setShowIncomeCustom(true)} />
              {showIncomeCustom && (
                <CustomCategoryInput
                  id="income-custom-category"
                  label="เพิ่มหมวดรายรับเอง"
                  value={incomeCustomName}
                  selected={customValues(incomeCategories, income)}
                  onChange={setIncomeCustomName}
                  onAdd={() => addCustomCategory("income")}
                  onRemove={(value) => setIncome(income.filter((item) => item !== value))}
                />
              )}
              {customError && <p className="mt-3 rounded-md border border-[#d94025]/20 bg-[#fff0e6] p-3 text-sm font-bold text-[#9d2b14]">{customError}</p>}
              {error && <p className="mt-4 rounded-md border border-[#d94025]/20 bg-[#fff0e6] p-3 text-sm font-bold text-[#9d2b14]">{error}</p>}
              <FooterNav onBack={back} onNext={next} nextLabel={saving ? "กำลังบันทึก..." : "เสร็จสิ้น"} disabled={saving} loading={saving} />
            </StepPanel>
          )}

          {step === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="rounded-full bg-white p-5 shadow-[0_16px_40px_rgba(52,91,48,0.18)]">
                <CheckCircle2 className="h-24 w-24 text-[#0d8b4c]" strokeWidth={1.8} />
              </div>
              <h1 className="mt-8 text-4xl font-black text-[#0d4a2b]">พร้อมใช้งานแล้ว!</h1>
              <p className="mt-4 text-lg leading-8 text-[#665728]">กลับไปที่แชท แล้วลองพิมพ์ “ข้าว 80” หรือ “สรุปวันนี้” ได้เลย</p>
              <PrimaryButton onClick={() => { window.location.href = "/liff/summary"; }}>เริ่มต้นใช้งาน</PrimaryButton>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StepPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mt-11 flex flex-1 flex-col">
      <div className="rounded-md border border-[#6dc5ad]/35 bg-white p-5 shadow-sm">
        <p className="text-sm font-black text-[#418b7b]">ตั้งค่าให้บอทเข้าใจคุณ</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#0d4a2b]">{title}</h1>
        <p className="mt-4 text-base leading-7 text-[#665728]">{subtitle}</p>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function CategoryGrid({
  options,
  selected,
  onToggle,
  onOtherClick,
}: {
  options: { label: string; text: string; icon: ElementType; recommended?: boolean; isOther?: boolean }[];
  selected: string[];
  onToggle: (value: string) => void;
  onOtherClick: () => void;
}) {
  const selectedClass = "bg-[#6dc5ad] text-[#082f24] border-[#56ad97]";

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((item) => {
        const Icon = item.icon;
        const isSelected = selected.includes(item.label);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => (item.isOther ? onOtherClick() : onToggle(item.label))}
            className={`flex min-h-24 items-center gap-3 rounded-md border p-4 text-left text-lg font-black shadow-sm transition active:scale-[0.99] ${
              isSelected ? selectedClass : "border-[#d8eee8] bg-white text-[#241800]"
            }`}
          >
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${isSelected ? "bg-white/30" : "bg-[#eaf8f4]"}`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 truncate">{item.text}</span>
            {item.recommended && <span className="ml-auto text-[#0d4a2b]">★</span>}
          </button>
        );
      })}
    </div>
  );
}

function CustomCategoryInput({
  id,
  label,
  value,
  selected,
  onChange,
  onAdd,
  onRemove,
}: {
  id: string;
  label: string;
  value: string;
  selected: string[];
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="mt-4 rounded-md border border-[#d8eee8] bg-white p-4 shadow-sm">
      <label htmlFor={id} className="text-sm font-black text-[#0d4a2b]">
        {label}
      </label>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder="เช่น ลูก, สัตว์เลี้ยง, ภาษี"
          className="min-w-0 rounded-md border border-[#d8eee8] bg-white px-3 py-3 text-base font-bold outline-none focus:border-[#6dc5ad] focus:ring-2 focus:ring-[#6dc5ad]/25"
        />
        <button type="button" onClick={onAdd} className="rounded-md bg-[#6dc5ad] px-4 py-3 text-base font-black text-[#082f24]">
          เพิ่ม
        </button>
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((item) => (
            <button key={item} type="button" onClick={() => onRemove(item)} className="inline-flex items-center gap-2 rounded-full border border-[#d8eee8] bg-[#eaf8f4] px-3 py-2 text-sm font-black text-[#0d4a2b]">
              {item}
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">ลบ {item}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-20 items-center gap-3 rounded-md border p-4 text-left text-lg font-black shadow-sm transition active:scale-[0.99] ${
        selected ? "border-[#56ad97] bg-[#6dc5ad] text-[#082f24]" : "border-[#d8eee8] bg-white text-[#241800]"
      }`}
    >
      {children}
    </button>
  );
}

function FooterNav({
  onBack,
  onNext,
  nextLabel = "ถัดไป",
  disabled = false,
  loading = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="mt-8 grid grid-cols-[auto_1fr] gap-3">
      <button type="button" onClick={onBack} className="grid h-14 w-14 place-items-center rounded-md border border-[#d8eee8] bg-white shadow-sm" aria-label="ย้อนกลับ">
        <ChevronLeft className="text-[#0d4a2b]" />
      </button>
      <button type="button" disabled={disabled} onClick={onNext} className="flex h-14 items-center justify-center gap-2 rounded-md bg-[#6dc5ad] text-lg font-black text-[#082f24] shadow-sm disabled:opacity-60">
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {nextLabel}
      </button>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-auto h-16 w-full rounded-md bg-[#6dc5ad] text-xl font-black text-[#082f24] shadow-[0_14px_28px_rgba(109,197,173,0.28)]">
      {children}
    </button>
  );
}

function toggle(value: string, selected: string[], setSelected: (value: string[]) => void) {
  if (selected.includes(value)) {
    setSelected(selected.filter((item) => item !== value));
    return;
  }
  setSelected([...selected, value]);
}

function customValues(options: { label: string }[], selected: string[]) {
  const defaultLabels = new Set(options.map((item) => item.label));
  return selected.filter((item) => !defaultLabels.has(item));
}

async function loadLineProfile(): Promise<LineProfile> {
  const liffId = resolveLiffId();
  if (!liffId || typeof window === "undefined") {
    return mockProfile;
  }

  await loadLiffSdk();
  if (!window.liff) {
    return mockProfile;
  }

  await window.liff.init({ liffId });
  if (!window.liff.isLoggedIn()) {
    window.liff.login({ redirectUri: resolveLiffRedirectUri(liffId) });
    return mockProfile;
  }

  return readLineProfileFromLiff(window.liff);
}

async function readLineProfileFromLiff(liff: LiffClient): Promise<LineProfile> {
  try {
    const context = liff.getContext?.();
    const liffProfile = await liff.getProfile();
    return {
      line_user_id: context?.userId || liffProfile.userId,
      display_name: liffProfile.displayName,
      picture_url: liffProfile.pictureUrl ?? null,
    };
  } catch {
    const token = liff.getDecodedIDToken?.();
    const context = liff.getContext?.();
    if (token?.sub) {
      return {
        line_user_id: context?.userId || token.sub,
        display_name: token.name || "LINE User",
        picture_url: token.picture ?? null,
      };
    }

    if (context?.userId) {
      return {
        line_user_id: context.userId,
        display_name: "LINE User",
        picture_url: null,
      };
    }

    throw new Error("LINE profile is unavailable");
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
    return `${frontendOrigin}${normalizeLiffAppPath(url.pathname)}`;
  }

  const statePath = url.searchParams.get("liff.state");
  const decodedStatePath = statePath ? decodeURIComponent(statePath) : "";
  const pathFromLiffUrl = url.pathname.startsWith(`/${liffId}`) ? url.pathname.slice(liffId.length + 1) : "";
  const path = normalizeLiffAppPath(decodedStatePath || pathFromLiffUrl || "/liff/onboarding");
  return `${frontendOrigin}${path}`;
}

function normalizeLiffAppPath(value: string) {
  const path = value.startsWith("/") ? value : `/${value}`;
  return path.startsWith("/liff/") ? path : "/liff/onboarding";
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
