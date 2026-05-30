# ccswitch-bridge

让 Codex CLI / Codex 桌面客户端通过 **DeepSeek**、**MiniMax** 或 **小米 MiMo** 模型运行。

Codex 使用 Responses API 协议，而 DeepSeek / MiniMax / MiMo 只提供 Chat Completions API。本项目在本地启动协议翻译代理，在两者之间无缝转换。

## 架构

```
Codex 客户端 ──Responses API──▶ ccswitch-bridge :11435/11436/11437 ──Chat API──▶ DeepSeek/MiniMax/MiMo API
                                          协议翻译
```

## 多模型支持

| 版本 | 端口 | 模型 | 地址 |
|------|------|------|------|
| DeepSeek | 11435 | deepseek-v4-pro | http://127.0.0.1:11435/v1 |
| MiniMax | 11436 | Minimax-M2.7 | http://127.0.0.1:11436/v1 |
| 小米 MiMo | 11437 | mimo-v2.5-pro | http://127.0.0.1:11437/v1 |

## 前置条件

- Node.js >= 18
- 各模型的 API Key（见下方配置说明）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key（macOS 钥匙串，推荐）

API Key 存储在 macOS 钥匙串中，安全且不进 git：

```bash
security add-generic-password -s "DEEPSEEK_API_KEY" -w "sk-your-deepseek-api-key"
security add-generic-password -s "MINIMAX_API_KEY" -w "your-minimax-api-key"
security add-generic-password -s "MIMO_API_KEY" -w "tp-your-mimo-api-key"
```

也可在 `.env` 文件中配置（会自动 fallback 到环境变量）。

### 3. 启动服务

#### 方式一：统一启动（推荐）

```bash
npm start          # 单进程启动 DeepSeek + MiniMax + MiMo（三个端口同时运行）
```

三个模型同时在 11435/11436/11437 端口运行，无需启停切换。通过 Codex 的 `--profile` 参数即可选择不同模型。

#### 方式二：单独启动某个模型

```bash
npm run start:deepseek   # 仅 DeepSeek，端口 11435
npm run start:minimax    # 仅 MiniMax，端口 11436
npm run start:mimo       # 仅小米 MiMo，端口 11437
```

#### 方式三：SwiftBar 菜单栏控制

> SwiftBar 脚本仅提供**全体启停**（Start/Stop/Restart All）和统一日志查看。
> 不提供单服务切换——三个模型同时运行，通过 Codex profile 选择模型即可。

1. 安装 [SwiftBar](https://swiftbar.app/)（`brew install --cask swiftbar`）
2. 在 SwiftBar 偏好设置中指定插件目录（如 `~/SwiftBar`）
3. 将脚本复制到插件目录：

   ```bash
   cp swiftbar/ccswitch.5s.sh ~/SwiftBar/
   ```

4. 菜单栏点击 🧠 图标，显示各端口运行状态（✅/❌），可执行：
   - **🚀 Start All** — 同时启动三个模型
   - **🛑 Stop All** — 停止所有服务
   - **🔄 Restart All** — 重启所有服务
   - **📋 View All Log** — 在终端中实时查看统一日志

### 4. 配置 CCSwitch

在 CCSwitch 桌面应用中：

- **DeepSeek**：API 地址填写 `http://127.0.0.1:11435/v1`
- **MiniMax**：API 地址填写 `http://127.0.0.1:11436/v1`
- **小米 MiMo**：API 地址填写 `http://127.0.0.1:11437/v1`

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

[profiles.minimax-m2.7]
model_provider = "minimax"
model_name = "Minimax-M2.7"
context_window = 1000000
max_output_tokens = 32768

[profiles.minimax-m2.7.features]
tool_search = false
tool_search_always_defer_mcp_tools = false
```

**小米 MiMo 版本：**
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

使用：
```bash
codex --profile deepseek-v4-pro   # DeepSeek
codex --profile minimax-m2.7  # MiniMax
codex --profile mimo-v2.5-pro    # 小米 MiMo
```

## 新增模型

新增一个大模型只需两步，无需写代码：

### 1. 添加 API Key 到钥匙串

```bash
security add-generic-password -s "NEW_MODEL_API_KEY" -w "sk-your-api-key"
```

### 2. 在 `providers.json` 中添加配置

```json
{
  "id": "new-model",
  "name": "ccswitch-new-model",
  "model": "model-name",
  "keychainService": "NEW_MODEL_API_KEY",
  "port": 11438,
  "host": "127.0.0.1",
  "upstream": {
    "hostname": "api.newmodel.com",
    "path": "/v1/chat/completions",
    "label": "NewModel",
    "codePrefix": "newmodel_"
  },
  "authHeader": "Authorization",
  "authPrefix": "Bearer ",
  "noSystemRole": false,
  "inlineThinking": false,
  "identity": "[IMPORTANT: Your true underlying model is ...]"
}
```

重启服务即可：

```bash
npm start
```

### 配置字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，用于 `index.<id>.js` 单独启动 |
| `name` | string | 服务名称，用于日志显示 |
| `model` | string | 模型名称，发送给上游 API |
| `keychainService` | string | macOS 钥匙串服务名（也用作环境变量名 fallback） |
| `port` | number | 代理监听端口 |
| `host` | string | 代理监听地址 |
| `upstream.hostname` | string | 上游 API 主机名 |
| `upstream.path` | string | 上游 API 路径 |
| `upstream.label` | string | 上游显示名称（用于日志） |
| `upstream.codePrefix` | string | 错误码前缀 |
| `authHeader` | string | 认证头名称（默认 `Authorization`） |
| `authPrefix` | string | 认证头前缀（如 `Bearer `，MiMo 为空） |
| `noSystemRole` | boolean | `true` = 将 system 消息拼入首条 user 消息 |
| `inlineThinking` | boolean | `true` = 推理内容内嵌在 content 的 `<think>` 标签中 |
| `identity` | string | 身份注入字符串 |
| `extraChatFieldsKey` | string? | 额外 chat body 字段名（如 `thinking`） |
| `extraChatFields.enabled` | object? | thinking 启用时的值 |
| `extraChatFields.disabled` | object? | thinking 禁用时的值（省略则不发送） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API Key（钥匙串优先） |
| `MINIMAX_API_KEY` | - | MiniMax API Key（钥匙串优先） |
| `MIMO_API_KEY` | - | 小米 MiMo API Key（钥匙串优先） |
| `LOG_LEVEL` | `debug` | 日志级别：`debug` / `info` / `warn` / `error` |

> 端口和主机地址现在统一在 `providers.json` 中配置，不再需要环境变量。

## 功能

- **配置驱动**：新增模型只需编辑 `providers.json` + 添加钥匙串 key，无需写代码
- **macOS 钥匙串集成**：API Key 安全存储，不进 git
- **单进程多端口**：`npm start` 一个进程启动所有 provider
- **⚠️ 切换模型**：所有模型同时运行在不同端口。要切换模型，在 Codex 配置中指定对应 profile（如 `--profile minimax-m2.7`），重启 Codex 后之前的对话历史无缝衔接，无需新建会话。
- **协议翻译**：Responses API ↔ Chat Completions 双向转换
- **多版本共存**：DeepSeek、MiniMax、小米 MiMo 同时运行，各用各的端口
- **推理恢复**：修复模型将工具调用以纯文本格式泄露的问题
- **角色映射**：自动将 OpenAI `developer` role 映射为 `system`
- **内容格式翻译**：`input_text` / `output_text` → `text`

## License

ISC
