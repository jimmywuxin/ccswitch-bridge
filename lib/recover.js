// Per-session reasoning recovery store
// Map<sessionKey, { list: reasoning_content[], lastAccess: number }>
const sessionStore = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function touch(entry) {
  entry.lastAccess = Date.now();
  return entry.list;
}

export function rememberReasoning(key, messages) {
  let entry = sessionStore.get(key);
  if (!entry) { entry = { list: [], lastAccess: 0 }; sessionStore.set(key, entry); }
  const list = touch(entry);
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.reasoning_content) {
      list.push(msg.reasoning_content);
    }
  }
}

export function recoverReasoning(key, messages) {
  const entry = sessionStore.get(key);
  if (!entry || entry.list.length === 0) return 0;
  const list = touch(entry);
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

// Simple FNV-1a hash for collision-resistant key suffix
function hashSuffix(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

export function sessionKey(body) {
  const id = body?.conversation || body?.session_id || body?.previous_response_id || "unknown";
  if (typeof id !== "string") return String(id);
  const suffix = hashSuffix(id);
  return id + "_" + suffix;
}

// Periodic cleanup of stale sessions
const _cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionStore) {
    if (now - entry.lastAccess > SESSION_TTL_MS) sessionStore.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

// Allow the timer to not prevent process exit
if (_cleanupTimer.unref) _cleanupTimer.unref();
