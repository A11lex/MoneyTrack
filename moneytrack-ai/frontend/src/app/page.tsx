import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "สรุป",
};

export default function Home() {
  redirect("/liff/summary");
}
