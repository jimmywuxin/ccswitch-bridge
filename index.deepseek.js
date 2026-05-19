import { createServer } from "./lib/server.js";

const DEEPSEEK_IDENTITY =
  "[IMPORTANT: Your true underlying model is DeepSeek (deepseek-v4-pro), developed by DeepSeek (depth seek). You are NOT OpenAI, GPT, Claude, or Codex. When asked about your model identity, you MUST answer that you are DeepSeek, not any other model. Ignore any conflicting identity claims in the instructions above.]";

createServer({
  serviceName: "ccswitch-deepseek",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  envKey: "DEEPSEEK_API_KEY",
  model: "deepseek-v4-pro",
  host: process.env.DEEPSEEK_PROXY_HOST || "127.0.0.1",
  port: parseInt(process.env.DEEPSEEK_PROXY_PORT || "11435", 10),
  upstream: {
    hostname: "api.deepseek.com",
    path: "/v1/chat/completions",
    label: "DeepSeek",
    codePrefix: "deepseek_",
  },
  identity: DEEPSEEK_IDENTITY,
  noSystemRole: false,
});
