// macOS Keychain API Key reader with environment variable fallback.
// Mirrors the token-eye pattern: security find-generic-password -s <service> -w

import { execSync } from "node:child_process";

/**
 * Read an API key from macOS Keychain, falling back to environment variable.
 * @param {string} service - Keychain service name (also used as env var name)
 * @returns {string} The API key, or empty string if not found
 */
export function getKeyFromKeychain(service) {
  // 1. Try macOS Keychain
  try {
    const key = execSync(`security find-generic-password -s "${service}" -w`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (key) return key;
  } catch {
    // Keychain entry not found or not macOS — fall through
  }

  // 2. Fallback: environment variable
  return process.env[service] ?? "";
}
