/**
 * zBiz 家族统一 SSO 的 **Tauri 适配层**。
 *
 * ## 分层（与 deepLink 的三层同构）
 *
 * | 层 | 位置 | 管什么 |
 * |---|------|--------|
 * | 协议流程 | `oauth.ts` | 授权码 + PKCE + state 校验（纯逻辑，依赖全注入） |
 * | **IO 胶水** | **cap-sso（Rust）** | 回环服务器 / 开浏览器 / OS 密钥库 |
 * | **本层** | **`sso/tauriAdapter.ts`** | 把 Tauri 的 invoke 包成 `SsoEnvironment` |
 *
 * ## 为什么适配层在共享层、而不是各仓各写一遍
 *
 * 各仓若各写一遍 Tauri 适配，必然各写错一遍 —— 而 SSO 的坑集中在细节上：
 * PKCE 的 base64url 必须按**字节**算（`atob` 会把中文解成乱码）、
 * 回环端口要内核分配（配置里写死的端口被占用就登录不了）、
 * token 只能进密钥库不能进 localStorage。
 *
 * 这些错一旦漏出去，表现为「用户点了登录、浏览器开了、然后莫名其妙失败」，
 * 而且**很难从报错看出根因**。
 *
 * ## 为什么不直接 import `@tauri-apps/api`
 *
 * 共享层要在 node 单测里跑，也要能被浏览器预览复用。直接 import Tauri 会：
 * - 让 node 单测 import 即抛（`@tauri-apps/api/core` 在 node 下没有 IPC）；
 * - 把「一份实现」变成一堆 `if (isTauri)` 分支。
 *
 * 所以这里**依赖靠注入**（与 `protocol/deeplinkReceiver.ts` 同一范式）：
 * 调用方把 `invoke` 传进来，我们只负责组装。
 *
 * ## 用法
 *
 * ```ts
 * import { invoke } from "@tauri-apps/api/core";
 * import { createTauriSsoEnvironment, startSsoLogin } from "z-biz-tool-shared/sso/tauri";
 *
 * const port = await invoke<number>("sso_start_callback");
 * const env = createTauriSsoEnvironment(port, invoke);
 * const result = await startSsoLogin(config, env);
 * ```
 */

import type { SsoConfig, SsoSession, SsoResult } from "../sso/types";
import {
  authorizeWithSso,
  missingSsoConfigFields,
  type SsoEnvironment,
} from "../sso/oauth";
import { SsoSessionStore, type SecureStore } from "../sso/session";

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/**
 * Tauri 的 `invoke` —— 只声明我们用到的那部分签名。
 *
 * 不 import `@tauri-apps/api` 的类型，是为了让本模块在 node 单测里可编译；
 * 调用方的真实 `invoke` 结构兼容这个签名。
 */
export type TauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

/**
 * 服务端下发的 SSO 配置（不含 `redirectUri` —— 那由客户端自己拼）。
 *
 * 字段与 remote 服务端的 `GET /api/sso/config` 响应一一对应。
 */
export interface SsoServerConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  clientId: string;
  scope: string;
}

/* ------------------------------------------------------------------ *
 * 配置拉取
 * ------------------------------------------------------------------ */

/**
 * 拉取服务端的 SSO 配置。
 *
 * 返回 `null` 表示服务端没启用 SSO —— **不是错误**，
 * 调用方据此决定「不显示入口」。
 *
 * ## 为什么每一层失败都当「没启用」
 *
 * 地址写错、服务端没起来、返回的不是 JSON、缺字段 —— 四种情况的共同后果都是
 * 「SSO 用不了」。若把它们当成错误抛给调用方，登录页上会出现一个用户看不懂的
 * 异常。SSO 是**可选**入口，它的配置探测不该有能力把登录页弄崩。
 *
 * 缺任何一项配置都当「没启用」—— **半套配置比没有配置更糟**：
 * 用户会看到入口、点了、然后在中途失败。
 */
