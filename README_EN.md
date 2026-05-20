# ccswitch-bridge

[中文](README.md)

---

Enable **Codex CLI** / **Codex desktop client** to run through **DeepSeek** or **MiniMax** models.

Codex uses the Responses API protocol, while DeepSeek / MiniMax only provide Chat Completions API. This project starts a local protocol translation proxy to seamlessly bridge the two.

## Architecture

```
Codex Client ──Responses API──▶ ccswitch-bridge :11435/11436 ──Chat API──▶ DeepSeek/MiniMax API
                                        protocol translation
```

## Dual Version Support

| Version | Port | Model | URL |
|---------|------|-------|-----|
| DeepSeek | 11435 | deepseek-v4-pro | http://127.0.0.1:11435/v1 |
| MiniMax | 11436 | MiniMax-Text-01 | http://127.0.0.1:11436/v1 |

## Prerequisites

- Node.js >= 18
- DeepSeek API Key (get it: https://platform.deepseek.com/api_keys)
- MiniMax API Key (get it: https://platform.minimaxi.com/api_keys)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Edit `.env`:

```env
# DeepSeek
DEEPSEEK_API_KEY=sk-your-deepseek-api-key

# MiniMax
MINIMAX_API_KEY=your-minimax-api-key
```

### 3. Start Services

**Option A: Manual dual foreground**
```bash
npm run start:all
```
Starts both versions simultaneously, terminal will be occupied.

**Option B: Background with pm2 (recommended)**
```bash
# Install pm2 (first time)
npm install pm2 -g

# Start
npm run pm2:start

# View status
pm2 status

# View logs
npm run pm2:logs

# Restart
npm run pm2:restart

# Stop
npm run pm2:stop
```

pm2 runs in the background and automatically restores after reboot.

**Start a single version**
```bash
npm run start:deepseek   # DeepSeek only, port 11435
npm run start:minimax    # MiniMax only, port 11436
```

### 4. Configure CCSwitch

In CCSwitch desktop app:

- **DeepSeek**: API URL → `http://127.0.0.1:11435/v1`
- **MiniMax**: API URL → `http://127.0.0.1:11436/v1`

## Codex CLI Users

If using Codex CLI directly (without CCSwitch), edit `~/.codex/config.toml`:

**DeepSeek profile:**
```toml
[model_providers.deepseek]
base_url = "http://127.0.0.1:11435/v1"
wire_api = "responses"
requires_openai_auth = false
stream_idle_timeout_ms = 300000

[profiles.deepseek-v4-pro]
model_provider = "deepseek"
model_name = "deepseek-v4-pro"
context_window = 1000000
max_output_tokens = 32768

[profiles.deepseek-v4-pro.features]
tool_search = false
tool_search_always_defer_mcp_tools = false
```

**MiniMax profile:**
```toml
[model_providers.minimax]
base_url = "http://127.0.0.1:11436/v1"
wire_api = "responses"
requires_openai_auth = false
stream_idle_timeout_ms = 300000

[profiles.minimax-text-01]
model_provider = "minimax"
model_name = "MiniMax-Text-01"
context_window = 1000000
max_output_tokens = 32768

[profiles.minimax-text-01.features]
tool_search = false
tool_search_always_defer_mcp_tools = false
```

Run with:
```bash
codex --profile deepseek-v4-pro   # DeepSeek
codex --profile minimax-text-01  # MiniMax
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API Key (required) |
| `MINIMAX_API_KEY` | - | MiniMax API Key (required) |
| `DEEPSEEK_PROXY_HOST` | `127.0.0.1` | DeepSeek version listen address |
| `DEEPSEEK_PROXY_PORT` | `11435` | DeepSeek version listen port |
| `MINIMAX_PROXY_HOST` | `127.0.0.1` | MiniMax version listen address |
| `MINIMAX_PROXY_PORT` | `11436` | MiniMax version listen port |

## Features
- **⚠️ Session-Model Binding**: Each Codex session window is stateful (carrying tool call history, reasoning cache, etc.). Switching models mid-session (e.g. DeepSeek → MiniMax) may cause `400` errors because the old history is incompatible with the new model. **Rule: one session = one fixed model. To switch models, open a new session window.**


- **Protocol Translation**: Responses API ↔ Chat Completions bidirectional
- **Dual Version Coexistence**: DeepSeek and MiniMax run simultaneously on different ports
- **Tool Filtering**: Auto-prune tools beyond model limit (128) by domain keyword priority
- **Namespace Handling**: Auto-handle MCP tool namespaces
- **Reasoning Recovery**: Fix tool call leakage as plain text
- **Role Mapping**: Auto-map OpenAI `developer` role to `system`
- **Content Format Translation**: `input_text` / `output_text` → `text`

## License

ISC
