/**
 * zBiz 统一 deep-link 协议（`zbiz://`）—— 解析与构造。
 *
 * ## 这份代码的出处与金标
 *
 * **规范来源**：`z-biz-tool-lead/doc/矩阵规划/04_连接度：家族面板与统一协议.md` §2。
 *
 * **字节级金标**：`z-biz-tool-box/src-tauri/src/handoff.rs`（390 行，12 条单测）。
 * 那是 box 仓里已落地、已实测（macOS 上跑通「第二实例带参 → 第一实例收到
 * 中文路径」）的实现。本文件是它的 TypeScript 等价物，
 * **任何字节差异都会让 box 与其它 app 互相不认识对方的链接**。
 *
 * 所以这里的每一条编码规则、每一个校验，都照抄 handoff.rs，
 * 不做「顺手改进」——改进必须回到 handoff.rs 两侧同步改，并重跑两边的单测。
 *
 * ## 语法
 *
 * ```text
 * zbiz://<product>/<action>?<key>=<value>&<key>=<value>
 * ```
 *
 * - `product`：目标 app id（如 `note`）
 * - `action`：动作（如 `open`），**缺省为 `open`**
 * - `params`：键值对，key 是白名单字符，value 百分号转义
 *
 * 例：`zbiz://note/open?file=/tmp/a.md&from=box`
 *
 * ## 为什么用 URL 而不是一堆命令行 flag
 *
 * 一个 token 就能带齐「去哪个应用、做什么、带什么上下文」。它在三种传输里
 * 是同一串字节：argv（本阶段的落地方式）、OS 的 scheme 唤起（后续）、
 * 以及日志。换成 `--product note --file /x` 这种多参数形态，每个接收方都要
 * 自己解析 argv，而 argv 里还混着 macOS 的 `-psn_0_12345` 和 Windows 的 exe 路径。
 *
 * ## 为什么不 import tauri
 *
 * 本文件是纯函数，不碰 Tauri、不碰 React、不碰文件系统。这样同一份协议能
 * 同时跑在 box 的 iframe 插件沙箱、Tauri 前端、以及 node 测试里。
 */

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/** 深链 scheme。 */
export const ZBIZ_SCHEME = "zbiz://";

/** 缺省动作。`zbiz://note?file=x` 等价于 `zbiz://note/open?file=x`。 */
export const DEFAULT_ACTION = "open";

/** 前端监听的事件名。payload 无意义（`()`），只当「队列里有新深链了」的信号。 */
export const DEEPLINK_EVENT = "zbiz-open";

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/** 一条握手请求。 */
export interface Handoff {
  /** 目标产品 id。 */
  product: string;
  /** 动作。 */
  action: string;
  /** 参数键值对。 */
  params: Record<string, string>;
}

/** 解析或构造的结果。 */
export type DeepLinkResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/* ------------------------------------------------------------------ *
 * 百分号编解码
 * ------------------------------------------------------------------ */

/**
 * 只保留 RFC3986 的 unreserved 再额外放行 `/` 与 `：`：
 * - 前者让路径在日志里仍然可读（`?file=/tmp/a.md` 而不是 `%2Ftmp%2Fa.md`）
 * - 后者留给 Windows 盘符（`C:\x` → `C:%5Cx`，冒号不被转义才认得出是盘符）
 *
 * 其余字节一律转义，尤其是 `&` `=` `#` `+` 空格和所有非 ASCII。
 */
function isLiteral(b: number): boolean {
  const c = String.fromCharCode(b);
  return (
    (b >= 0x41 && b <= 0x5a) || // A-Z
    (b >= 0x61 && b <= 0x7a) || // a-z
    (b >= 0x30 && b <= 0x39) || // 0-9
    c === "-" ||
    c === "." ||
    c === "_" ||
    c === "~" ||
    c === "/" ||
    c === ":"
  );
}

