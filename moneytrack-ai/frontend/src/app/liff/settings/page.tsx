import type { Metadata } from "next";

import { LiffAppView } from "@/components/liff-app-view";

export const metadata: Metadata = {
  title: "ตั้งค่า",
};

export default function LiffSettingsPage() {
  return <LiffAppView tab="settings" />;
}
