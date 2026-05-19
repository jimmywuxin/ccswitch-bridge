// Per-session reasoning recovery store (Map<sessionKey, reasoning_content[]>)
const sessionStore = new Map();

export function rememberReasoning(key, messages) {
  let list = sessionStore.get(key);
  if (!list) { list = []; sessionStore.set(key, list); }
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.reasoning_content) {
      list.push(msg.reasoning_content);
    }
  }
}

export function recoverReasoning(key, messages) {
  const list = sessionStore.get(key);
  if (!list || list.length === 0) return 0;
  let recovered = 0;
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.tool_calls && !msg.reasoning_content) {
      msg.reasoning_content = list[Math.min(recovered, list.length - 1)];
      recovered++;
    }
  }
  // Clean up consumed entries; keep the store entry in case more rounds arrive
  list.splice(0, recovered);
  if (list.length === 0) sessionStore.delete(key);
  return recovered;
}

export function sessionKey(body) {
  // Derive a stable key from conversation ID or a session-level field.
  // Falls back to request hash for stateless callers.
  const id = body?.conversation || body?.session_id || body?.previous_response_id || "unknown";
  // Use last 2 segments of conversation to keep keys compact while still unique-enough
  return typeof id === "string" ? id.split("_").slice(-2).join("_") : String(id);
}
