import type { Metadata } from "next";

import { LiffAppView } from "@/components/liff-app-view";

export const metadata: Metadata = {
  title: "หมวด / งบ",
};

export default function LiffCategoriesPage() {
  return <LiffAppView tab="categories" />;
}