export async function fetchSsoConfig(
  base: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SsoServerConfig | null> {
  let res: Response;
  try {
    res = await fetchImpl(`${base}/api/sso/config`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let text: string;
  try {
    text = await res.text();
  } catch {
    return null;
  }
  if (!text.trim()) return null;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;

  const c = json as Record<string, unknown>;
  const str = (k: string): string => (typeof c[k] === "string" ? (c[k] as string) : "");
  const authorizeUrl = str("authorizeUrl");
  const tokenUrl = str("tokenUrl");
  const clientId = str("clientId");
  const scope = str("scope");
  if (!authorizeUrl || !tokenUrl || !clientId || !scope) return null;

  return {
    authorizeUrl,
    tokenUrl,
    userInfoUrl: typeof c.userInfoUrl === "string" ? (c.userInfoUrl as string) : undefined,
    clientId,
    scope,
  };
}

/* ------------------------------------------------------------------ *
 * 环境适配
 * ------------------------------------------------------------------ */

/** 回环服务器的端口占位符。`{PORT}` 会被替换成实际监听的端口。 */
const REDIRECT_URI_TEMPLATE = "http://127.0.0.1:{PORT}/callback";

/**
 * 造一个跑在 Tauri 里的 `SsoEnvironment`。
 *
 * `port` 必须是**这轮登录已经绑定的**端口 —— 拼出来的 `redirectUri`
 * 要和实际监听的一致，否则浏览器回调会连到没人接的端口。
 */
export function createTauriSsoEnvironment(
  port: number,
  invoke: TauriInvoke,
): SsoEnvironment & { redirectUri: string } {
  const redirectUri = REDIRECT_URI_TEMPLATE.replace("{PORT}", String(port));

  const env: SsoEnvironment & { redirectUri: string } = {
    redirectUri,

    startCallbackServer: async () => {
      // 端口已经在「起服务」那一步绑好了，这里只给一个视图：
      // `SsoEnvironment` 的形状要求「起服务」返回句柄，而实际的起服务
      // 必须发生在拿端口之前（顺序是 OAuth 决定的，调不过来）。
      return {
        port,
        waitForCallback: async () => {
          // 这条命令会阻塞到浏览器回调 / 超时 / 取消 —— 前端不 await 它去阻塞 UI。
          return await invoke<string>("sso_wait_callback");
        },
        close: async () => {
          await invoke<void>("sso_cancel_callback");
        },
      };
    },

    openBrowser: async (url: string) => {
      await invoke<void>("sso_open_browser", { url });
    },

    fetch: async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      const res = await fetch(url, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
      });
      return {
        ok: res.ok,
        status: res.status,
        text: async () => await res.text(),
      };
    },

    random: (bytes: number): string => {
      const buf = new Uint8Array(bytes);
      crypto.getRandomValues(buf);
      // 逐字节转成 latin1 字符串 —— 下游 createCodeVerifier 用
      // `charCodeAt(i) & 0xff` 取回原始字节，往返无损。
      let s = "";
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return s;
    },

    sha256Base64Url: async (text: string): Promise<string> => {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return bytesToBase64Url(new Uint8Array(digest));
    },
  };

  return env;
}

/**
 * 字节串 → base64url（无填充）。
 *
 * **不能用 `btoa` 直接转字符串再替换**：PKCE 的 challenge 必须是对
 * verifier 的**字节**做 SHA-256 后再 base64url，中间任何一次有损编码
 * （比如 UTF-8 往返）都会让 ctc 侧算出不同的 challenge，然后以
 * `invalid_grant` 拒掉 —— 那个报错完全看不出根因。
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  // 注意：这里必须按**字节**取，不能用 `bytes.charCodeAt(i)` ——
  // `charCodeAt` 是 String 的方法，Uint8Array 上不存在，调用即抛 TypeError。
  // （`Uint8Array` 的元素本身就是字节值，直接下标取。）
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

/**
 * 起一轮登录：绑端口 → 开浏览器 → 等回调 → 换 token → 取身份。
 *
 * 绑端口单独抽出来，是因为 `redirectUri` 必须在跳浏览器**之前**就定下来，
 * 而它的端口又要先于授权页存在 —— 这个顺序只有把「绑端口」提前才成立。
 */
export async function startSsoLogin(
  config: SsoServerConfig,
  invoke: TauriInvoke,
): Promise<SsoResult<SsoSession>> {
  // ── 先自检配置，再绑端口 ──────────────────────────────────────────
  //
  // 顺序不能反。`redirectUri` 的端口要先于授权页存在（OAuth 的硬约束），
  // 所以「绑端口」必须发生在流程最前面；但如果**先绑端口再发现配置不全**，
  // 那个端口就泄漏了 —— 用户第二次登录会撞「端口被占用」。
  //
  // 判据用协议层那一份（`missingSsoConfigFields`），不在这儿手抄清单：
  // 手抄的两份必然漂移，协议层加一个必填项就漏了。
  //
  // 这里查的字段不含 `redirectUri` —— 它还没拼（要等端口出来才有）。
  const missing = missingSsoConfigFields(config, false);
  if (missing.length > 0) {
    return {
      ok: false,
      code: "config",
      reason: `SSO 配置不完整，缺少：${missing.join("、")}`,
    };
  }

  // 绑端口、拿实际端口，再去走流程。
  const port = await invoke<number>("sso_start_callback");
  const env = createTauriSsoEnvironment(port, invoke);
  const full: SsoConfig = { ...config, redirectUri: env.redirectUri };
  return await authorizeWithSso(full, env);
}

/* ------------------------------------------------------------------ *
 * 会话存储桥接
 * ------------------------------------------------------------------ */

/**
 * 把 cap-sso 的密钥库命令包成 `SecureStore`。
 *
 * cap-sso 那层把整个会话当成**一条**密钥库条目（account = `sso.tokens`）存，
 * 而 `SsoSessionStore` 也只用一个 key。所以这里直接透传 ——
 * 不做 key 到 account 的映射，那只会引入「读到一半」的中间态。
 *
 * ## 为什么 delete 不先读再判断
 *
 * 「有没有」这件事已经由后端处理了。这里再读一遍，就是拿一个
 * **可能已经过期的中间结果**去判断 —— 用户刚在另一处登出时，
 * 这次读到的是旧状态，于是「删不掉」。
 */
export function createTauriSecureStore(invoke: TauriInvoke): SecureStore {
  return {
    get: async () => {
      const raw = await invoke<string | null>("sso_get_tokens");
      return raw ?? null;
    },
    set: async (_key, value) => {
      await invoke<void>("sso_set_tokens", { value });
    },
    delete: async () => {
      await invoke<void>("sso_clear_tokens");
    },
  };
}

/**
 * 造一个跑在 Tauri 里的 SSO 会话存储。
 *
 * token 进密钥库，展示信息进 localStorage。
 *
 * **别显式传 `localStorage`**：那会在 import 时就求值，而单测跑在 node 里，
 * 那里没有 localStorage —— 模块加载即抛，整个测试文件进不来。
 * `SsoSessionStore` 自己会探测并在缺失时回退成空实现，WebView 里它必然存在。
 */
export function createTauriSsoSessionStore(invoke: TauriInvoke): SsoSessionStore {
  return new SsoSessionStore(createTauriSecureStore(invoke));
}

/** 探测密钥库是否可用。不可用时前端不该显示 SSO 入口。 */
export async function secureStoreAvailable(invoke: TauriInvoke): Promise<boolean> {
  try {
    return await invoke<boolean>("sso_secure_store_available");
  } catch {
    return false;
  }
}
