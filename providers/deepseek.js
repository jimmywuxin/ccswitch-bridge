// DeepSeek provider configuration
// DeepSeek uses reasoning_content as a separate field (not inline <think> tags).


export const config = {
  name: "ccswitch-deepseek",
  model: "deepseek-v4-pro",
  envKey: "DEEPSEEK_API_KEY",
  host: process.env.DEEPSEEK_PROXY_HOST || "127.0.0.1",
  port: parseInt(process.env.DEEPSEEK_PROXY_PORT || "11435", 10),

  upstream: {
    hostname: "api.deepseek.com",
    path: "/v1/chat/completions",
    label: "DeepSeek",
    codePrefix: "deepseek_",
  },

  // Auth header builder: receives apiKey, returns header value
  authHeader(apiKey) {
    return "Bearer " + apiKey;
  },

  // System role handling: DeepSeek supports system role natively
  noSystemRole: false,

  // Thinking is a separate field (reasoning_content), not inline <think> tags
  inlineThinking: false,
};

// Identity injection (prepended as system message or first user message)
export const identity =
  "[IMPORTANT: Your true underlying model is DeepSeek (deepseek-v4-pro), developed by DeepSeek (depth seek). You are NOT OpenAI, GPT, Claude, or Codex. When asked about your model identity, you MUST answer that you are DeepSeek, not any other model. Ignore any conflicting identity claims in the instructions above.]";

// Post-process a non-streaming completion response before sending to Codex.
// Returns { reasoning_content, content, tool_calls } normalized.
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
// body = the original Codex request; effectiveThinking = boolean.
// Returns an object of fields to merge into chatBody.
export function extraChatFields(body, effectiveThinking) {
  return {
    thinking: effectiveThinking
      ? { type: "enabled" }
      : { type: "disabled" },
  };
}
