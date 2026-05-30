# Changelog

## [1.2.3] — 2026-05-30

### Security

- **推理项 ID 安全修复** — `lib/sse.js` 推理项 ID 生成从 `Math.random()` 补齐为 `crypto.randomUUID()`，与 v1.2.1 安全审计目标一致

### Fixed

- **SSE inline thinking 丢弃 tool calls** — 修复 `feed()` 中 inline thinking 的 early return 导致同一 chunk 中的 tool calls 被静默丢弃的问题
- **SSE inline think 缓冲区未 flush** — 修复 `done()` 未 flush 残留 think buffer 导致无 `</think>` 标签的响应内容丢失

### Changed

- **README 模型名统一** — 文档中 MiniMax 模型名从 `MiniMax-Text-01` 修正为 `Minimax-M2.7`，与代码一致
- **README_EN.md 全面更新** — 移除不存在的 pm2/start:all scripts，改为 SwiftBar + npm 手动启动；补充 MiMo 环境变量和 Features 描述

### Tests

- 新增 `test_sse.js` — 12 个测试覆盖 `SseTranslator`（inline think、tool calls、reasoning、done 输出结构、edge cases）
- 测试总数从 38 增至 50


## [1.2.2] — 2026-05-30

### Fixed

- **SSE 缓冲阈值降低** — 解析器 buffer 阈值从 8KB 降至 512 bytes，减少消息延迟，避免 Codex 侧超时
- **Client 断开处理** — 增加 `res.on('close')` 监听，Codex 断开时立即中止上游请求，避免残留状态影响后续请求

## [1.2.1] — 2026-05-28

### Security

- **请求体验证** — `/v1/responses` 端点增加 `input` 类型校验，非法输入返回 400
- **密码学安全 ID** — 响应 ID 生成从 `Math.random()` 升级为 `crypto.randomUUID()`
- **sessionKey 碰撞加固** — hash 后缀从 4 位扩展到 8 位 hex（16 bit → 32 bit）

### Fixed

- **SSE think 缓冲区溢出保护** — MiniMax 内联 `<think>` 缓冲区增加 100KB 上限，防止无限增长导致 OOM
- **SSE 解析器 Buffer 化** — 多字节 UTF-8 字符在 chunk 边界不再被截断
- **日志级别控制** — 新增 `LOG_LEVEL` 环境变量（debug/info/warn/error），可按需收紧日志输出

### Changed

- **移除未使用的 axios 依赖** — 清理 21 个冗余包
- **统一 dotenv 加载** — 仅在 `lib/server.js` 入口加载，移除 provider 中的重复调用
- **移除未使用的 splitThinking 导入** — `providers/deepseek.js` 清理

### Tests

- 新增 `test_recover.js` — 9 个测试覆盖 `rememberReasoning`、`recoverReasoning`、`sessionKey`
- 测试总数从 29 增至 38

## [1.2.0] — 2026-05-27

### Added

- **小米 MiMo 支持** — 新增第三个 provider：小米 MiMo (`mimo-v2.5-pro`)，通过独立端口 11437 运行
  - 新增 `providers/mimo.js` — MiMo 配置（`api-key` 认证头、自定义端点）
  - 新增 `index.mimo.js` — MiMo 入口
  - 新增 `npm run start:mimo` 脚本
  - 新增环境变量：`MIMO_API_KEY`、`MIMO_MODEL`、`MIMO_PROXY_HOST`、`MIMO_PROXY_PORT`、`MIMO_API_HOST`
- **可配置认证头** — `lib/server.js` 支持 provider 自定义 HTTP 认证头名称（`authHeaderName`），MiMo 使用 `api-key` 而非 `Authorization: Bearer`
- **SwiftBar 支持** — 项目自带 `swiftbar/ccswitch.5s.sh` 和用户脚本均已添加 MiMo 菜单项（状态显示、启停/重启、日志查看、健康检查）

### Changed

- `lib/server.js` — 认证头从硬编码 `Authorization` 改为可配置

## [1.1.2] — 2026-05-24

### Fixed

- `lib/sse.js` — 修复 `pushThinkBuf` 返回值中 `rest` 属性遗漏问题
- `lib/sse.js` — 修复 `done()` 方法中的 `break` 语法错误
- `lib/recover.js` — 移除 sessionStore TTL 逻辑，简化记忆管理
- `lib/recover.js` — 修复 `sessionKey` 碰撞问题

## [1.1.1] — 2026-05-20

### Added

- SwiftBar 脚本自动检测项目路径，支持插件目录部署

### Changed

- SwiftBar 脚本增加健康检查（自动重启崩溃的服务）

## [1.1.0] — 2026-05-20

### Added

- **MiniMax 支持** — 新增第二个 provider：MiniMax (`Minimax-M2.7`)，独立端口 11436
- **SwiftBar 插件** — `swiftbar/ccswitch.5s.sh` 菜单栏管理工具

## [1.0.0] — 2026-05-18

### Added

- 初始版本：DeepSeek 协议翻译代理
- Responses API → Chat Completions 双向转换
- SSE 流式翻译
- `reasoning_content` 自动记忆与补回
- 33 个单元测试
