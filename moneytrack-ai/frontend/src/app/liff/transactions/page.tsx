import type { Metadata } from "next";

import { LiffAppView } from "@/components/liff-app-view";

export const metadata: Metadata = {
  title: "รายการ",
};

export default function LiffTransactionsPage() {
  return <LiffAppView tab="transactions" />;
}
