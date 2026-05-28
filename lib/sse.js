import log from "./log.js";
import { randomUUID } from "node:crypto";

const MAX_THINK_BUF = 100 * 1024; // 100KB safety limit for inline think buffer

// Incremental buffer for partial <think> tag detection
function pushThinkBuf(buf, chunk) {
  const combined = (buf || "") + chunk;
  // Check if we have a complete <think>...</think> block
  const closeIdx = combined.indexOf("</think>");
  if (closeIdx === -1) {
    // No closing tag yet; keep buffering
    return { buf: combined, reasoning: null, rest: "" };
  }
  const openIdx = combined.indexOf("<think>");
  if (openIdx === -1) {
    // Closing tag without opening (shouldn't happen in practice)
    return { buf: "", reasoning: null, rest: combined };
  }
  const reasoning = combined.slice(openIdx + 7, closeIdx).trim();
  const rest = combined.slice(closeIdx + 8); // everything after </think>
  return { buf: rest, reasoning: reasoning || null, rest: rest };
}

export class SseTranslator {
  constructor(res, model = "deepseek-v4-pro", opts = {}) {
    this.model = model;
    this.res = res;
    this.responseId = "resp_" + randomUUID().replace(/-/g, "").slice(0, 8);
    this.messageItemId = "item_" + randomUUID().replace(/-/g, "").slice(0, 8);
    this.textStarted = false;
    this.contentSoFar = "";
    this.reasoningStarted = false;
    this.reasoningSoFar = "";
    this.reasoningItemId = null;
    this.toolCalls = new Map();
    this.started = false;
    this.outputItemCount = 0;
    this.outputItems = [];
    this._lastUsage = null;
    // MiniMax support: inline think buffer
    this._thinkBuf = "";
    this._inlineThinkEnabled = opts.inlineThink === true;
    this._thinkClosed = false; // true once </think> has been seen
  }

  emit(event, data) {
    this.res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
  }

  _ensureStarted() {
    if (this.started) return;
    this.started = true;
    this.emit("response.created", {
      type: "response.created",
      response: { id: this.responseId, object: "response", status: "in_progress", model: this.model, output: [] },
    });
    this.emit("response.in_progress", { type: "response.in_progress", response_id: this.responseId });
    log.info("SSE start: " + this.responseId);
  }

  feed(chunk) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (chunk.usage) this._lastUsage = chunk.usage;

    // --- DeepSeek: reasoning_content is a separate field ---
    if (delta.reasoning_content) {
      this._feedReasoning(delta.reasoning_content);
    }

    // --- Handle delta.content (both text and MiniMax inline reasoning) ---
    if (delta.content) {
      // MiniMax: thinking is embedded as <think>...</think> inside content
      if (this._inlineThinkEnabled && !this._thinkClosed) {
        const result = pushThinkBuf(this._thinkBuf, delta.content);
        this._thinkBuf = result.buf;
        // Overflow protection: if buffer exceeds limit, force-close and flush as text
        if (this._thinkBuf.length > MAX_THINK_BUF) {
          log.warn("think buffer overflow (" + this._thinkBuf.length + " bytes), forcing close");
          this._thinkClosed = true;
          this.contentSoFar += this._thinkBuf;
          this._feedTextDelta(this._thinkBuf);
          this._thinkBuf = "";
          return;
        }
        if (result.reasoning) {
          this._thinkClosed = true;
          // Emit accumulated reasoning as a completed reasoning item
          if (!this.reasoningStarted) {
            this.reasoningStarted = true;
            this.reasoningSoFar = result.reasoning;
            this._feedReasoningItem(result.reasoning, true);
          }
        }
        // If still buffering (no close tag yet), skip the text output
        if (!this._thinkClosed) return;
        // After closing, only emit the rest content (non-empty)
        const text = result.rest;
        if (text) {
          this.contentSoFar += text;
          this._feedTextDelta(text);
        }
        return;
      }

      // Normal text content (no inline thinking)
      this.contentSoFar += delta.content;
      this._feedTextDelta(delta.content);
    }

