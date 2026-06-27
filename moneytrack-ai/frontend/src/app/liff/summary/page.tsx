import type { Metadata } from "next";

import { LiffAppView } from "@/components/liff-app-view";

export const metadata: Metadata = {
  title: "สรุป",
};

export default function LiffSummaryPage() {
  return <LiffAppView tab="summary" />;
}
