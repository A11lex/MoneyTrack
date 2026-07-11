import assert from "node:assert/strict";
import test from "node:test";

import { classifyAppError } from "../src/lib/app-flow.ts";

test("treats a missing transaction as stale instead of restarting onboarding", () => {
  assert.equal(classifyAppError({ status: 404 }), "not_found");
});

test("separates LINE authentication failures from missing setup", () => {
  assert.equal(classifyAppError({ status: 401 }), "authentication");
  assert.equal(classifyAppError({ status: 403 }), "authentication");
});

test("keeps backend and network failures on a retry screen", () => {
  assert.equal(classifyAppError({ status: 503 }), "unavailable");
  assert.equal(classifyAppError(new Error("network failed")), "unavailable");
});
