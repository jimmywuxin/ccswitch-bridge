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
- DeepSeek API Key（获取地址：https://platform.deepseek.com/api_keys）
- MiniMax API Key（获取地址：https://platform.minimaxi.com/api_keys）
- 小米 MiMo API Key（获取地址：https://platform.xiaomimimo.com）

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

# 小米 MiMo（格式：tp-xxxxx）
MIMO_API_KEY=tp-your-mimo-api-key
```

### 3. 启动服务

#### 方式一：SwiftBar 菜单栏切换（推荐）

1. 安装 [SwiftBar](https://swiftbar.app/)（`brew install --cask swiftbar`）
2. 创建 SwiftBar 插件目录（如 `~/SwiftBar`），并在 SwiftBar 偏好设置中选择该目录
3. 将 `swiftbar/ccswitch.5s.sh` 复制到 SwiftBar 插件目录：

   ```bash
   cp swiftbar/ccswitch.5s.sh ~/SwiftBar/
   ```

4. 点击菜单栏 🧠 图标即可管理模型：

   - 🌊 **DeepSeek** — 启动 DeepSeek（11435 端口）
   - 🔶 **MiniMax** — 启动 MiniMax（11436 端口）
   - 🔄 **Restart** — 重启当前模型
   - 🛑 **Stop** — 停止运行中的模型
   - 📋 **View Log** — 查看运行日志

    注意：切换模型后请重启 Codex（Cmd+Q 退出后重新打开）。Codex 会将对话历史保存在本地，重启后打开之前的对话即可无缝继续，无需新建会话窗口。

#### 方式二：npm 手动启动

```bash
npm run start:deepseek   # 仅 DeepSeek，11435
npm run start:minimax    # 仅 MiniMax，11436
npm run start:mimo       # 仅小米 MiMo，11437
```

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

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API Key（必填） |
| `MINIMAX_API_KEY` | - | MiniMax API Key（必填） |
| `MIMO_API_KEY` | - | 小米 MiMo API Key（必填，格式 `tp-xxxxx`） |
| `DEEPSEEK_PROXY_HOST` | `127.0.0.1` | DeepSeek 版监听地址 |
| `DEEPSEEK_PROXY_PORT` | `11435` | DeepSeek 版监听端口 |
| `MINIMAX_PROXY_HOST` | `127.0.0.1` | MiniMax 版监听地址 |
| `MINIMAX_PROXY_PORT` | `11436` | MiniMax 版监听端口 |
| `MIMO_PROXY_HOST` | `127.0.0.1` | MiMo 版监听地址 |
| `MIMO_PROXY_PORT` | `11437` | MiMo 版监听端口 |
| `MIMO_MODEL` | `mimo-v2.5-pro` | MiMo 模型名 |
| `MIMO_API_HOST` | `token-plan-cn.xiaomimimo.com` | MiMo API 集群（中国） |
| `LOG_LEVEL` | `debug` | 日志级别：`debug` / `info` / `warn` / `error` |

## 功能

- **⚠️ 切换模型工作流**：Codex 的对话历史保存在本地文件中，切换模型后只需重启 Codex（Cmd+Q 退出再打开），然后打开之前的对话即可继续——所有历史无缝衔接，无需新建会话。
- **会话与模型绑定**：虽然历史可以跨模型传递，但同一个会话窗口在运行期间与当前模型绑定。如果在同一窗口里中途热切换模型（不重启 Codex），旧会话上下文可能被新模型拒绝，导致 `400` 错误。

- **协议翻译**：Responses API ↔ Chat Completions 双向转换
- **多版本共存**：DeepSeek、MiniMax、小米 MiMo 同时运行，各用各的端口
- **工具过滤**：模型限制 128 个工具时，自动按域名关键词优先级裁剪
- **命名空间处理**：自动处理 MCP 工具命名空间
- **推理恢复**：修复模型将工具调用以纯文本格式泄露的问题
- **角色映射**：自动将 OpenAI `developer` role 映射为 `system`
- **内容格式翻译**：`input_text` / `output_text` → `text`

## License

ISC
