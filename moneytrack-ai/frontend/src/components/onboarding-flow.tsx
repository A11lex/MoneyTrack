"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, HandCoins, Home, LineChart, Loader2, Plus, ReceiptText, ShoppingBag, Sparkles, Utensils, WalletCards } from "lucide-react";

import { saveLineUserOnboarding, upsertLineUser } from "@/lib/api";

type Step = "welcome" | "source" | "expense" | "income" | "done";

const steps: Step[] = ["welcome", "source", "expense", "income", "done"];
const mockProfile = {
  line_user_id: "mock-line-user",
  display_name: "LINE User",
  picture_url: null,
};

const sources = [
  { label: "คนรู้จัก", icon: "people" },
  { label: "TikTok", icon: "tiktok" },
  { label: "Facebook", icon: "facebook" },
  { label: "Instagram", icon: "instagram" },
  { label: "Google", icon: "google" },
  { label: "อื่น ๆ", icon: "more" },
];

const expenseCategories = [
  { label: "Food", text: "อาหาร", icon: Utensils, recommended: true },
  { label: "Transport", text: "เดินทาง", icon: LineChart, recommended: true },
  { label: "Rent / Home", text: "ที่พัก", icon: Home, recommended: true },
  { label: "Shopping", text: "ช้อปปิ้ง", icon: ShoppingBag },
  { label: "Utilities", text: "ค่าน้ำค่าไฟ", icon: ReceiptText, recommended: true },
  { label: "Other Expense", text: "อื่น ๆ", icon: Plus },
];

const incomeCategories = [
  { label: "Salary", text: "เงินเดือน", icon: WalletCards, recommended: true },
  { label: "Business Revenue", text: "ธุรกิจส่วนตัว", icon: Home, recommended: true },
  { label: "Freelance", text: "งานพิเศษ", icon: Sparkles, recommended: true },
  { label: "Other Income", text: "รายรับอื่น ๆ", icon: HandCoins },
];

