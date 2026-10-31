/**
 * zBiz 家族统一 SSO（ctc 侧）的 **OAuth2 / OIDC 授权码流程**。
 *
 * ## 流程
 *
 * ```text
 * ┌──────────┐  1.占本地端口   ┌──────────────┐
 * │  桌面应用  │ ──────────────→ │  本地回环服务  │
 * └──────────┘                  └──────────────┘
 *      │                                │
 *      │ 2.跳浏览器 → ctc 授权页          │ 5.浏览器带 code 回调
 *      ↓                                ↓
 * ┌──────────┐                  ┌──────────────┐
 * │ ctc 授权页 │ ─── 6.code ───→ │  本地回环服务  │
 * └──────────┘                  └──────────────┘
 *      │                                │
 *      │ 3.用户登录并同意              │ 4.用 code + PKCE 换 token
 *      ↓                                ↓
 * ┌──────────┐                  ┌──────────────┐
 * │  账号页   │                  │   ctc 授权服务器 │
 * └──────────┘                  └──────────────┘
 *                                       │
 *                       7.拿 userinfo（可选）
 *                                       ↓
 *                              ┌────────────────┐
 *                              │  身份 + token   │
 *                              └────────────────┘
 * ```
 *
 * ## 全部依赖靠注入
 *
 * 本模块**不 import Tauri、不 import React、不碰文件系统**。理由：
 * - 它要能在 node 单测里跑（浏览器跳转、回环服务器、token 交换都能用假实现测）；
 * - 它要能被浏览器预览（web 版）复用，那边没有 Tauri 的 opener 插件。
 *
 * 所以开浏览器、开本地服务、发 HTTP 请求这三件事都是注入进来的。
 */

/* ------------------------------------------------------------------ *
 * 依赖注入
 * ------------------------------------------------------------------ */

import type { SsoConfig, SsoResult, SsoSession, SsoUser } from "./types";

/**
 * 本地回环服务的句柄。
 *
 * `port` 是实际绑定的端口 —— 授权前必须先知道它，否则拼出来的
 * `redirect_uri` 与 ctc 侧登记的不一致，会拿到 `redirect_uri_mismatch`。
 */
export interface LocalCallbackServer {
  /** 实际监听的端口。 */
  port: number;
  /**
   * 等浏览器回调。
   *
   * resolve 的值是**回调的查询串**（不含 `?`）—— 解析成 code/error 是调用方的责任，
   * 这样「解析出 error 而不是 code」这件事在测试里能被直接观察到。
   *
   * 用户点了「拒绝授权」时，浏览器仍会回调（带 `error=access_denied`），
   * 所以这里**不是**异常路径，是正常结果的一部分。
   */
  waitForCallback: () => Promise<string>;
  /** 关闭服务。 */
  close: () => Promise<void>;
}

/**
 * SSO 的运行环境（全部注入）。
 */
export interface SsoEnvironment {
  /**
   * 启动本地回环 HTTP 服务，等待浏览器回调。
   *
   * @param redirectPath 回环服务要处理的路径（通常是 `/callback`）
   */
  startCallbackServer: (redirectPath: string) => Promise<LocalCallbackServer>;

  /** 用系统默认浏览器打开授权页。 */
  openBrowser: (url: string) => Promise<void>;

  /** 发 HTTP 请求（拿 token、拉 userinfo）。 */
  fetch: (
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    },
  ) => Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
  }>;

  /** 生成随机串（state / code_verifier / nonce）。 */
  random: (bytes: number) => string;

  /** 计算 SHA-256 的 base64url 编码（PKCE 的 S256 challenge）。 */
  sha256Base64Url: (text: string) => Promise<string>;
}

/* ------------------------------------------------------------------ *
 * PKCE
 * ------------------------------------------------------------------ */

/**
 * PKCE 的 code_verifier 字符集。
 *
 * RFC 7636 规定是 `A-Z a-z 0-9 - . _ ~`，共 66 个字符。
 * 字符集外的字符在某些 ctc 实现里会被拒（或者被悄悄改写，导致 challenge 对不上）。
 */
