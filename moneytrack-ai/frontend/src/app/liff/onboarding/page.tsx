import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding-flow";

export const metadata: Metadata = {
  title: "เริ่มต้นใช้งาน",
};

export default function LiffOnboardingPage() {
  return <OnboardingFlow />;
}
