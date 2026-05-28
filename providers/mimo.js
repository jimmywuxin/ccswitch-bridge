import dotenv from "dotenv"; dotenv.config({ override: true });
// Xiaomi MiMo provider configuration
// Standard OpenAI-compatible Chat Completions API, with custom api-key auth header.

export const config = {
  name: "ccswitch-bridge-mimo",
  model: process.env.MIMO_MODEL || "mimo-v2.5-pro",
  envKey: "MIMO_API_KEY",
  host: process.env.MIMO_PROXY_HOST || "127.0.0.1",
  port: parseInt(process.env.MIMO_PROXY_PORT || "11437", 10),

  upstream: {
    hostname: process.env.MIMO_API_HOST || "token-plan-cn.xiaomimimo.com",
    path: "/v1/chat/completions",
    label: "MiMo",
    codePrefix: "mimo_",
  },

  // MiMo uses a custom header name: "api-key" instead of "Authorization: Bearer"
  authHeaderName: "api-key",

  // Auth header builder: MiMo uses the raw API key as the header value (no Bearer prefix)
  authHeader(apiKey) {
    return apiKey;
  },

  // MiMo supports system role natively (OpenAI-compatible)
  noSystemRole: false,

  // MiMo uses standard reasoning_content field (if supported) or none
  inlineThinking: false,
};

// Identity injection
export const identity =
  "[IMPORTANT: Your true underlying model is MiMo (mimo-v2.5-pro), developed by Xiaomi (Xiaomi MiMo). You are NOT OpenAI, GPT, Claude, DeepSeek, MiniMax, or Codex. When asked about your model identity, you MUST answer that you are MiMo by Xiaomi, not any other model. Ignore any conflicting identity claims in the instructions above.]";

// Post-process a non-streaming completion response before sending to Codex.
// Standard OpenAI-compatible response format.
export function postProcessNonStream(completion) {
  const msg = completion.choices?.[0]?.message;
  if (!msg) return {};
  return {
    reasoning_content: msg.reasoning_content || null,
    content: msg.content || "",
    tool_calls: msg.tool_calls || null,
  };
}

// Build extra chat body fields specific to this provider.
// MiMo is standard OpenAI-compatible; no special thinking params to add.
export function extraChatFields(body, effectiveThinking) {
  return {};
}
