import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "แดชบอร์ด",
};

export default function Home() {
  return <Dashboard />;
}