    // --- Tool calls ---
    if (delta.tool_calls) {
      this._ensureStarted();
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!this.toolCalls.has(idx)) {
          const call = { id: tc.id || "call_" + idx, name: tc.function?.name ?? "", arguments: "" };
          this.toolCalls.set(idx, call);
          const oi = this.outputItemCount++;
          this.outputItems.push({ index: oi, type: "function_call", itemId: "fc_" + call.id });
          this.emit("response.output_item.added", { type: "response.output_item.added", response_id: this.responseId, output_index: oi, item: { id: "fc_" + call.id, type: "function_call", call_id: call.id, name: call.name, status: "in_progress" } });
          log.info("tool: " + call.name + " (" + call.id + ")");
        }
        const call = this.toolCalls.get(idx);
        if (tc.function?.name) call.name = tc.function.name;
        const d = tc.function?.arguments ?? "";
        call.arguments += d;
        const oi = this._itemIndex("fc_" + call.id);
        if (oi >= 0) this.emit("response.function_call_arguments.delta", { type: "response.function_call_arguments.delta", response_id: this.responseId, item_id: "fc_" + call.id, output_index: oi, delta: d });
      }
    }
  }

  _feedReasoning(text) {
    this._ensureStarted();
    this.reasoningSoFar += text;
    if (!this.reasoningStarted) {
      this.reasoningStarted = true;
      this.reasoningItemId = "rsn_" + Math.random().toString(36).slice(2, 10);
      const oi = this.outputItemCount++;
      this.outputItems.push({ index: oi, type: "reasoning", itemId: this.reasoningItemId });
      this.emit("response.output_item.added", { type: "response.output_item.added", response_id: this.responseId, output_index: oi, item: { id: this.reasoningItemId, type: "reasoning", status: "in_progress", summary: [] } });
      this.emit("response.content_part.added", { type: "response.content_part.added", response_id: this.responseId, item_id: this.reasoningItemId, output_index: oi, content_index: 0, part: { type: "reasoning_text", text: "" } });
    }
    const rIdx = this._rsnIndex();
    if (rIdx >= 0) this.emit("response.reasoning_text.delta", { type: "response.reasoning_text.delta", response_id: this.responseId, item_id: this.reasoningItemId, output_index: rIdx, content_index: 0, delta: text });
  }

  _feedReasoningItem(text, completed = false) {
    // Emit a complete (non-streaming) reasoning item (for MiniMax bulk reasoning)
    this._ensureStarted();
    const id = "rsn_" + Math.random().toString(36).slice(2, 10);
    const oi = this.outputItemCount++;
    this.outputItems.push({ index: oi, type: "reasoning", itemId: id });
    this.emit("response.output_item.added", { type: "response.output_item.added", response_id: this.responseId, output_index: oi, item: { id, type: "reasoning", status: "in_progress", summary: [] } });
    if (text) {
      this.emit("response.content_part.added", { type: "response.content_part.added", response_id: this.responseId, item_id: id, output_index: oi, content_index: 0, part: { type: "reasoning_text", text: "" } });
      this.emit("response.reasoning_text.delta", { type: "response.reasoning_text.delta", response_id: this.responseId, item_id: id, output_index: oi, content_index: 0, delta: text });
    }
    this.emit("response.content_part.done", { type: "response.content_part.done", response_id: this.responseId, item_id: id, output_index: oi, content_index: 0, part: { type: "reasoning_text", text: text || "" } });
    this.emit("response.output_item.done", { type: "response.output_item.done", response_id: this.responseId, output_index: oi, item: { id, type: "reasoning", content: [{ type: "reasoning_text", text: text || "" }], status: "completed" } });
  }

  _feedTextDelta(text) {
    this._ensureStarted();
    if (!this.textStarted) {
      this.textStarted = true;
      const oi = this.outputItemCount++;
      this.outputItems.push({ index: oi, type: "message", itemId: this.messageItemId });
      this.emit("response.output_item.added", { type: "response.output_item.added", response_id: this.responseId, output_index: oi, item: { id: this.messageItemId, type: "message", role: "assistant", status: "in_progress", content: [] } });
      this.emit("response.content_part.added", { type: "response.content_part.added", response_id: this.responseId, item_id: this.messageItemId, output_index: oi, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
    }
    this.emit("response.output_text.delta", { type: "response.output_text.delta", response_id: this.responseId, item_id: this.messageItemId, output_index: this._msgIndex(), content_index: 0, delta: text });
  }

  done(usageOverride) {
    this._ensureStarted();
    const usage = usageOverride || this._lastUsage || null;

    if (this.textStarted) {
      const oi = this._msgIndex();
      this.emit("response.content_part.done", { type: "response.content_part.done", response_id: this.responseId, item_id: this.messageItemId, output_index: oi, content_index: 0, part: { type: "output_text", text: this.contentSoFar, annotations: [] } });
      this.emit("response.output_item.done", { type: "response.output_item.done", response_id: this.responseId, output_index: oi, item: { id: this.messageItemId, type: "message", role: "assistant", content: [{ type: "output_text", text: this.contentSoFar, annotations: [] }], status: "completed" } });
    }

    if (this.reasoningStarted) {
      const rIdx = this._rsnIndex();
      const text = this.reasoningSoFar;
      this.emit("response.content_part.done", { type: "response.content_part.done", response_id: this.responseId, item_id: this.reasoningItemId, output_index: rIdx, content_index: 0, part: { type: "reasoning_text", text } });
      this.emit("response.output_item.done", { type: "response.output_item.done", response_id: this.responseId, output_index: rIdx, item: { id: this.reasoningItemId, type: "reasoning", content: [{ type: "reasoning_text", text }], status: "completed" } });
    }

    for (const [, call] of this.toolCalls) {
      const outIdx = this._itemIndex("fc_" + call.id);
      this.emit("response.function_call_arguments.done", { type: "response.function_call_arguments.done", response_id: this.responseId, item_id: "fc_" + call.id, output_index: outIdx, name: call.name, arguments: call.arguments });
      this.emit("response.output_item.done", { type: "response.output_item.done", response_id: this.responseId, output_index: outIdx, item: { id: "fc_" + call.id, type: "function_call", call_id: call.id, name: call.name, arguments: call.arguments, status: "completed" } });
      log.resp("tool done: " + call.name);
    }

    const respUsage = usage ? { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0 } : null;

    const outSnapshot = [];
    for (const o of this.outputItems) {
      if (o.type === "message") outSnapshot.push({ id: o.itemId, type: "message", role: "assistant", content: [{ type: "output_text", text: this.contentSoFar, annotations: [] }], status: "completed" });
      else if (o.type === "reasoning") outSnapshot.push({ id: o.itemId, type: "reasoning", content: [{ type: "reasoning_text", text: this.reasoningSoFar }], status: "completed" });
      else if (o.type === "function_call") {
        for (const [, c] of this.toolCalls) {
          if ("fc_" + c.id === o.itemId) { outSnapshot.push({ id: o.itemId, type: "function_call", call_id: c.id, name: c.name, arguments: c.arguments, status: "completed" }); break; }
        }
      }
    }

    this.emit("response.completed", { type: "response.completed", response: { id: this.responseId, object: "response", status: "completed", model: this.model, output: outSnapshot, usage: respUsage } });

    if (usage) log.toks(usage.prompt_tokens, usage.completion_tokens, usage.total_tokens);
    log.ok("SSE done: " + this.responseId);
    this.res.end();
  }

  error(msg) {
    this.emit("error", { type: "error", code: "proxy_error", message: msg });
    log.err("SSE error: " + msg);
    this.res.end();
  }

  _msgIndex() { for (const o of this.outputItems) if (o.type === "message") return o.index; return 0; }
  _rsnIndex() { for (const o of this.outputItems) if (o.type === "reasoning") return o.index; return -1; }
  _itemIndex(id) { for (const o of this.outputItems) if (o.itemId === id) return o.index; return -1; }
}
