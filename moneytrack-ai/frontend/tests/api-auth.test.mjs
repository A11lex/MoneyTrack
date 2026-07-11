import assert from "node:assert/strict";
import test from "node:test";

import { buildLineAuthorizationHeaders } from "../src/lib/line-api-auth.ts";

test("adds a bearer token when LIFF provides an ID token", () => {
  assert.deepEqual(buildLineAuthorizationHeaders("id-token-123"), {
    Authorization: "Bearer id-token-123",
  });
});

test("does not add an authorization header without an ID token", () => {
  assert.deepEqual(buildLineAuthorizationHeaders(null), {});
});