const VERIFIER_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * 生成 PKCE 的 code_verifier。
 *
 * 长度取 64 个字符（RFC 7636 允许 43–128）。取 64 而不是最短的 43：
 * base64url 的熵在去掉 `=` 填充后每字符不到 6 bit，43 字符约 258 bit，
 * 64 字符约 384 bit —— 都够，但 64 让「随机串长度」这个参数一眼可读。
 */
export function createCodeVerifier(random: (bytes: number) => string): string {
  // 每字节能出 2 个 base64 字符，32 字节 → 64 字符。
  const raw = random(32);
  let out = "";
  for (let i = 0; i < 32; i++) {
    const b = raw.charCodeAt(i) & 0xff;
    out += VERIFIER_CHARS[b % VERIFIER_CHARS.length];
    out += VERIFIER_CHARS[(b >> 4) % VERIFIER_CHARS.length];
  }
  return out;
}

/**
 * 由 code_verifier 算 PKCE 的 code_challenge（S256）。
 *
 * `S256` 而不是 `plain` —— plain 的 challenge 就是 verifier 本身，
 * 等于没有保护。ctc 若只支持 plain，本函数要显式报错而不是悄悄降级。
 */
export async function createCodeChallenge(
  verifier: string,
  sha256Base64Url: (text: string) => Promise<string>,
): Promise<string> {
  return sha256Base64Url(verifier);
}

/* ------------------------------------------------------------------ *
 * URL 构造
 * ------------------------------------------------------------------ */

/**
 * 挑出配置里缺失/空白的必填项。
 *
 * **这是「配置是否完整」的唯一判据** —— `authorizeWithSso` 和各仓的适配层
 * 都调它。若适配层自己手抄一份清单，两边必然漂移：协议层新加一个必填项，
 * 适配层那份不会跟着改，于是「端口先绑了、然后才发现配置不全」——
 * 端口泄漏，用户第二次登录撞「端口被占用」。
 *
 * @param requireRedirectUri 是否把 `redirectUri` 也算作必填。
 *   适配层在**还没**拼 redirectUri 之前自检 ⇒ 传 false；
 *   协议层最终自检 ⇒ 传 true。
 */
export function missingSsoConfigFields(
  config: Partial<SsoConfig>,
  requireRedirectUri = true,
): string[] {
  const required = (
    ["authorizeUrl", "tokenUrl", "clientId", "scope"] as ReadonlyArray<keyof SsoConfig>
  ).filter((k) => !config[k] || !String(config[k]).trim());
  const missing: string[] = [...required];
  if (requireRedirectUri && (!config.redirectUri || !String(config.redirectUri).trim())) {
    missing.push("redirectUri");
  }
  return missing;
}

/**
 * 拼授权 URL。
 *
 * 参数顺序固定（`response_type` / `client_id` / `redirect_uri` / `scope` / `state` /
 * `code_challenge` / `code_challenge_method`），这样同一份输入永远得到同一串字节 ——
 * 单测可以拿整串做金标，出问题时也能直接贴给 ctc 侧看。
 */
