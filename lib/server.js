// Protocol-translation HTTP server factory.
// Config-driven: receives a provider config object from providers.json + resolved API key.

import dotenv from "dotenv"; dotenv.config({ override: true });
import http from "node:http";
import https from "node:https";
import log from "./log.js";
import { modelsHandler } from "./models.js";
import { SseTranslator } from "./sse.js";
import { rememberReasoning, recoverReasoning, sessionKey } from "./recover.js";
import { translateMessages, translateTools, translateToolChoice, lastUserText, splitThinking } from "./translate.js";
import { randomUUID } from "node:crypto";

/**
 * Build extra chat body fields from JSON config.
 * Replaces the old per-provider extraChatFields() function.
 *
 * Config shape:
 *   extraChatFieldsKey: "thinking"          — the field name to set
 *   extraChatFields: {
 *     "enabled":  { "type": "enabled" },    — value when thinking is on
 *     "disabled": { "type": "disabled" }    — value when thinking is off (optional)
 *   }
 *
 * Behavior:
 *   - DeepSeek: always sends thinking field (enabled or disabled)
 *   - MiniMax: only sends thinking when explicitly requested (no "disabled" key)
 *   - MiMo: no extraChatFieldsKey → returns {}
 */
function buildExtraChatFields(cfg, body, effectiveThinking) {
  const key = cfg.extraChatFieldsKey;
  if (!key) return {};
  const fields = cfg.extraChatFields;
  if (!fields) return {};

  const isRequested = body.thinking === true
    || (body.thinking && body.thinking.type === "enabled")
    || (body.reasoning && body.reasoning.effort);

  if (effectiveThinking || isRequested) {
    return fields.enabled ? { [key]: fields.enabled } : {};
  }
  // Only send "disabled" variant if config explicitly defines it
  return fields.disabled ? { [key]: fields.disabled } : {};
}

/**
 * Post-process non-streaming response using config flags.
 * Replaces the old per-provider postProcessNonStream() function.
 *
 * When inlineThinking is true (e.g. MiniMax), <think> tags are extracted
 * from content and returned as reasoning_content.
 */
function postProcessNonStream(cfg, completion) {
  const msg = completion.choices?.[0]?.message;
  if (!msg) return {};

  if (cfg.inlineThinking) {
    const rawContent = msg.content || "";
    const { reasoning, rest } = splitThinking(rawContent);
    return {
      reasoning_content: reasoning || null,
      content: rest || "",
      tool_calls: msg.tool_calls || null,
    };
  }

  return {
    reasoning_content: msg.reasoning_content || null,
    content: msg.content || "",
    tool_calls: msg.tool_calls || null,
  };
}

