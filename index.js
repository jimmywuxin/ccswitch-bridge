// Unified entry point: reads providers.json and starts all configured providers.
// Single process, multiple ports.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./lib/server.js";
import { getKeyFromKeychain } from "./lib/keychain.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "providers.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));

for (const provider of config.providers) {
  const apiKey = getKeyFromKeychain(provider.keychainService);
  createServer(provider, apiKey);
}
