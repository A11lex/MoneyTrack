import type { Metadata } from "next";

import { LiffAppView } from "@/components/liff-app-view";

export const metadata: Metadata = {
  title: "วิเคราะห์",
};

export default function LiffInsightsPage() {
  return <LiffAppView tab="insights" />;
}
