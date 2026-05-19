// Protocol-translation HTTP server factory.
// Shared by index.deepseek.js and index.minimax.js.
import "dotenv/config";
import http from "node:http";
import https from "node:https";
import log from "./log.js";
import { modelsHandler } from "./models.js";
import { SseTranslator } from "./sse.js";
import { rememberReasoning, recoverReasoning, sessionKey } from "./recover.js";
import { translateMessages, translateTools, translateToolChoice, lastUserText } from "./translate.js";

export function createServer(opts) {
  const { apiKey, model, port, host, upstream } = opts;

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

    const IDENTITY = opts.identity;
    let instructions = body.instructions ? body.instructions + "\n\n" + IDENTITY : IDENTITY;
    if (opts.noSystemRole) {
      const firstUser = messages.find(m => m.role === "user");
      if (firstUser) { firstUser.content = instructions + "\n\n" + firstUser.content; }
      else { messages.unshift({ role: "user", content: instructions }); }
    } else {
      messages.unshift({ role: "system", content: instructions });
    }

    const chatBody = { model, messages, stream };
    if (effectiveThinking) { chatBody.thinking = { type: "enabled" }; }
    else { chatBody.thinking = { type: "disabled" }; }

    const tools = translateTools(body.tools);
    if (tools.length > 0) { chatBody.tools = tools; const tc = translateToolChoice(body.tool_choice); if (tc) chatBody.tool_choice = tc; }
    if (body.temperature != null) chatBody.temperature = body.temperature;
    if (body.top_p != null) chatBody.top_p = body.top_p;
    if (body.max_output_tokens != null) chatBody.max_tokens = body.max_output_tokens;

    return { chatBody, stream, messages };
  }

  function buildNonStreamResponse(completion) {
    const msg = completion.choices?.[0]?.message;
    const usage = completion.usage;
    const output = [];
    if (msg?.reasoning_content)
      output.push({ id: "rsn_" + rnd(6), type: "reasoning", content: [{ type: "reasoning_text", text: msg.reasoning_content }], status: "completed" });
    if (msg?.content)
      output.push({ id: "msg_" + rnd(6), type: "message", role: "assistant", content: [{ type: "output_text", text: msg.content, annotations: [] }], status: "completed" });
    if (msg?.tool_calls)
      for (const tc of msg.tool_calls)
        output.push({ id: "fc_" + tc.id, type: "function_call", call_id: tc.id, name: tc.function.name, arguments: tc.function.arguments, status: "completed" });
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
    function onData(json) { try { handlers.onData(json); } catch (_) {} }
    let buf = "";
    const feed = (chunk) => {
      buf += chunk.toString();
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const event of events) {
        const lines = event.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          onData(JSON.parse(json));
        }
      }
    };
    feed.flush = () => {
      if (buf.trim()) {
        const lines = buf.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          onData(JSON.parse(json));
        }
      }
      buf = "";
    };
    return feed;
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, "http://" + req.headers.host);

    if (req.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      return modelsHandler(req, res, model);
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/v1" || url.pathname === "/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ service: opts.serviceName, model, status: "ok", port }));
    }
    if (req.method === "POST" && (url.pathname === "/v1/responses" || url.pathname === "/responses")) {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw);
        const { chatBody, stream } = buildChatBody(body);
        const sk = sessionKey(body);

        const dsReq = https.request({
          hostname: upstream.hostname,
          path: upstream.path,
          method: "POST",
          timeout: 300000,
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
            Accept: stream ? "text/event-stream" : "application/json",
          },
        }, (dsRes) => {
          if (dsRes.statusCode !== 200) {
            let errBody = "";
            dsRes.on("data", c => errBody += c);
            dsRes.on("end", () => {
              log.err(upstream.label + " " + dsRes.statusCode + ": " + errBody.slice(0, 500));
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
                if (completion.choices?.[0]?.message?.reasoning_content) {
                  rememberReasoning(sk, [completion.choices[0].message]);
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
          const translator = new SseTranslator(res, model);
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
          log.err("connect: " + e.message);
          if (!res.headersSent) { res.writeHead(502); res.end(JSON.stringify({ error: { message: e.message } })); }
        });
        dsReq.on("timeout", () => {
          dsReq.destroy();
          if (!res.headersSent) { res.writeHead(504); res.end(JSON.stringify({ error: { message: "timeout" } })); }
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

  server.listen(port, host, () => {
    console.log("");
    log.ok(opts.serviceName + " started");
    log.info("http://" + host + ":" + port + "/v1/responses");
    log.info("model: " + model);
    if (!apiKey) log.warn(opts.envKey + " not set");
    console.log("");
  });

  return server;
}

function rnd(len) { return Math.random().toString(36).slice(2, 2 + len); }