/**
 * 单个十六进制数字。
 *
 * **不补零** —— Rust 侧 `hex_digit` 是 `0..=9 => '0'+n` / `_ => 'A'+(n-10)`，
 * 补零会产出 `%0E` 而不是 `%E`，与 box 的 handoff.rs 不兼容。
 */
function hexDigit(n: number): string {
  return n <= 9 ? String.fromCharCode(48 + n) : String.fromCharCode(65 + (n - 10));
}

function hexValue(c: string): number | null {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "a" && c <= "f") return c.charCodeAt(0) - 87;
  if (c >= "A" && c <= "F") return c.charCodeAt(0) - 55;
  return null;
}

/**
 * 按字节百分号转义。非 ASCII 按 UTF-8 逐字节转义（中文路径不会被打断）。
 */
export function encodeValue(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let out = "";
  for (const b of bytes) {
    if (isLiteral(b)) {
      out += String.fromCharCode(b);
    } else {
      out += `%${hexDigit(b >> 4)}${hexDigit(b & 0x0f)}`;
    }
  }
  return out;
}

/**
 * 解百分号转义。非法转义或非 UTF-8 如实报错——不静默替换成替身字符，
 * 那样只会把「文件名莫名其妙变了」的问题推迟到用户发现文件打不开时。
 */
