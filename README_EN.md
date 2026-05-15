# cswitch-deepseek

[中文](README.md)

---

Codex CLI -> DeepSeek proxy. Translates OpenAI Responses API to DeepSeek Chat Completions API.

## Quick Start

Install:

```bash
npm install
```

Edit `.env`:

```
api_key=sk-your-deepseek-api-key
```

Start:

```bash
npm start
```

## Files

| File | Description |
|------|-------------|
| `index.js` | HTTP server entry |
| `lib/log.js` | Colored logging |
| `lib/translate.js` | Input translation (Responses -> Chat) |
| `lib/sse.js` | SSE event translation (Chat -> Responses) |
| `lib/recover.js` | reasoning_content auto-restore |
| `test_translate.js` | 33 unit tests |

## Translations

### Input (Responses -> Chat Completions)

- message items (`input_text` / `output_text` / `reasoning_text`)
- `function_call` -> assistant `tool_calls`
- `function_call_output` -> `tool` message
- `reasoning` items (skip, retain `reasoning_content`)
- `developer` role -> `system`
- `input_image` -> `image_url` (multimodal)
- `input_file` / `input_audio` -> skip with stats

### Output (Chat Completions -> Responses SSE)

- `response.created` / `in_progress` / `completed`
- `output_item.added` / `done`
- `output_text.delta` / `done` + `content_part.added` / `done`
- `reasoning_text.delta` / `done` + `content_part.added` / `done`
- `function_call_arguments.delta` / `done`
- `usage` (token stats) in `response.completed`

### Parameters

- `instructions` -> system message
- `temperature` / `top_p` / `max_output_tokens` passthrough
- `tools` / `tool_choice` translation
- `thinking` / `reasoning` -> DeepSeek thinking mode
- `reasoning_content` auto-restore across rounds

## Tests

```bash
npm run test:translate
```

33 unit tests covering all translation logic.

## License

ISC

