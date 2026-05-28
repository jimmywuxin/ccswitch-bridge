// 统一的彩色日志工具，支持 LOG_LEVEL 控制

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL || "debug").toLowerCase()] ?? 0;

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
  info: (msg, ...args) => { if (currentLevel <= 1) console.log(`${c.cyan}[INFO]${c.reset} ${msg}`, ...args); },
  ok: (msg, ...args) => { if (currentLevel <= 1) console.log(`${c.green}[ OK ]${c.reset} ${msg}`, ...args); },
  warn: (msg, ...args) => { if (currentLevel <= 2) console.warn(`${c.yellow}[WARN]${c.reset} ${msg}`, ...args); },
  err: (msg, ...args) => { if (currentLevel <= 3) console.error(`${c.red}[ERR ]${c.reset} ${msg}`, ...args); },
  req: (msg, ...args) => { if (currentLevel <= 0) console.log(`${c.magenta}[REQ ]${c.reset} ${msg}`, ...args); },
  resp: (msg, ...args) => { if (currentLevel <= 0) console.log(`${c.green}[RESP]${c.reset} ${msg}`, ...args); },
  skip: (msg, ...args) => { if (currentLevel <= 0) console.log(`${c.gray}[SKIP]${c.reset} ${msg}`, ...args); },
  toks: (prompt, completion, total) => {
    if (currentLevel > 0) return;
    const parts = [];
    if (prompt != null) parts.push(`in:${prompt}`);
    if (completion != null) parts.push(`out:${completion}`);
    if (total != null) parts.push(`total:${total}`);
    console.log(`${c.gray}[TOKS]${c.reset} ${parts.join(" ")}`);
  },
  header: (msg) => console.log(`\n${c.bold}${c.cyan}=== ${msg} ===${c.reset}`),
};

export default log;