export function decodeValue(value: string): DeepLinkResult<string> {
  const bytes = new TextEncoder().encode(value);
  const out: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] === 0x25 /* % */) {
      if (i + 2 >= bytes.length) {
        return { ok: false, reason: `百分号转义不完整: ${value}` };
      }
      const hi = hexValue(String.fromCharCode(bytes[i + 1]));
      const lo = hexValue(String.fromCharCode(bytes[i + 2]));
      if (hi === null) {
        return {
          ok: false,
          reason: `非法十六进制: %${String.fromCharCode(bytes[i + 1], bytes[i + 2])}`,
        };
      }
      if (lo === null) {
        return {
          ok: false,
          reason: `非法十六进制: %${String.fromCharCode(bytes[i + 1], bytes[i + 2])}`,
        };
      }
      out.push((hi << 4) | lo);
      i += 3;
    } else {
      // 注意：`+` 按 RFC3986 就是字面加号，不当空格处理。
      // 我们把真加号编成 %2B，所以这里没有歧义。
      out.push(bytes[i]);
      i += 1;
    }
  }
  try {
    return { ok: true, value: new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(out)) };
  } catch (e) {
    return { ok: false, reason: `转义后不是合法 UTF-8: ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ *
 * 校验
 * ------------------------------------------------------------------ */

/**
 * 这层校验不是洁癖：product 会拿去和 manifest 的 key 比对、也进日志；
 * 允许它带 `/` `.` 就等于允许深链伪造出 `z-biz-tool-../x` 这种让人误读的东西。
 */
function checkToken(what: string, v: string): DeepLinkResult<string> {
  if (v.length === 0) {
    return { ok: false, reason: `${what} 不能为空` };
  }
  if (v.length > 32) {
    return { ok: false, reason: `${what} 过长（${v.length} 字节）: ${v}` };
  }
  for (const b of new TextEncoder().encode(v)) {
    const c = String.fromCharCode(b);
    const ok =
      (b >= 0x41 && b <= 0x5a) ||
      (b >= 0x61 && b <= 0x7a) ||
      (b >= 0x30 && b <= 0x39) ||
      c === "-" ||
      c === "_";
    if (!ok) {
      return { ok: false, reason: `${what} 只允许字母/数字/-/_，实际: ${v}` };
    }
  }
  return { ok: true, value: v };
}

/**
 * 控制字符（含 \0 \n \r）一律拒绝：它们会被原样带进 argv 和日志，
 * 日志里多一行伪造记录、或让某些调用方截断参数。
 */
function checkValue(v: string): DeepLinkResult<string> {
  for (const c of v) {
    const code = c.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return { ok: false, reason: `参数值含控制字符 ${JSON.stringify(c)}` };
    }
  }
  return { ok: true, value: v };
}

/* ------------------------------------------------------------------ *
 * 构造
 * ------------------------------------------------------------------ */

/**
 * 构造深链。
 *
 * params 按 key 排序输出，所以同样的输入永远得到同一串字节 ——
 * 单测可以拿整串做金标，而不必逐字段比。
 */
export function buildDeepLink(
  product: string,
  action: string,
  params: Record<string, string> = {},
): DeepLinkResult<string> {
  const p = checkToken("product", product);
  if (!p.ok) return p;
  const a = checkToken("action", action);
  if (!a.ok) return a;

  const keys = Object.keys(params).sort();
  let out = `${ZBIZ_SCHEME}${product}/${action}`;
  let sep = "?";
  for (const k of keys) {
    const key = checkToken("参数名", k);
    if (!key.ok) return key;
    const val = checkValue(params[k]);
    if (!val.ok) return val;
    out += sep;
    sep = "&";
    out += `${k}=${encodeValue(params[k])}`;
  }
  return { ok: true, value: out };
}

/* ------------------------------------------------------------------ *
 * 解析
 * ------------------------------------------------------------------ */

/**
 * 解析深链。action 缺省为 `open`（`zbiz://note?file=x` 合法）。
 */
export function parseDeepLink(uri: string): DeepLinkResult<Handoff> {
  if (!uri.startsWith(ZBIZ_SCHEME)) {
    return { ok: false, reason: `不是 zbiz:// 深链: ${uri}` };
  }
  const rest = uri.slice(ZBIZ_SCHEME.length);

  // product 的边界是 `/` **或** `?`。
  // 只找 `/` 会把 `zbiz://note?file=/tmp/a.md` 那个路径里的斜杠当成 action 分隔符，
  // 于是 product 被读成 "note?file=" —— 这个坑是 handoff.rs 的
  // `action_defaults_to_open` 这条测出来的。
  const end = rest.search(/[/]/);
  const qEnd = rest.indexOf("?");
  let productEnd: number;
  if (end === -1 && qEnd === -1) productEnd = rest.length;
  else if (end === -1) productEnd = qEnd;
  else if (qEnd === -1) productEnd = end;
  else productEnd = Math.min(end, qEnd);

  const product = rest.slice(0, productEnd);
  const p = checkToken("product", product);
  if (!p.ok) return p;

  let after = rest.slice(productEnd);
  if (after.startsWith("/")) after = after.slice(1);

  const qIdx = after.indexOf("?");
  let action: string;
  let query: string;
  if (qIdx === -1) {
    action = after;
    query = "";
  } else {
    action = after.slice(0, qIdx);
    query = after.slice(qIdx + 1);
  }
  if (action.length === 0) action = DEFAULT_ACTION;
  const a = checkToken("action", action);
  if (!a.ok) return a;

  const params: Record<string, string> = {};
  for (const pair of query.split("&").filter((x) => x.length > 0)) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      return { ok: false, reason: `参数缺少 '=': ${pair}` };
    }
    const k = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);
    const key = checkToken("参数名", k);
    if (!key.ok) return key;
    if (Object.prototype.hasOwnProperty.call(params, k)) {
      return { ok: false, reason: `参数重复: ${k}` };
    }
    const decoded = decodeValue(raw);
    if (!decoded.ok) return decoded;
    params[k] = decoded.value;
  }

  return { ok: true, value: { product, action, params } };
}

/**
 * 从 argv 里挑出深链。混在里面的 exe 路径、`-psn_0_1` 之类直接忽略。
 */
export function deepLinksFromArgs(args: readonly string[]): Handoff[] {
  const out: Handoff[] = [];
  for (const a of args) {
    if (!a.startsWith(ZBIZ_SCHEME)) continue;
    const r = parseDeepLink(a);
    if (r.ok) {
      out.push(r.value);
    }
    // 用户手上没有日志可看，调用方应把失败原因打进日志
  }
  return out;
}
