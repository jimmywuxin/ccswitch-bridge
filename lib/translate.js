import log from "./log.js";

export function extractText(content) {
  if (typeof content === "string") return content;
  if (!content) return "";
  if (!Array.isArray(content)) {
    if (typeof content === "object" && content.type && content.text != null) return content.text;
    return "";
  }
  return content
    .filter((p) => ["input_text","output_text","text","reasoning_text"].includes(p.type))
    .map((p) => p.text ?? "")
    .join("");
}

export function extractImages(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((p) => p.type === "input_image")
    .map((p) => {
      if (p.image_url) return { type: "image_url", image_url: p.image_url };
      if (p.url) return { type: "image_url", image_url: { url: p.url } };
      return null;
    })
    .filter(Boolean);
}

// options.keepReasoningContent: �Ƿ��� reasoning_content (thinking ģʽ����ʱΪ true)
export function translateMessages(input, options = {}) {
  const messages = [];
  const stats = { skipped: { reasoning: 0, image: 0, file: 0, audio: 0, other: 0 }, strippedReasoningContent: 0, preservedReasoningContent: 0 };

  if (!Array.isArray(input)) {
    if (typeof input === "string" && input.trim()) {
      messages.push({ role: "user", content: input });
    } else if (typeof input === "object" && input !== null) {
      const text = extractText(input.content);
      if (text) messages.push({ role: "user", content: text });
    }
    return { messages, stats };
  }

  for (const item of input) {
    if (!item) continue;

    if (item.type === "function_call") {
      const last = messages[messages.length - 1];
      const target = last && last.role === "assistant" ? last : (() => {
        const m = { role: "assistant", tool_calls: [] };
        messages.push(m);
        return m;
      })();
      if (!target.tool_calls) target.tool_calls = [];
      target.tool_calls.push({
        id: item.call_id || item.id,
        type: "function",
        function: { name: item.name, arguments: item.arguments },
      });
      if (item.status === "incomplete") {
        log.warn("function_call status incomplete: " + (item.call_id || item.id));
      }
      if (item.reasoning_content && !target.reasoning_content) {
        target.reasoning_content = item.reasoning_content;
      }
      continue;
    }

    if (item.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id || item.id,
        content: extractText(item.output),
      });
      if (item.status === "incomplete") {
        log.warn("function_call_output status incomplete: " + (item.call_id || item.id));
      }
      continue;
    }

    if (item.type === "reasoning") {
      stats.skipped.reasoning++;
      if (item.reasoning_content) {
        const last = messages[messages.length - 1];
        if (last && !last.reasoning_content) last.reasoning_content = item.reasoning_content;
      }
      continue;
    }

    if (item.role) {
      const role = item.role === "developer" ? "system" : item.role;
      const textContent = extractText(item.content);
      const imageContent = extractImages(item.content);

      if (imageContent.length > 0 && (role === "user" || role === "system")) {
        const parts = [];
        if (textContent) parts.push({ type: "text", text: textContent });
        parts.push(...imageContent);
        messages.push({ role, content: parts });
        stats.skipped.image += imageContent.length;
      } else if (textContent || imageContent.length > 0) {
        const msg = { role, content: textContent };
        if (item.reasoning_content) msg.reasoning_content = item.reasoning_content;
        if (item.tool_calls) msg.tool_calls = item.tool_calls;
        if (item.tool_call_id) msg.tool_call_id = item.tool_call_id;
        messages.push(msg);
      }

      if (Array.isArray(item.content)) {
        for (const p of item.content) {
          if (p.type === "input_file") stats.skipped.file++;
          if (p.type === "input_audio") stats.skipped.audio++;
        }
      }
      continue;
    }

    if (item.type === "message") {
      const textContent = extractText(item.content);
      if (textContent) messages.push({ role: "user", content: textContent });
      continue;
    }

    stats.skipped.other++;
  }

  // ���� reasoning_content
  if (options.keepReasoningContent) {
    // thinking ģʽ: ���� reasoning_content, DeepSeek Ҫ��ԭ������
    let count = 0;
    for (const msg of messages) {
      if (msg.reasoning_content) count++;
    }
    stats.preservedReasoningContent = count;
  } else {
    // �� thinking ģʽ: ��� reasoning_content, ���� DeepSeek �� 400
    for (const msg of messages) {
      if (msg.reasoning_content) {
        delete msg.reasoning_content;
        stats.strippedReasoningContent++;
      }
    }
  }

  return { messages, stats };
}

export function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return extractText(messages[i].content);
  }
  return "";
}

export function translateTools(rawTools) {
  if (!Array.isArray(rawTools)) return [];
  return rawTools
    .map((t) => {
      const name = t.name ?? t.function?.name;
      if (!name) return null;
      return { type: "function", function: { name, description: t.description ?? t.function?.description ?? "", parameters: t.parameters ?? t.function?.parameters ?? { type: "object", properties: {} } } };
    })
    .filter(Boolean);
}

export function translateToolChoice(toolChoice) {
  if (!toolChoice) return null;
  if (typeof toolChoice === "string") return toolChoice;
  if (toolChoice.type === "function" && toolChoice.name) {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return toolChoice;
}