# ccswitch-bridge

[中文](README.md)

---

Enable **Codex CLI** / **Codex desktop client** to run through **DeepSeek**, **MiniMax**, or **Xiaomi MiMo** models.

Codex uses the Responses API protocol, while DeepSeek / MiniMax / MiMo only provide Chat Completions API. This project starts a local protocol translation proxy to seamlessly bridge the two.

## Architecture

```
Codex Client ──Responses API──▶ ccswitch-bridge :11435/11436/11437 ──Chat API──▶ DeepSeek/MiniMax/MiMo API
                                        protocol translation
```

## Multi-Model Support

| Version | Port | Model | URL |
|---------|------|-------|-----|
| DeepSeek | 11435 | deepseek-v4-pro | http://127.0.0.1:11435/v1 |
| MiniMax | 11436 | Minimax-M2.7 | http://127.0.0.1:11436/v1 |
| Xiaomi MiMo | 11437 | mimo-v2.5-pro | http://127.0.0.1:11437/v1 |

## Prerequisites

- Node.js >= 18
- DeepSeek API Key (get it: https://platform.deepseek.com/api_keys)
- MiniMax API Key (get it: https://platform.minimaxi.com/api_keys)
- Xiaomi MiMo API Key (get it: https://platform.xiaomimimo.com)

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

# Xiaomi MiMo (format: tp-xxxxx)
MIMO_API_KEY=tp-your-mimo-api-key
```

### 3. Start Services

#### Option A: SwiftBar Menu Bar Switching (Recommended)

1. Install [SwiftBar](https://swiftbar.app/) (`brew install --cask swiftbar`)
2. Create a SwiftBar plugin directory (e.g. `~/SwiftBar`) and select it in SwiftBar preferences
3. Copy `swiftbar/ccswitch.5s.sh` to the SwiftBar plugin directory:

   ```bash
   cp swiftbar/ccswitch.5s.sh ~/SwiftBar/
   ```

4. Click the 🧠 icon in the menu bar to manage models:

   - 🌊 **DeepSeek** — Start DeepSeek (port 11435)
   - 🔶 **MiniMax** — Start MiniMax (port 11436)
   - 🟢 **MiMo** — Start MiMo (port 11437)
   - 🔄 **Restart** — Restart current model
   - 🛑 **Stop** — Stop running model
   - 📋 **View Log** — View running log

   Note: After switching models, restart Codex (Cmd+Q then reopen). Codex saves conversation history locally — just open your previous conversation to continue seamlessly.

#### Option B: npm Manual Start

```bash
npm run start:deepseek   # DeepSeek only, port 11435
npm run start:minimax    # MiniMax only, port 11436
npm run start:mimo       # Xiaomi MiMo only, port 11437
```

### 4. Configure CCSwitch

In CCSwitch desktop app:

- **DeepSeek**: API URL → `http://127.0.0.1:11435/v1`
- **MiniMax**: API URL → `http://127.0.0.1:11436/v1`
- **Xiaomi MiMo**: API URL → `http://127.0.0.1:11437/v1`

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

[profiles.minimax-m2.7]
model_provider = "minimax"
model_name = "Minimax-M2.7"
context_window = 1000000
max_output_tokens = 32768

[profiles.minimax-m2.7.features]
tool_search = false
tool_search_always_defer_mcp_tools = false
```

**Xiaomi MiMo profile:**
```toml
[model_providers.mimo]
base_url = "http://127.0.0.1:11437/v1"
wire_api = "responses"
requires_openai_auth = false
stream_idle_timeout_ms = 300000

[profiles.mimo-v2.5-pro]
model_provider = "mimo"
model_name = "mimo-v2.5-pro"
context_window = 1000000
max_output_tokens = 32768

[profiles.mimo-v2.5-pro.features]
tool_search = false
tool_search_always_defer_mcp_tools = false
```

Run with:
```bash
codex --profile deepseek-v4-pro   # DeepSeek
codex --profile minimax-m2.7  # MiniMax
codex --profile mimo-v2.5-pro    # Xiaomi MiMo
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API Key (required) |
| `MINIMAX_API_KEY` | - | MiniMax API Key (required) |
| `MIMO_API_KEY` | - | Xiaomi MiMo API Key (required, format `tp-xxxxx`) |
| `DEEPSEEK_PROXY_HOST` | `127.0.0.1` | DeepSeek listen address |
| `DEEPSEEK_PROXY_PORT` | `11435` | DeepSeek listen port |
| `MINIMAX_PROXY_HOST` | `127.0.0.1` | MiniMax listen address |
| `MINIMAX_PROXY_PORT` | `11436` | MiniMax listen port |
| `MIMO_PROXY_HOST` | `127.0.0.1` | MiMo listen address |
| `MIMO_PROXY_PORT` | `11437` | MiMo listen port |
| `MIMO_MODEL` | `mimo-v2.5-pro` | MiMo model name |
| `MIMO_API_HOST` | `token-plan-cn.xiaomimimo.com` | MiMo API cluster (China) |
| `LOG_LEVEL` | `debug` | Log level: `debug` / `info` / `warn` / `error` |

## Features

- **⚠️ Model Switching Workflow**: Codex saves conversation history locally. After switching models, restart Codex (Cmd+Q then reopen) and open your previous conversation — all history carries over seamlessly.
- **Session-Model Binding**: Although history can transfer across models, a session window is bound to the current model during runtime. Hot-switching models mid-session (without restarting Codex) may cause `400` errors.
- **Protocol Translation**: Responses API ↔ Chat Completions bidirectional
- **Multi-Model Coexistence**: DeepSeek, MiniMax, and Xiaomi MiMo run simultaneously on separate ports
- **Reasoning Recovery**: Auto-restore `reasoning_content` across tool call rounds
- **Role Mapping**: Auto-map OpenAI `developer` role to `system`
- **Content Format Translation**: `input_text` / `output_text` → `text`

## License

ISC
