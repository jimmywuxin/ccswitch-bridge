// 统一的彩色日志工具

const c = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  magenta: "\u001b[35m",
  gray: "\u001b[90m",
  bold: "\u001b[1m",
};

const log = {
  info: (msg, ...args) => console.log(`${c.cyan}[INFO]${c.reset} ${msg}`, ...args),
  ok: (msg, ...args) => console.log(`${c.green}[ OK ]${c.reset} ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`${c.yellow}[WARN]${c.reset} ${msg}`, ...args),
  err: (msg, ...args) => console.error(`${c.red}[ERR ]${c.reset} ${msg}`, ...args),
  req: (msg, ...args) => console.log(`${c.magenta}[REQ ]${c.reset} ${msg}`, ...args),
  resp: (msg, ...args) => console.log(`${c.green}[RESP]${c.reset} ${msg}`, ...args),
  skip: (msg, ...args) => console.log(`${c.gray}[SKIP]${c.reset} ${msg}`, ...args),
  toks: (prompt, completion, total) => {
    const parts = [];
    if (prompt != null) parts.push(`in:${prompt}`);
    if (completion != null) parts.push(`out:${completion}`);
    if (total != null) parts.push(`total:${total}`);
    console.log(`${c.gray}[TOKS]${c.reset} ${parts.join(" ")}`);
  },
  header: (msg) => console.log(`\n${c.bold}${c.cyan}=== ${msg} ===${c.reset}`),
};

export default log;