export function OnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [source, setSource] = useState("คนรู้จัก");
  const [expenses, setExpenses] = useState<string[]>(["Food", "Transport", "Rent / Home", "Utilities"]);
  const [income, setIncome] = useState<string[]>(["Salary", "Business Revenue", "Freelance"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = steps[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / steps.length) * 100, [stepIndex]);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await upsertLineUser(mockProfile);
      await saveLineUserOnboarding(mockProfile.line_user_id, {
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
      setError("ยังบันทึกไม่ได้ ลองเปิด backend แล้วลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
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
    <main className="min-h-screen bg-[#fffaf2] text-[#111111]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white/95 px-5 py-4">
          <div>
            <p className="text-lg font-bold">เงินไปไหน?</p>
            <p className="text-xs text-[#7A4A1F]">LIFF onboarding mock</p>
          </div>
          <div className="flex rounded-full bg-[#f4edf3] p-1 text-sm font-semibold">
            <button type="button" onClick={() => setLanguage("th")} className={`rounded-full px-4 py-2 ${language === "th" ? "bg-white shadow-sm" : "text-black/50"}`}>
              ไทย
            </button>
            <button type="button" onClick={() => setLanguage("en")} className={`rounded-full px-4 py-2 ${language === "en" ? "bg-white shadow-sm" : "text-black/50"}`}>
              EN
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col px-5 py-8">
          {step !== "done" && (
            <>
              <p className="text-center text-xl font-bold text-black/55">ติดตั้งครั้งแรก</p>
              <div className="mt-6 grid grid-cols-5 gap-3">
                {steps.map((item, index) => (
                  <div key={item} className={`h-2 rounded-full ${index <= stepIndex ? "bg-[#F04FA3]" : "bg-black/5"}`} />
                ))}
              </div>
              <span className="sr-only">Progress {Math.round(progress)}%</span>
            </>
          )}

          {step === "welcome" && (
            <div className="mt-12 flex flex-1 flex-col">
              <h1 className="text-center text-4xl font-extrabold leading-tight text-[#F04FA3]">ยินดีต้อนรับสู่เงินไปไหน!</h1>
              <p className="mt-4 text-center text-lg leading-8 text-black/55">ผู้ช่วยจัดการการเงินส่วนตัวของคุณ จดง่ายผ่าน LINE และสรุปให้เข้าใจทันที</p>
              <div className="mt-8 rounded-md border border-[#f1c4db] bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold">พิมพ์บอกป้า ป้าจดให้</h2>
                <p className="mt-3 leading-7 text-black/55">ตัวอย่าง: ข้าว 80, รับเงินลูกค้า 2500, สรุปวันนี้</p>
                <div className="mt-5 rounded-md bg-[#FFF3D6] p-4 text-sm font-semibold text-[#7A4A1F]">ใช้เวลาไม่ถึง 1 นาที ตั้งค่าให้พร้อมใช้งาน</div>
              </div>
              <PrimaryButton onClick={next}>เริ่มต้นใช้งาน</PrimaryButton>
            </div>
          )}

          {step === "source" && (
            <StepPanel title="รู้จักเงินไปไหนจากช่องทางไหน?" subtitle="เลือก 1 ข้อ เพื่อให้เรารู้จักคุณมากขึ้น">
              <div className="grid grid-cols-2 gap-4">
                {sources.map((item) => (
                  <ChoiceButton key={item.label} selected={source === item.label} onClick={() => setSource(item.label)}>
                    <SourceIcon icon={item.icon} />
                    {item.label}
                  </ChoiceButton>
                ))}
              </div>
              <FooterNav onBack={back} onNext={next} />
            </StepPanel>
          )}

          {step === "expense" && (
            <StepPanel title="เลือกหมวดรายจ่าย" subtitle="เลือกหมวดที่เหมาะกับคุณ เพื่อวางแผนการใช้จ่าย">
              <CategoryGrid options={expenseCategories} selected={expenses} onToggle={(value) => toggle(value, expenses, setExpenses)} color="#F04FA3" />
              <FooterNav onBack={back} onNext={next} />
            </StepPanel>
          )}

          {step === "income" && (
            <StepPanel title="เลือกหมวดรายรับ" subtitle="เลือกหมวดรายรับที่เหมาะกับคุณ เพื่อติดตามรายได้">
              <CategoryGrid options={incomeCategories} selected={income} onToggle={(value) => toggle(value, income, setIncome)} color="#6EC7B0" />
              {error && <p className="mt-4 rounded-md bg-[#fff3f3] p-3 text-sm font-semibold text-[#E60012]">{error}</p>}
              <FooterNav onBack={back} onNext={next} nextLabel={saving ? "กำลังบันทึก..." : "เสร็จสิ้น"} disabled={saving} loading={saving} />
            </StepPanel>
          )}

          {step === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-28 w-28 text-[#10c469]" strokeWidth={1.8} />
              <h1 className="mt-8 text-4xl font-extrabold text-[#F04FA3]">พร้อมใช้งานแล้ว!</h1>
              <p className="mt-4 text-lg leading-8 text-black/55">กลับไปที่แชท แล้วลองพิมพ์ “ข้าว 80” หรือ “สรุปวันนี้” ได้เลย</p>
              <PrimaryButton onClick={() => window.close()}>เริ่มต้นใช้งาน</PrimaryButton>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StepPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mt-14 flex flex-1 flex-col">
      <h1 className="text-4xl font-extrabold leading-tight text-[#F04FA3]">{title}</h1>
      <p className="mt-4 text-lg leading-8 text-black/55">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function CategoryGrid({
  options,
  selected,
  onToggle,
  color,
}: {
  options: { label: string; text: string; icon: React.ElementType; recommended?: boolean }[];
  selected: string[];
  onToggle: (value: string) => void;
  color: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {options.map((item) => {
        const Icon = item.icon;
        const isSelected = selected.includes(item.label);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onToggle(item.label)}
            className="flex min-h-24 items-center gap-3 rounded-md border border-black/10 bg-white p-4 text-left text-lg font-bold shadow-sm"
            style={isSelected ? { backgroundColor: color, color: "white" } : undefined}
          >
            <Icon className="h-8 w-8 shrink-0" />
            <span className="min-w-0 truncate">{item.text}</span>
            {item.recommended && <span className="ml-auto text-sm">★</span>}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-20 items-center gap-3 rounded-md border border-black/10 bg-white p-4 text-left text-lg font-bold shadow-sm ${selected ? "ring-4 ring-[#F04FA3]/20" : ""}`}
    >
      {children}
    </button>
  );
}

function SourceIcon({ icon }: { icon: string }) {
  if (icon === "instagram") return <span className="text-3xl font-black text-[#F04FA3]">◎</span>;
  if (icon === "facebook") return <span className="text-3xl font-black text-[#1877F2]">f</span>;
  if (icon === "tiktok") return <span className="text-3xl font-black">♪</span>;
  if (icon === "google") return <span className="text-2xl font-black text-[#4285F4]">G</span>;
  if (icon === "more") return <span className="text-3xl font-black text-black/50">...</span>;
  return <span className="text-3xl text-[#F04FA3]">👥</span>;
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
      <button type="button" onClick={onBack} className="grid h-14 w-14 place-items-center rounded-md border border-black/10 bg-white shadow-sm" aria-label="ย้อนกลับ">
        <ChevronLeft />
      </button>
      <button type="button" disabled={disabled} onClick={onNext} className="flex h-14 items-center justify-center gap-2 rounded-md bg-[#F04FA3] text-lg font-bold text-white shadow-sm disabled:opacity-60">
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {nextLabel}
      </button>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-auto h-16 w-full rounded-md bg-[#F04FA3] text-xl font-bold text-white shadow-sm">
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
