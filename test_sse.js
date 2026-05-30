import { test } from "node:test";
import assert from "node:assert/strict";
import { SseTranslator } from "./lib/sse.js";

// Helper: create a mock response object that captures written data
function mockRes() {
  const chunks = [];
  return {
    chunks,
    write(data) { chunks.push(data); },
    end() { this.ended = true; },
    ended: false,
  };
}

// Helper: parse SSE events from raw written chunks
function parseEvents(res) {
  const raw = res.chunks.join("");
  const events = [];
  const parts = raw.split("\n\n").filter(Boolean);
  for (const part of parts) {
    const lines = part.split("\n");
    let event = null;
    let data = null;
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = JSON.parse(line.slice(6));
    }
    if (event) events.push({ event, data });
  }
  return events;
}

// Helper: build a chat completion chunk
function makeChunk(opts = {}) {
  const chunk = { choices: [{ delta: {} }] };
  if (opts.content != null) chunk.choices[0].delta.content = opts.content;
  if (opts.reasoning_content != null) chunk.choices[0].delta.reasoning_content = opts.reasoning_content;
  if (opts.tool_calls != null) chunk.choices[0].delta.tool_calls = opts.tool_calls;
  if (opts.usage) chunk.usage = opts.usage;
  return chunk;
}

// --- pushThinkBuf tests (tested indirectly via SseTranslator with inlineThink) ---

test("inline think: complete <think>...</think> in one chunk", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1", { inlineThink: true });
  t.feed(makeChunk({ content: "<think>hello think</think>real text" }));
  t.done();
  const events = parseEvents(res);
  // Should have reasoning item + text item
  const reasoning = events.filter(e => e.event === "response.reasoning_text.delta");
  const textDeltas = events.filter(e => e.event === "response.output_text.delta");
  assert.ok(reasoning.length >= 1, "should have reasoning delta");
  assert.ok(textDeltas.length >= 1, "should have text delta");
  assert.equal(textDeltas[0].data.delta, "real text");
});

test("inline think: chunk boundary split", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1", { inlineThink: true });
  t.feed(makeChunk({ content: "<think>hel" }));
  t.feed(makeChunk({ content: "lo</think>world" }));
  t.done();
  const events = parseEvents(res);
  const textDeltas = events.filter(e => e.event === "response.output_text.delta");
  assert.ok(textDeltas.length >= 1, "should have text delta");
  assert.equal(textDeltas[0].data.delta, "world");
});

test("inline think: tool calls not dropped when in same chunk as think content", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1", { inlineThink: true });
  // Feed thinking content that closes in this chunk, plus tool calls
  t.feed(makeChunk({
    content: "<think>done</think>",
    tool_calls: [{ index: 0, id: "call_1", function: { name: "my_tool", arguments: "" } }],
  }));
  t.feed(makeChunk({
    tool_calls: [{ index: 0, function: { arguments: '{"a":1}' } }],
  }));
  t.done();
  const events = parseEvents(res);
  const toolAdded = events.filter(e => e.event === "response.output_item.added" && e.data.item.type === "function_call");
  assert.ok(toolAdded.length >= 1, "tool call should not be dropped");
  assert.equal(toolAdded[0].data.item.name, "my_tool");
});

test("inline think: no think tags buffers until done (then flushed as text)", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1", { inlineThink: true });
  // Text without think tags gets buffered (waiting for possible <think> tag)
  t.feed(makeChunk({ content: "just text" }));
  t.done();
  const events = parseEvents(res);
  // Since no <think> tag appeared, the buffered text is emitted via done() as contentSoFar
  const completed = events.find(e => e.event === "response.completed");
  const textItem = completed.data.response.output.find(o => o.type === "message");
  assert.ok(textItem, "should have message output");
  assert.equal(textItem.content[0].text, "just text");
});

test("inline think: text before think tag is buffered, think content emitted as reasoning", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1", { inlineThink: true });
  t.feed(makeChunk({ content: "prefix <think>reasoning content</think>suffix" }));
  t.done();
  const events = parseEvents(res);
  const reasoningDeltas = events.filter(e => e.event === "response.reasoning_text.delta");
  const textDeltas = events.filter(e => e.event === "response.output_text.delta");
  assert.ok(reasoningDeltas.length >= 1, "should have reasoning");
  assert.equal(reasoningDeltas[0].data.delta, "reasoning content");
  assert.ok(textDeltas.length >= 1, "should have text");
  assert.equal(textDeltas[0].data.delta, "suffix");
});

