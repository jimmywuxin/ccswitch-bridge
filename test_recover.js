import { test } from "node:test";
import assert from "node:assert/strict";
import { rememberReasoning, recoverReasoning, sessionKey } from "./lib/recover.js";

test("rememberReasoning stores assistant reasoning_content", () => {
  const msgs = [{ role: "assistant", reasoning_content: "thinking..." }];
  rememberReasoning("test-key-1", msgs);
  // recover to verify it was stored
  const target = [{ role: "assistant", tool_calls: [{ id: "tc1" }] }];
  const count = recoverReasoning("test-key-1", target);
  assert.equal(count, 1);
  assert.equal(target[0].reasoning_content, "thinking...");
});

test("recoverReasoning returns 0 when no matching entry", () => {
  const msgs = [{ role: "assistant", tool_calls: [{ id: "tc1" }] }];
  const count = recoverReasoning("nonexistent-key", msgs);
  assert.equal(count, 0);
  assert.equal(msgs[0].reasoning_content, undefined);
});

test("recoverReasoning consumes entries in order", () => {
  rememberReasoning("test-key-2", [{ role: "assistant", reasoning_content: "r1" }]);
  rememberReasoning("test-key-2", [{ role: "assistant", reasoning_content: "r2" }]);

  const msgs1 = [{ role: "assistant", tool_calls: [{ id: "tc1" }] }];
  const c1 = recoverReasoning("test-key-2", msgs1);
  assert.equal(c1, 1);
  assert.equal(msgs1[0].reasoning_content, "r1");

  const msgs2 = [{ role: "assistant", tool_calls: [{ id: "tc2" }] }];
  const c2 = recoverReasoning("test-key-2", msgs2);
  assert.equal(c2, 1);
  assert.equal(msgs2[0].reasoning_content, "r2");

  // Third call should get nothing
  const msgs3 = [{ role: "assistant", tool_calls: [{ id: "tc3" }] }];
  const c3 = recoverReasoning("test-key-2", msgs3);
  assert.equal(c3, 0);
});

test("recoverReasoning skips messages that already have reasoning_content", () => {
  rememberReasoning("test-key-3", [{ role: "assistant", reasoning_content: "saved" }]);
  const msgs = [{ role: "assistant", reasoning_content: "already-has-it", tool_calls: [{ id: "tc1" }] }];
  const count = recoverReasoning("test-key-3", msgs);
  assert.equal(count, 0);
  assert.equal(msgs[0].reasoning_content, "already-has-it");
});

test("sessionKey produces consistent key for same input", () => {
  const body = { conversation: "conv-123" };
  const k1 = sessionKey(body);
  const k2 = sessionKey(body);
  assert.equal(k1, k2);
});

test("sessionKey produces different keys for different inputs", () => {
  const k1 = sessionKey({ conversation: "conv-abc" });
  const k2 = sessionKey({ conversation: "conv-xyz" });
  assert.notEqual(k1, k2);
});

test("sessionKey includes hash suffix", () => {
  const key = sessionKey({ conversation: "test" });
  // key should be "test_<8hexchars>"
  const parts = key.split("_");
  assert.ok(parts.length >= 2);
  const suffix = parts[parts.length - 1];
  assert.equal(suffix.length, 8);
  assert.match(suffix, /^[0-9a-f]{8}$/);
});

test("sessionKey falls back to unknown for missing id", () => {
  const key = sessionKey({});
  assert.ok(key.startsWith("unknown_"));
});

test("rememberReasoning ignores non-assistant messages", () => {
  const msgs = [
    { role: "user", reasoning_content: "should-not-store" },
    { role: "system", reasoning_content: "should-not-store" },
  ];
  rememberReasoning("test-key-4", msgs);
  const target = [{ role: "assistant", tool_calls: [{ id: "tc1" }] }];
  const count = recoverReasoning("test-key-4", target);
  assert.equal(count, 0);
});

console.log("\nrecover tests passed!");
