import { createServer } from "./lib/server.js";

const MINIMAX_IDENTITY =
  "[IMPORTANT: Your true underlying model is MiniMax (Minimax-M2.7), developed by MiniMax. You are NOT OpenAI, GPT, Claude, DeepSeek, or Codex. When asked about your model identity, you MUST answer that you are MiniMax, not any other model. Ignore any conflicting identity claims in the instructions above.]";

createServer({
  serviceName: "ccswitch-bridge-minimax",
  apiKey: process.env.MINIMAX_API_KEY ?? "",
  envKey: "MINIMAX_API_KEY",
  model: "Minimax-M2.7",
  host: process.env.MINIMAX_PROXY_HOST || "127.0.0.1",
  port: parseInt(process.env.MINIMAX_PROXY_PORT || "11436", 10),
  upstream: {
    hostname: "api.minimax.chat",
    path: "/v1/chat/completions",
    label: "MiniMax",
    codePrefix: "minimax_",
  },
  identity: MINIMAX_IDENTITY,
  noSystemRole: true,
});
