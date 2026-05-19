# ccswitch-bridge

让 Codex CLI / Codex 桌面客户端通过 **DeepSeek** 或 **MiniMax** 模型运行。

Codex 使用 Responses API 协议，而 DeepSeek / MiniMax 只提供 Chat Completions API。本项目在本地启动协议翻译代理，在两者之间无缝转换。

## 架构

```
Codex 客户端 ──Responses API──▶ ccswitch-bridge :11435/11436 ──Chat API──▶ DeepSeek/MiniMax API
                                          协议翻译
```

## 双版本支持

| 版本 | 端口 | 模型 | 地址 |
|------|------|------|------|
| DeepSeek | 11435 | deepseek-v4-pro | http://127.0.0.1:11435/v1 |
| MiniMax | 11436 | MiniMax-Text-01 | http://127.0.0.1:11436/v1 |

## 前置条件

- Node.js >= 18
- DeepSeek API Key（获取地址：https://platform.deepseek.com/api_keys）
- MiniMax API Key（获取地址：https://platform.minimaxi.com/api_keys）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

编辑 `.env`：

```env
# DeepSeek
DEEPSEEK_API_KEY=sk-your-deepseek-api-key

# MiniMax
MINIMAX_API_KEY=your-minimax-api-key
```

### 3. 启动服务

**方式一：手动双开（前台）**
```bash
npm run start:all
```
同时启动两个版本，终端被占用。

**方式二：后台运行（pm2，推荐）**
```bash
# 安装 pm2（首次）
npm install pm2 -g

# 启动
npm run pm2:start

# 查看状态
pm2 status

# 查看日志
npm run pm2:logs

# 重启
npm run pm2:restart

# 停止
npm run pm2:stop
```

pm2 会在后台运行，重启电脑后自动恢复。

**单独启动某一版本**
```bash
npm run start:deepseek   # 仅 DeepSeek，11435
npm run start:minimax    # 仅 MiniMax，11436
```

### 4. 配置 CCSwitch

在 CCSwitch 桌面应用中：

- **DeepSeek**：API 地址填写 `http://127.0.0.1:11435/v1`
- **MiniMax**：API 地址填写 `http://127.0.0.1:11436/v1`

## Codex CLI 用户

如果直接使用 Codex CLI（不通过 CCSwitch），编辑 `~/.codex/config.toml`：

**DeepSeek 版本：**
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

**MiniMax 版本：**
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

使用：
```bash
codex --profile deepseek-v4-pro   # DeepSeek
codex --profile minimax-text-01  # MiniMax
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API Key（必填） |
| `MINIMAX_API_KEY` | - | MiniMax API Key（必填） |
| `DEEPSEEK_PROXY_HOST` | `127.0.0.1` | DeepSeek 版监听地址 |
| `DEEPSEEK_PROXY_PORT` | `11435` | DeepSeek 版监听端口 |
| `MINIMAX_PROXY_HOST` | `127.0.0.1` | MiniMax 版监听地址 |
| `MINIMAX_PROXY_PORT` | `11436` | MiniMax 版监听端口 |

## 功能

- **协议翻译**：Responses API ↔ Chat Completions 双向转换
- **双版本共存**：DeepSeek 和 MiniMax 同时运行，各用各的端口
- **工具过滤**：模型限制 128 个工具时，自动按域名关键词优先级裁剪
- **命名空间处理**：自动处理 MCP 工具命名空间
- **推理恢复**：修复模型将工具调用以纯文本格式泄露的问题
- **角色映射**：自动将 OpenAI `developer` role 映射为 `system`
- **内容格式翻译**：`input_text` / `output_text` → `text`

## License

ISC
