import { test } from "node:test";
import assert from "node:assert/strict";
import { botAuthorized } from "../src/lib/bot-auth";

test("bot API fails closed for absent, short or incorrect credentials", () => {
  const secret = "a".repeat(64);
  assert.equal(botAuthorized(null, secret), false);
  assert.equal(botAuthorized("Bearer abc", "abc"), false);
  assert.equal(botAuthorized("Bearer " + "b".repeat(64), secret), false);
  assert.equal(botAuthorized("Bearer " + secret, secret), true);
});