export function createServer(cfg, apiKey) {
  const { model, upstream } = cfg;
  const authHeaderName = cfg.authHeader ?? "Authorization";
  const authHeaderValue = (cfg.authPrefix ?? "") + apiKey;
  const inlineThink = cfg.inlineThinking === true;
  const identity = cfg.identity ?? "";

  async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks).toString();
  }

  function buildChatBody(body) {
    const stream = body.stream !== false;
    const enableThinking = body.thinking === true || (body.thinking && body.thinking.type === "enabled") || (body.reasoning && body.reasoning.effort);
    const { messages, stats } = translateMessages(body.input, { keepReasoningContent: enableThinking });
    const restored = recoverReasoning(sessionKey(body), messages);
    const hasAssistantWithRC = messages.some(m => m.role === "assistant" && m.reasoning_content);
    const hasAssistantWithTC = messages.some(m => m.role === "assistant" && m.tool_calls);
    const effectiveThinking = enableThinking && (hasAssistantWithRC || !hasAssistantWithTC);

    if (enableThinking && !effectiveThinking) log.warn("thinking off: missing rc in history");
    if (restored > 0 && effectiveThinking) log.ok("rc restored x" + restored);
    if (stats.strippedReasoningContent > 0) log.skip("rc stripped x" + stats.strippedReasoningContent);
    if (stats.preservedReasoningContent > 0 && !restored) log.info("rc preserved x" + stats.preservedReasoningContent);

    const lastUser = lastUserText(messages);
    const preview = lastUser.length > 120 ? lastUser.slice(0, 120) + "..." : lastUser;
    log.req("thinking:" + (effectiveThinking ? "on" : "off") + " msgs:" + messages.length + " stream:" + stream + " | " + preview);

    let instructions = body.instructions ? body.instructions + "\n\n" + identity : identity;
    if (cfg.noSystemRole) {
      const firstUser = messages.find(m => m.role === "user");
      if (firstUser) { firstUser.content = instructions + "\n\n" + firstUser.content; }
      else { messages.unshift({ role: "user", content: instructions }); }
    } else {
      messages.unshift({ role: "system", content: instructions });
    }

    const chatBody = { model, messages, stream };

    // Provider-specific chat body fields (e.g. thinking param)
    const extra = buildExtraChatFields(cfg, body, effectiveThinking);
    Object.assign(chatBody, extra);

    const tools = translateTools(body.tools);
    if (tools.length > 0) { chatBody.tools = tools; const tc = translateToolChoice(body.tool_choice); if (tc) chatBody.tool_choice = tc; }
    if (body.temperature != null) chatBody.temperature = body.temperature;
    if (body.top_p != null) chatBody.top_p = body.top_p;
    if (body.max_output_tokens != null) chatBody.max_tokens = body.max_output_tokens;

    return { chatBody, stream, messages };
  }

  function buildNonStreamResponse(completion) {
    const { reasoning_content, content, tool_calls } = postProcessNonStream(cfg, completion);

    const usage = completion.usage;
    const output = [];

    if (reasoning_content) {
      output.push({ id: "rsn_" + rnd(6), type: "reasoning", content: [{ type: "reasoning_text", text: reasoning_content }], status: "completed" });
    }
    if (content) {
      output.push({ id: "msg_" + rnd(6), type: "message", role: "assistant", content: [{ type: "output_text", text: content, annotations: [] }], status: "completed" });
    }
    if (tool_calls) {
      for (const tc of tool_calls) {
        output.push({ id: "fc_" + tc.id, type: "function_call", call_id: tc.id, name: tc.function.name, arguments: tc.function.arguments, status: "completed" });
      }
    }

    return {
      id: "resp_" + rnd(8),
      object: "response",
      status: "completed",
      model,
      output,
      usage: usage ? { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0 } : null,
    };
  }

  function createSseParser(handlers) {
    function onData(json) { try { handlers.onData(json); } catch (e) { log.err("SSE onData: " + e.message); } }
    let buf = "";
    function feed(chunk) {
      buf += typeof chunk === "string" ? chunk : chunk.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") return;
          try { onData(JSON.parse(payload)); } catch { /* ignore parse errors on partial chunks */ }
        }
      }
    }
    feed.flush = () => { if (buf.trim()) { try { const m = buf.match(/data: (.*)/); if (m && m[1] !== "[DONE]") onData(JSON.parse(m[1])); } catch {} } };
    return feed;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" });
      return res.end();
    }
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Models endpoint
    if (req.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      return modelsHandler(req, res, model);
    }

    // Responses endpoint
    if (req.method === "POST" && (url.pathname === "/v1/responses" || url.pathname === "/responses")) {
      try {
        const raw = await readBody(req);
        let body;
        try { body = JSON.parse(raw); } catch { body = { input: raw }; }
        if (body && typeof body === "object" && !Array.isArray(body) && body.input && typeof body.input !== "string" && !Array.isArray(body.input)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: { message: "invalid input: expected string or array" } }));
        }
        const { chatBody, stream } = buildChatBody(body);
        const sk = sessionKey(body);

        const dsReq = https.request({
          hostname: upstream.hostname,
          path: upstream.path,
          method: "POST",
          timeout: 300000,
          headers: {
            [authHeaderName]: authHeaderValue,
            "Content-Type": "application/json",
            Accept: stream ? "text/event-stream" : "application/json",
          },
        }, (dsRes) => {
          if (dsRes.statusCode !== 200) {
            let errBody = "";
            dsRes.on("data", c => errBody += c);
            dsRes.on("end", () => {
              const short = errBody.slice(0, 500);
              log.err(upstream.label + " " + dsRes.statusCode + ": " + short);
              if (errBody.length > 500) log.warn("upstream body truncated, full len=" + errBody.length);
              try { log.warn("req body keys: " + Object.keys(chatBody).join(", ") + " msgs:" + chatBody.messages?.length); } catch (_) {}
              res.writeHead(dsRes.statusCode >= 500 ? 502 : dsRes.statusCode, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: { type: "upstream_error", code: upstream.codePrefix + dsRes.statusCode, message: upstream.label + " " + dsRes.statusCode + ": " + errBody.slice(0, 200) } }));
            });
            return;
          }
          if (!stream) {
            let data = "";
            dsRes.on("data", c => data += c);
            dsRes.on("end", () => {
              try {
                const completion = JSON.parse(data);
                const out = postProcessNonStream(cfg, completion);
                if (completion.choices?.[0]?.message) {
                  const rc = out?.reasoning_content || completion.choices[0].message.reasoning_content;
                  if (rc) {
                    rememberReasoning(sk, [{ role: "assistant", reasoning_content: rc }]);
                  }
                }
                const response = buildNonStreamResponse(completion);
                if (completion.usage) log.toks(completion.usage.prompt_tokens, completion.usage.completion_tokens, completion.usage.total_tokens);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(response));
              } catch (e) {
                log.err("parse: " + e.message);
                res.writeHead(502);
                res.end(JSON.stringify({ error: { message: e.message } }));
              }
            });
            return;
          }
          res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
          const translator = new SseTranslator(res, model, { inlineThink });
          const feedSse = createSseParser({ onData: (json) => translator.feed(json) });
          dsRes.on("data", (chunk) => feedSse(chunk));
          dsRes.on("end", () => {
            feedSse.flush();
            if (translator.reasoningSoFar) {
              rememberReasoning(sk, [{ role: "assistant", content: translator.contentSoFar, reasoning_content: translator.reasoningSoFar }]);
            }
            translator.done(null);
          });
          dsRes.on("error", (e) => { log.err("upstream: " + e.message); translator.error(e.message); });
        });

        dsReq.on("error", (e) => {
          log.err("connect " + upstream.label + ": " + e.message);
          if (!res.headersSent) { res.writeHead(502); res.end(JSON.stringify({ error: { message: e.message } })); }
        });
        dsReq.on("timeout", () => {
          dsReq.destroy();
          if (!res.headersSent) { res.writeHead(504); res.end(JSON.stringify({ error: { message: "timeout" } })); }
        });

        // Abort upstream request when Codex disconnects
        res.on("close", () => {
          log.warn("client disconnected, aborting upstream request");
          dsReq.destroy();
        });

        dsReq.write(JSON.stringify(chatBody));
        dsReq.end();
      } catch (e) {
        log.err("parse: " + e.message);
        if (!res.headersSent) { res.writeHead(400); res.end(JSON.stringify({ error: { message: e.message } })); }
      }
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: { message: "not found: " + url.pathname } }));
  });

  server.listen(cfg.port, cfg.host, () => {
    console.log("");
    log.ok(cfg.name + " started");
    log.info("http://" + cfg.host + ":" + cfg.port + "/v1/responses");
    log.info("model: " + model);
    log.info("inlineThink: " + inlineThink);
    if (!apiKey) log.warn(cfg.keychainService + " not set");
    console.log("");
  });

  return server;
}

function rnd(len) { return randomUUID().replace(/-/g, "").slice(0, len); }