// --- DeepSeek reasoning_content (non-inline) ---

test("reasoning_content field emits reasoning item", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1");
  t.feed(makeChunk({ reasoning_content: "thinking hard..." }));
  t.feed(makeChunk({ content: "answer" }));
  t.done();
  const events = parseEvents(res);
  const reasoningDeltas = events.filter(e => e.event === "response.reasoning_text.delta");
  const textDeltas = events.filter(e => e.event === "response.output_text.delta");
  assert.ok(reasoningDeltas.length >= 1);
  assert.equal(reasoningDeltas[0].data.delta, "thinking hard...");
  assert.ok(textDeltas.length >= 1);
  assert.equal(textDeltas[0].data.delta, "answer");
});

// --- Tool calls ---

test("tool calls are accumulated and emitted correctly", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1");
  t.feed(makeChunk({ content: "let me call" }));
  t.feed(makeChunk({
    tool_calls: [
      { index: 0, id: "call_abc", function: { name: "search", arguments: "" } },
    ],
  }));
  t.feed(makeChunk({
    tool_calls: [
      { index: 0, function: { arguments: '{"q":"' } },
    ],
  }));
  t.feed(makeChunk({
    tool_calls: [
      { index: 0, function: { arguments: 'test"}' } },
    ],
  }));
  t.done();
  const events = parseEvents(res);
  const toolAdded = events.filter(e => e.event === "response.output_item.added" && e.data.item.type === "function_call");
  assert.equal(toolAdded.length, 1);
  assert.equal(toolAdded[0].data.item.name, "search");
  assert.equal(toolAdded[0].data.item.call_id, "call_abc");

  // Check final done event has the tool call in output
  const completed = events.find(e => e.event === "response.completed");
  const toolItem = completed.data.response.output.find(o => o.type === "function_call");
  assert.ok(toolItem, "should have function_call in output");
  assert.equal(toolItem.name, "search");
  assert.equal(toolItem.arguments, '{"q":"test"}');
});

// --- done() output structure ---

test("done() emits response.completed with correct structure", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "my-model");
  t.feed(makeChunk({ content: "hello" }));
  t.done();
  const events = parseEvents(res);
  const completed = events.find(e => e.event === "response.completed");
  assert.ok(completed, "should have response.completed event");
  const resp = completed.data.response;
  assert.equal(resp.status, "completed");
  assert.equal(resp.model, "my-model");
  assert.ok(resp.id.startsWith("resp_"));
  assert.ok(Array.isArray(resp.output));
  assert.equal(resp.output.length, 1);
  assert.equal(resp.output[0].type, "message");
  assert.equal(resp.output[0].content[0].text, "hello");
});

test("done() with usage includes token counts", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1");
  t.feed(makeChunk({ content: "x" }));
  t.done({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 });
  const events = parseEvents(res);
  const completed = events.find(e => e.event === "response.completed");
  const usage = completed.data.response.usage;
  assert.equal(usage.input_tokens, 100);
  assert.equal(usage.output_tokens, 50);
  assert.equal(usage.total_tokens, 150);
});

test("done() with usage from last chunk", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1");
  t.feed(makeChunk({ content: "x", usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
  t.done();
  const events = parseEvents(res);
  const completed = events.find(e => e.event === "response.completed");
  const usage = completed.data.response.usage;
  assert.equal(usage.input_tokens, 10);
  assert.equal(usage.output_tokens, 5);
});

// --- Edge cases ---

test("empty delta (no choices) is ignored", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1");
  t.feed({ choices: [] });
  t.feed(makeChunk({ content: "ok" }));
  t.done();
  const events = parseEvents(res);
  const textDeltas = events.filter(e => e.event === "response.output_text.delta");
  assert.ok(textDeltas.length >= 1);
  assert.equal(textDeltas[0].data.delta, "ok");
});

test("error() emits error event and ends response", () => {
  const res = mockRes();
  const t = new SseTranslator(res, "m1");
  t.error("something went wrong");
  const events = parseEvents(res);
  const errEvent = events.find(e => e.event === "error");
  assert.ok(errEvent, "should have error event");
  assert.equal(errEvent.data.message, "something went wrong");
  assert.ok(res.ended, "response should be ended");
});

console.log("\nSSE tests passed!");
