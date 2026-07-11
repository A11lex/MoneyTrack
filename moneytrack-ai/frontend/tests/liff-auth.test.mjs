import assert from "node:assert/strict";
import test from "node:test";

import { ensureLiffAuthenticated } from "../src/lib/liff-auth.ts";

test("starts LINE login once and reports that navigation is in progress", async () => {
  let loginCalls = 0;
  const client = {
    init: async () => undefined,
    isLoggedIn: () => false,
    login: () => {
      loginCalls += 1;
    },
  };

  const status = await ensureLiffAuthenticated(client, "liff-id", "https://example.com/liff/onboarding");

  assert.equal(status, "redirecting");
  assert.equal(loginCalls, 1);
});

test("does not start LINE login for an authenticated session", async () => {
  let loginCalls = 0;
  const client = {
    init: async () => undefined,
    isLoggedIn: () => true,
    login: () => {
      loginCalls += 1;
    },
  };

  const status = await ensureLiffAuthenticated(client, "liff-id", "https://example.com/liff/summary");

  assert.equal(status, "authenticated");
  assert.equal(loginCalls, 0);
});
