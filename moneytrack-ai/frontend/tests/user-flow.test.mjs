import assert from "node:assert/strict";
import test from "node:test";

import { hasCompletedOnboarding } from "../src/lib/user-flow.ts";

test("requires onboarding when the LINE user does not exist", () => {
  assert.equal(hasCompletedOnboarding(null), false);
});

test("requires onboarding when a LINE user record exists but setup is incomplete", () => {
  assert.equal(hasCompletedOnboarding({ onboarding_completed: false }), false);
});

test("allows the app only after onboarding is complete", () => {
  assert.equal(hasCompletedOnboarding({ onboarding_completed: true }), true);
});
