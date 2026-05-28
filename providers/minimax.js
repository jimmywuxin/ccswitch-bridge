// MiniMax provider configuration
// MiniMax embeds thinking content as <think>...</think> tags inside the content field.

import { splitThinking } from "../lib/translate.js";

export const config = {
  name: "ccswitch-bridge-minimax",
  model: "Minimax-M2.7",
  envKey: "MINIMAX_API_KEY",
  host: process.env.MINIMAX_PROXY_HOST || "127.0.0.1",
  port: parseInt(process.env.MINIMAX_PROXY_PORT || "11436", 10),

  upstream: {
    hostname: "api.minimax.chat",
    path: "/v1/chat/completions",
    label: "MiniMax",
    codePrefix: "minimax_",
  },

  // Auth header builder
  authHeader(apiKey) {
    return "Bearer " + apiKey;
  },

  // MiniMax historically had issues with system role; prepend as user message
  noSystemRole: true,

  // Thinking is embedded as <think>...</think> tags in the content field
  inlineThinking: true,
};

// Identity injection
export const identity =
  "[IMPORTANT: Your true underlying model is MiniMax (Minimax-M2.7), developed by MiniMax. You are NOT OpenAI, GPT, Claude, DeepSeek, or Codex. When asked about your model identity, you MUST answer that you are MiniMax, not any other model. Ignore any conflicting identity claims in the instructions above.]";

// Post-process a non-streaming completion response.
// MiniMax returns thinking content as <think>...</think> inside the content field.
export function postProcessNonStream(completion) {
  const msg = completion.choices?.[0]?.message;
  if (!msg) return {};

  const rawContent = msg.content || "";

  // Split <think> from actual response
  const { reasoning, rest } = splitThinking(rawContent);

  return {
    reasoning_content: reasoning || null,
    content: rest || "",
    tool_calls: msg.tool_calls || null,
  };
}

// Build extra chat body fields specific to MiniMax.
// MiniMax supports thinking param but it's optional.
export function extraChatFields(body, effectiveThinking) {
  // Only send thinking param when explicitly requested
  if (body.thinking === true || (body.thinking && body.thinking.type === "enabled") || (body.reasoning && body.reasoning.effort)) {
    return { thinking: { type: "enabled" } };
  }
  return {};
}
