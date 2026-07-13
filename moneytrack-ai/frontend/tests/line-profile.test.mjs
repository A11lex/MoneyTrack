import assert from "node:assert/strict";
import test from "node:test";

import { buildCanonicalLineProfile, canonicalLineUserId } from "../src/lib/line-profile.ts";

test("uses the verified ID token subject as the canonical LINE user id", () => {
  const profile = buildCanonicalLineProfile({
    token: { sub: "token-user", name: "Token Name", picture: "https://example.com/token.jpg" },
    profile: { userId: "context-user", displayName: "Wrong Account", pictureUrl: "https://example.com/wrong.jpg" },
  });

  assert.deepEqual(profile, {
    line_user_id: "token-user",
    display_name: "Token Name",
    picture_url: "https://example.com/token.jpg",
  });
});

test("only accepts LIFF profile details when they belong to the token subject", () => {
  const profile = buildCanonicalLineProfile({
    token: { sub: "token-user" },
    profile: { userId: "token-user", displayName: "Methemek", pictureUrl: "https://example.com/profile.jpg" },
  });

  assert.equal(profile.display_name, "Methemek");
  assert.equal(profile.picture_url, "https://example.com/profile.jpg");
});

test("rejects sessions without a token subject instead of falling back to context data", () => {
  assert.throws(() => canonicalLineUserId({}), (error) => error?.status === 401);
});
