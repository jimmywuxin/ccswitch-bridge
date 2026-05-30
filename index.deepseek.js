// Backward-compatible entry: starts only the DeepSeek provider from providers.json.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./lib/server.js";
import { getKeyFromKeychain } from "./lib/keychain.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, "providers.json"), "utf-8"));
const provider = config.providers.find(p => p.id === "deepseek");
createServer(provider, getKeyFromKeychain(provider.keychainService));