export function buildAuthorizeUrl(
  config: SsoConfig,
  params: { state: string; codeChallenge: string | null },
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", params.state);
  if (params.codeChallenge) {
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

/* ------------------------------------------------------------------ *
 * 响应解析
 * ------------------------------------------------------------------ */

/**
 * 从授权回调的查询串里取出 code / error。
 *
 * 放在独立函数里是因为「回调解析」是最容易被写成「只查 code 忘了查 error」的地方：
 * 用户在 ctc 页面点「拒绝授权」时，回调里**没有 code**，只有 error。
 * 忘了查 error 的代码会一路走到换 token 才失败，报出来的是一句
 * 「invalid_grant」—— 用户完全看不懂自己刚才干了什么。
 */
export function parseCallbackQuery(
  query: string,
): { ok: true; code: string; state: string | null } | { ok: false; error: string; description: string | null } {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);

  const error = params.get("error");
  if (error) {
    const description = params.get("error_description");
    return { ok: false, error, description };
  }

  const code = params.get("code");
  if (!code) {
    return { ok: false, error: "no_code", description: null };
  }

  return { ok: true, code, state: params.get("state") };
}

/* ------------------------------------------------------------------ *
 * token 交换
 * ------------------------------------------------------------------ */

/**
 * 用授权码换 token。
 *
 * 三个细节容易写错：
 * 1. `Content-Type` 必须是 `application/x-www-form-urlencoded`（不是 JSON）——
 *    这是 OAuth2 规范规定的，`application/json` 有的服务端会静默返回 200 + 空 body。
 * 2. `client_id` 要带上。桌面端没有 client_secret，但 client_id 仍需传递。
 * 3. PKCE 的 `code_verifier` 要带上，且必须与当初算 challenge 时用的那一个**完全一致**。
 */
export async function exchangeCodeForToken(
  config: SsoConfig,
  env: SsoEnvironment,
  params: { code: string; codeVerifier: string | null },
): Promise<SsoResult<{ accessToken: string; refreshToken: string | null; expiresAt: number | null; tokenType: string; idToken: string | null }>> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", params.code);
  body.set("redirect_uri", config.redirectUri);
  body.set("client_id", config.clientId);
  if (params.codeVerifier) body.set("code_verifier", params.codeVerifier);

  let res: Awaited<ReturnType<SsoEnvironment["fetch"]>>;
  try {
    res = await env.fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    return {
      ok: false,
      code: "network",
      reason: `连不上 ctc 的令牌服务：${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      code: "token",
      reason: describeTokenError(res.status, text),
    };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      code: "malformed",
      reason: "ctc 的令牌服务返回的不是 JSON",
    };
  }

  const accessToken = json.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    return {
      ok: false,
      code: "malformed",
      reason: "ctc 的令牌服务没有返回 access_token",
    };
  }

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : null;
  const idToken = typeof json.id_token === "string" ? json.id_token : null;

  return {
    ok: true,
    value: {
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
      tokenType: typeof json.token_type === "string" ? json.token_type : "Bearer",
      idToken,
    },
  };
}

/**
 * 把 token 端点的错误响应变成一句人能看懂的话。
 *
 * OAuth2 错误响应是 JSON（`{"error":"invalid_grant","error_description":"..."}`），
 * 但也有服务端返回 HTML 错误页或纯文本。逐个降级处理，
 * 最终兜底给出状态码 —— 至少能让排查的人有线索。
 */
export function describeTokenError(status: number, text: string): string {
  let detail = "";
  try {
    const json = JSON.parse(text) as { error?: string; error_description?: string };
    if (json.error_description) detail = json.error_description;
    else if (json.error) detail = json.error;
  } catch {
    // 不是 JSON：用正文的一小段当线索，但要截断（HTML 错误页可能很长）。
    const trimmed = text.trim().slice(0, 160);
    if (trimmed) detail = trimmed;
  }

  const base = `ctc 的令牌服务返回 HTTP ${status}`;
  if (!detail) return base;
  return `${base}：${detail}`;
}

/* ------------------------------------------------------------------ *
 * 用户信息
 * ------------------------------------------------------------------ */

/**
 * 解析 id_token 的 payload。
 *
 * **不解验签** —— id_token 的可信度由「它是通过 TLS 从 token 端点直接拿到的」保证，
 * 而非 token 端点返回的那段 payload 本身没被篡改（传输层已保真）。
 *
 * 这是 OIDC 的一个真实取舍：严格的实现应当验签（JWT 的 JWK 签名），
 * 但桌面端验签要引入 JWKS 拉取与缓存、密钥轮换处理 —— 复杂度与收益不匹配，
 * 因为 access_token 才是真正用于访问 API 的凭据，而 id_token 在本家族里
 * 只用于**显示用户名**（不是用于授权判定）。
 *
 * 若将来要用 id_token 做授权判定，**必须补验签**，这里已用注释钉住这一点。
 */
export function parseIdTokenPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1] as string;
    const bytes = base64UrlToBytes(payload);
    // **必须按 UTF-8 解**：`atob` 给的是 latin1 字符串，
    // 直接 JSON.parse 会把中文解成乱码（"李四" → "æ\x9D\x8Eå\x9B\x9B"）。
    // 真实 ctc 返回的 name 很可能就是中文 —— 这不是理论问题。
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * base64url → 字节数组。
 *
 * 不用 `atob`：`atob` 只处理 latin1，直接 `JSON.parse(atob(x))` 会把中文解成乱码
 * （"李四" → "æ\x9D\x8Eå\x9B\x9B"）。真实 ctc 返回的 name 很可能就是中文，
 * 所以这里自己按字节解，再用 TextDecoder 按 UTF-8 读。
 */
export function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  // 去掉尾部填充后算真实字节数：`=` 不携带数据，按 4 字符→3 字节会多算。
  const dataChars = normalized.length;
  const out = new Uint8Array(Math.floor((dataChars * 3) / 4));

  let o = 0;
  for (let i = 0; i < padded.length; i += 4) {
    const c0 = base64Value(padded.charCodeAt(i));
    const c1 = base64Value(padded.charCodeAt(i + 1));
    const c2 = base64Value(padded.charCodeAt(i + 2));
    const c3 = base64Value(padded.charCodeAt(i + 3));
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;

    if (o < out.length) out[o++] = (n >> 16) & 0xff;
    if (o < out.length) out[o++] = (n >> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

/** 单个 base64 字符的数值。非法字符（含填充 `=`）按 0 处理。 */
function base64Value(code: number): number {
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 71; // a-z → 26
  if (code >= 48 && code <= 57) return code + 4; // 0-9 → 52
  if (code === 43) return 62; // +
  if (code === 47) return 63; // /
  return 0;
}

/**
 * 把 userinfo / id_token 里的声明整理成统一的 `SsoUser`。
 */
export function toSsoUser(claims: Record<string, unknown>): SsoUser | null {
  const subject = claims.sub;
  if (typeof subject !== "string" || !subject) return null;

  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

  return {
    subject,
    displayName: str(claims.name) ?? str(claims.nickname) ?? str(claims.preferred_username),
    email: str(claims.email),
    username: str(claims.preferred_username) ?? str(claims.name),
    raw: claims,
  };
}

/**
 * 拉取 userinfo。
 *
 * 没有 `userInfoUrl` 时返回「不适用」而不是错误 —— 有些 ctc 部署只给 id_token。
 */
export async function fetchUserInfo(
  config: SsoConfig,
  env: SsoEnvironment,
  accessToken: string,
): Promise<SsoResult<Record<string, unknown> | null>> {
  if (!config.userInfoUrl) return { ok: true, value: null };

  let res: Awaited<ReturnType<SsoEnvironment["fetch"]>>;
  try {
    res = await env.fetch(config.userInfoUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    return {
      ok: false,
      code: "network",
      reason: `连不上 ctc 的用户信息服务：${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      code: "userinfo",
      reason: `ctc 的用户信息服务返回 HTTP ${res.status}`,
    };
  }

  try {
    const json = JSON.parse(text) as unknown;
    if (!json || typeof json !== "object") {
      return { ok: false, code: "malformed", reason: "ctc 的用户信息服务返回的不是对象" };
    }
    return { ok: true, value: json as Record<string, unknown> };
  } catch {
    return { ok: false, code: "malformed", reason: "ctc 的用户信息服务返回的不是 JSON" };
  }
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

/**
 * 走完整个授权码流程，拿到一次登录会话。
 *
 * @param config ctc 侧的接入配置
 * @param env 运行环境（浏览器 / 回环服务 / HTTP / 随机数 / SHA-256，全部注入）
 */
export async function authorizeWithSso(
  config: SsoConfig,
  env: SsoEnvironment,
): Promise<SsoResult<SsoSession>> {
  // ── 0. 配置自检：错在这里比错在后面省事得多 ──────────────────────
  const missing = missingSsoConfigFields(config, true);
  if (missing.length > 0) {
    return {
      ok: false,
      code: "config",
      reason: `SSO 配置不完整，缺少：${missing.join("、")}`,
    };
  }

  // ── 1. 生成 state 与 PKCE ─────────────────────────────────────────
  const state = env.random(16);
  const usePkce = config.pkce !== false;
  const codeVerifier = usePkce ? createCodeVerifier(env.random) : null;
  const codeChallenge = codeVerifier
    ? await createCodeChallenge(codeVerifier, env.sha256Base64Url)
    : null;

  // ── 2. 起本地回环服务（必须先于跳浏览器） ────────────────────────
  let server: LocalCallbackServer;
  try {
    server = await env.startCallbackServer("/callback");
  } catch (e) {
    return {
      ok: false,
      code: "local_server",
      reason: `起不来本地回调服务：${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    // ── 3. 跳浏览器 ────────────────────────────────────────────────
    const redirect = new URL(config.redirectUri);
    // 本地实际端口优先于配置里的端口 —— 配置里写死端口是为了和 ctc 侧登记一致，
    // 但真要靠「配置端口被占用就失败」，不如把实际端口回填进去（若配置未固定端口）。
    if (!redirect.port && server.port) redirect.port = String(server.port);
    const effectiveConfig: SsoConfig = { ...config, redirectUri: redirect.toString() };

    const authorizeUrl = buildAuthorizeUrl(effectiveConfig, { state, codeChallenge });
    try {
      await env.openBrowser(authorizeUrl);
    } catch (e) {
      return {
        ok: false,
        code: "browser",
        reason: `打不开浏览器：${e instanceof Error ? e.message : String(e)}`,
      };
    }

    // ── 4. 等回调 ──────────────────────────────────────────────────
    let query: string;
    try {
      query = await server.waitForCallback();
    } catch (e) {
      return {
        ok: false,
        code: "cancelled",
        reason: `登录已取消或回调失败：${e instanceof Error ? e.message : String(e)}`,
      };
    }

    const callback = parseCallbackQuery(query);
    if (!callback.ok) {
      // 用户点了「拒绝授权」是正常分支，不该报成「出错了」。
      const cancelled = callback.error === "access_denied";
      return {
        ok: false,
        code: cancelled ? "cancelled" : "authorization",
        reason: cancelled
          ? "你取消了授权"
          : `ctc 拒绝了这次授权：${callback.error}${callback.description ? `（${callback.description}）` : ""}`,
      };
    }

    // ── 5. 校验 state（防 CSRF） ───────────────────────────────────
    if (callback.state !== state) {
      return {
        ok: false,
        code: "authorization",
        reason: "登录回调的 state 对不上，已拒绝（可能是被伪造的回调）",
      };
    }

    // ── 6. 换 token ───────────────────────────────────────────────
    const token = await exchangeCodeForToken(effectiveConfig, env, {
      code: callback.code,
      codeVerifier,
    });
    if (!token.ok) return token;

    // ── 7. 取身份：userinfo 优先，退回 id_token ────────────────────
    const info = await fetchUserInfo(effectiveConfig, env, token.value.accessToken);
    if (!info.ok) return info;

    let claims: Record<string, unknown> | null = info.value;
    if (!claims && token.value.idToken) {
      claims = parseIdTokenPayload(token.value.idToken);
    }

    const requireIdToken = config.requireIdToken !== false;
    if (requireIdToken && !claims) {
      return {
        ok: false,
        code: "malformed",
        reason: "没能从 ctc 拿到用户身份（userinfo 为空且 id_token 不可解析）",
      };
    }

    const user = toSsoUser(claims ?? {});
    if (!user) {
      return {
        ok: false,
        code: "malformed",
        reason: "ctc 返回的用户身份里没有 sub（用户唯一标识）",
      };
    }

    return {
      ok: true,
      value: {
        accessToken: token.value.accessToken,
        refreshToken: token.value.refreshToken,
        expiresAt: token.value.expiresAt,
        tokenType: token.value.tokenType,
        user,
      },
    };
  } finally {
    // 无论成败都要关掉回环服务 —— 否则端口一直被占着，
    // 用户第二次登录会拿到「端口被占用」。
    await server.close().catch(() => undefined);
  }
}

/**
 * 等浏览器回调。
 *
 * 这个函数的实际等待由注入的 `startCallbackServer` 承担 ——
 * 它返回一个 promise，在浏览器回调到达时 resolve。
 * 这里只是把类型定下来。
 */
export type CallbackWaiter = (
  server: LocalCallbackServer,
) => Promise<
  | { ok: true; code: string; state: string | null }
  | { ok: false; code: "cancelled" | "local_server"; reason: string }
>;
