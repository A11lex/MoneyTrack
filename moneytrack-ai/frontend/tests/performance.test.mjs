import assert from "node:assert/strict";
import test from "node:test";

import { warmBackend } from "../src/lib/backend-warmup.ts";

test("warms the backend through the lightweight health endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return { ok: true };
  };

  try {
    await warmBackend("https://api.example.test/");
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/health$/);
    assert.equal(requests[0].init.cache, "no-store");
    assert.equal(requests[0].init.credentials, "omit");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
