const queue = [];

export function rememberReasoning(key, messages) {
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.reasoning_content) {
      queue.push(msg.reasoning_content);
    }
  }
}

export function recoverReasoning(key, messages) {
  if (queue.length === 0) return 0;
  let recovered = 0;
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.tool_calls && !msg.reasoning_content) {
      msg.reasoning_content = queue[Math.min(recovered, queue.length - 1)];
      recovered++;
    }
  }
  return recovered;
}

export function sessionKey(body) { return "g"; }