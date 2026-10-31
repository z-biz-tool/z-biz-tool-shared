// zBiz 家族统一 SSO（ctc 侧）的单元测试（无浏览器、无真实网络、无真实端口）。
// 跑法：node --experimental-strip-types --import ./tests/register-ts-ext.mjs --test tests/sso.test.ts
//
// **不发真实请求、不起真实端口**：回环服务器、浏览器、HTTP 全部是注入的桩。
// 桩会记录收到的 URL / headers / body，断言的是「真的按 OAuth2 规范发了」，
// 而不是只看最终结果 —— 后者分不出「走了真分支」和「静默降级」。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizeWithSso,
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  describeTokenError,
  exchangeCodeForToken,
  parseCallbackQuery,
  parseIdTokenPayload,
  toSsoUser,
  type LocalCallbackServer,
  type SsoConfig,
  type SsoEnvironment,
} from "../src/sso/oauth.ts";
import { SsoSessionStore, type SecureStore } from "../src/sso/session.ts";

/* ------------------------------------------------------------------ *
 * 测试用的固定配置
 * ------------------------------------------------------------------ */

const CONFIG: SsoConfig = {
  authorizeUrl: "https://ctc.example.com/oauth2/authorize",
  tokenUrl: "https://ctc.example.com/oauth2/token",
  userInfoUrl: "https://ctc.example.com/oauth2/userinfo",
  clientId: "z-biz-tool-remote",
  scope: "openid profile email",
  redirectUri: "http://127.0.0.1:7823/callback",
};

/* ------------------------------------------------------------------ *
 * 桩
 * ------------------------------------------------------------------ */

/** 记录一次 HTTP 请求。 */
interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/** 可编程的 fetch 桩。 */
function stubFetch(
  responses: Array<{ ok?: boolean; status?: number; text: string }>
): { fetch: SsoEnvironment["fetch"]; calls: Recorded[] } {
  const calls: Recorded[] = [];
  let i = 0;
  const impl: SsoEnvironment["fetch"] = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      text: async () => r.text,
    };
  };
  return { fetch: impl, calls };
}

/** 内存版安全存储。 */
function memorySecureStore(): SecureStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      data.set(k, v);
    },
    delete: async (k) => {
      data.delete(k);
    },
  };
}

/** 内存版 profile 存储。 */
function memoryProfileStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

/**
 * 造一个完整的运行环境。
 *
 * `callbackQuery` 里如果含 `{STATE}` 占位符，会被替换成本次随机桩真实生成的那个 state ——
 * 否则「state 对不上」是**测试自己写错**（桩是确定性的，硬编码一个值必然对不上）。
 */
function makeEnv(options: {
  callbackQuery: string;
  tokenResponse?: { ok?: boolean; status?: number; text: string };
  userInfoResponse?: { ok?: boolean; status?: number; text: string };
  openBrowserError?: Error;
  serverError?: Error;
}): {
  env: SsoEnvironment;
  opened: string[];
  calls: Recorded[];
  closed: boolean[];
} {
  const opened: string[] = [];
  const calls: Recorded[] = [];
  const closed: boolean[] = [];

  const { fetch: fetchImpl, calls: fetchCalls } = stubFetch([
    options.tokenResponse ?? {
      text: JSON.stringify({
        access_token: "AT-1",
        refresh_token: "RT-1",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    },
    options.userInfoResponse ?? {
      text: JSON.stringify({ sub: "u-1", name: "张三", email: "z@ctc.example.com" }),
    },
  ]);

  // 随机桩：按「字节数」确定性生成 —— 同样的字节数永远得到同样的串。
  //
  // 为什么不用「调用计数器递增」：测试要先算出期望的 state 再跑主流程，
  // 那次预调会把计数器推前一位，主流程拿到的就是另一个值，state 必然对不上。
  // 按字节数取值则与调用顺序无关，state(16 字节) 与 verifier(32 字节) 天然不同。
  //
  // 「state 每次都不同」这个性质由桩破坏不了 —— 真实安全性靠的是随机源不重复，
  // 桩测不了这件事，测的是「state 被带上了并被校验」。
  const random = (bytes: number): string => {
    let s = "";
    for (let i = 0; i < bytes; i++) {
      s += String.fromCharCode(65 + (i % 26));
    }
    return s;
  };

  // state 是 random(16) 的结果 —— 与 authorizeWithSso 里的取值一致。
  const expectedState = random(16);

  const env: SsoEnvironment = {
    startCallbackServer: async (): Promise<LocalCallbackServer> => {
      if (options.serverError) throw options.serverError;
      return {
        port: 7823,
        waitForCallback: async () =>
          options.callbackQuery.replace("{STATE}", encodeURIComponent(expectedState)),
        close: async () => {
          closed.push(true);
        },
      };
    },
    openBrowser: async (url) => {
      if (options.openBrowserError) throw options.openBrowserError;
      opened.push(url);
    },
    fetch: async (url, init) => {
      const res = await fetchImpl(url, init);
      calls.push(...fetchCalls.splice(0));
      return res;
    },
    random,
    sha256Base64Url: async (text) => `challenge-of-${text}`,
  };

  return { env, opened, calls, closed };
}

/* ------------------------------------------------------------------ *
 * PKCE
 * ------------------------------------------------------------------ */

test("PKCE：code_verifier 只用 RFC 7636 允许的字符", () => {
  const v = createCodeVerifier((n) => "a".repeat(n));
  assert.match(v, /^[A-Za-z0-9\-._~]+$/);
  assert.equal(v.length, 64);
});

test("PKCE：verifier 长度在 RFC 7636 允许的 43–128 之间", () => {
  const v = createCodeVerifier(() => "x");
  assert.ok(v.length >= 43 && v.length <= 128, `长度 ${v.length} 不在 43–128`);
});

test("PKCE：challenge 由 verifier 算出（S256）", async () => {
  const c = await createCodeChallenge("verifier-1", async (t) => `sha(${t})`);
  assert.equal(c, "sha(verifier-1)");
});

/* ------------------------------------------------------------------ *
 * 授权 URL
 * ------------------------------------------------------------------ */

test("授权 URL 带齐 OAuth2 必需参数", () => {
  const url = new URL(
    buildAuthorizeUrl(CONFIG, { state: "STATE-1", codeChallenge: "CHAL-1" })
  );
  assert.equal(url.origin + url.pathname, "https://ctc.example.com/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "z-biz-tool-remote");
  assert.equal(url.searchParams.get("redirect_uri"), CONFIG.redirectUri);
  assert.equal(url.searchParams.get("scope"), "openid profile email");
  assert.equal(url.searchParams.get("state"), "STATE-1");
  assert.equal(url.searchParams.get("code_challenge"), "CHAL-1");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("授权 URL：不带 PKCE 时不出现 code_challenge 参数", () => {
  const url = new URL(buildAuthorizeUrl(CONFIG, { state: "S", codeChallenge: null }));
  assert.equal(url.searchParams.get("code_challenge"), null);
  assert.equal(url.searchParams.get("code_challenge_method"), null);
});

/* ------------------------------------------------------------------ *
 * 回调解析
 * ------------------------------------------------------------------ */

test("回调解析：正常回调取出 code 与 state", () => {
  const r = parseCallbackQuery("?code=CODE-1&state=STATE-1");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.code, "CODE-1");
  assert.equal(r.state, "STATE-1");
});

test("回调解析：用户拒绝授权时给出 error 而不是「没有 code」", () => {
  const r = parseCallbackQuery("?error=access_denied&error_description=%E7%94%A8%E6%88%B7%E6%8B%92%E7%BB%9D");
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "access_denied");
  assert.equal(r.description, "用户拒绝");
});

test("回调解析：既没 code 也没 error 时报 no_code", () => {
  const r = parseCallbackQuery("?foo=bar");
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "no_code");
});

/* ------------------------------------------------------------------ *
 * token 交换
 * ------------------------------------------------------------------ */

test("token 交换：用表单格式而不是 JSON", async () => {
  const { fetch: f, calls } = stubFetch([
    { text: JSON.stringify({ access_token: "AT", token_type: "Bearer" }) },
  ]);
  const r = await exchangeCodeForToken(CONFIG, { ...makeEnv({ callbackQuery: "" }).env, fetch: f }, {
    code: "C1",
    codeVerifier: "V1",
  });
  assert.equal(r.ok, true);
  assert.equal(calls[0]!.headers["Content-Type"], "application/x-www-form-urlencoded");
  const body = new URLSearchParams(calls[0]!.body ?? "");
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code"), "C1");
  assert.equal(body.get("client_id"), CONFIG.clientId);
  assert.equal(body.get("code_verifier"), "V1");
  assert.equal(body.get("redirect_uri"), CONFIG.redirectUri);
});

test("token 交换：服务端报错时给出可读原因（含 error_description）", async () => {
  const { fetch: f } = stubFetch([
    {
      ok: false,
      status: 400,
      text: JSON.stringify({
        error: "invalid_grant",
        error_description: "授权码已被使用",
      }),
    },
  ]);
  const r = await exchangeCodeForToken(CONFIG, { ...makeEnv({ callbackQuery: "" }).env, fetch: f }, {
    code: "C1",
    codeVerifier: null,
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "token");
  assert.match(r.reason, /授权码已被使用/);
});

test("token 交换：响应不是 JSON 时如实报 malformed", async () => {
  const { fetch: f } = stubFetch([{ text: "<html>502</html>" }]);
  const r = await exchangeCodeForToken(CONFIG, { ...makeEnv({ callbackQuery: "" }).env, fetch: f }, {
    code: "C1",
    codeVerifier: null,
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "malformed");
});

test("token 交换：缺 access_token 时报错而不是给空串", async () => {
  const { fetch: f } = stubFetch([{ text: JSON.stringify({ token_type: "Bearer" }) }]);
  const r = await exchangeCodeForToken(CONFIG, { ...makeEnv({ callbackQuery: "" }).env, fetch: f }, {
    code: "C1",
    codeVerifier: null,
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "malformed");
  assert.match(r.reason, /access_token/);
});

test("token 端点错误描述：非 JSON 时截断正文，不无限长", () => {
  const long = "x".repeat(1000);
  const reason = describeTokenError(502, long);
  assert.match(reason, /502/);
  assert.ok(reason.length < 300, `描述过长：${reason.length}`);
});

/* ------------------------------------------------------------------ *
 * 身份解析
 * ------------------------------------------------------------------ */

test("id_token payload 能解出声明", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "u-1", name: "李四" })).toString("base64url");
  const claims = parseIdTokenPayload(`h.${payload}.s`);
  assert.equal(claims?.sub, "u-1");
  assert.equal(claims?.name, "李四");
});

test("id_token 不是合法 JWT 时返回 null 而不是抛错", () => {
  assert.equal(parseIdTokenPayload("not-a-jwt"), null);
  assert.equal(parseIdTokenPayload("a.!!!not-base64!!!.c"), null);
});

test("用户身份：sub 必填，其余可选", () => {
  const u = toSsoUser({ sub: "u-1" });
  assert.equal(u?.subject, "u-1");
  assert.equal(u?.displayName, null);
  assert.equal(u?.email, null);
});

test("用户身份：没有 sub 时返回 null（无法标识用户）", () => {
  assert.equal(toSsoUser({ name: "张三" }), null);
});

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

test("主流程：走完授权 → 换 token → 取身份", async () => {
  const { env, opened, closed } = makeEnv({
    callbackQuery: "?code=CODE-1&state={STATE}",
  });
  const r = await authorizeWithSso(CONFIG, env);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.accessToken, "AT-1");
  assert.equal(r.value.refreshToken, "RT-1");
  assert.equal(r.value.user.subject, "u-1");
  assert.equal(r.value.user.displayName, "张三");
  assert.equal(opened.length, 1);
  assert.ok(opened[0]!.startsWith("https://ctc.example.com/oauth2/authorize?"));
  assert.equal(closed.length, 1, "回环服务必须被关掉");
});

test("主流程：配置不全时直接报 config，不去开浏览器", async () => {
  const { env, opened } = makeEnv({ callbackQuery: "" });
  const r = await authorizeWithSso({ ...CONFIG, clientId: "" }, env);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "config");
  assert.equal(opened.length, 0);
});

test("主流程：state 对不上时拒绝（防 CSRF）", async () => {
  const { env, closed } = makeEnv({
    callbackQuery: "?code=CODE-1&state=WRONG-STATE",
  });
  const r = await authorizeWithSso(CONFIG, env);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "authorization");
  assert.match(r.reason, /state/);
  assert.equal(closed.length, 1, "失败也要关回环服务");
});

test("主流程：用户拒绝授权时算 cancelled，不是「出错了」", async () => {
  const { env } = makeEnv({
    callbackQuery: "?error=access_denied&error_description=%E7%94%A8%E6%88%B7%E6%8B%92%E7%BB%9D",
  });
  const r = await authorizeWithSso(CONFIG, env);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "cancelled");
});

test("主流程：起不来回环服务时报 local_server", async () => {
  const { env, opened } = makeEnv({
    callbackQuery: "",
    serverError: new Error("端口被占用"),
  });
  const r = await authorizeWithSso(CONFIG, env);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "local_server");
  assert.equal(opened.length, 0, "起不来服务就不该跳浏览器");
});

test("主流程：打不开浏览器时报 browser", async () => {
  const { env } = makeEnv({
    callbackQuery: "",
    openBrowserError: new Error("没有默认浏览器"),
  });
  const r = await authorizeWithSso(CONFIG, env);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "browser");
});

test("主流程：没有 userinfo 时退回 id_token", async () => {
  const idPayload = Buffer.from(
    JSON.stringify({ sub: "u-9", preferred_username: "wangwu" })
  ).toString("base64url");
  const { fetch: f } = stubFetch([
    { text: JSON.stringify({ access_token: "AT", token_type: "Bearer", id_token: `h.${idPayload}.s` }) },
  ]);
  const { env } = makeEnv({ callbackQuery: "?code=C&state={STATE}" });
  const r = await authorizeWithSso(
    { ...CONFIG, userInfoUrl: undefined },
    { ...env, fetch: f }
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.user.subject, "u-9");
  assert.equal(r.value.user.username, "wangwu");
});

/* ------------------------------------------------------------------ *
 * 会话存储
 * ------------------------------------------------------------------ */

test("会话存储：token 进安全存储，展示信息进 profile 存储", async () => {
  const secure = memorySecureStore();
  const profile = memoryProfileStore();
  const store = new SsoSessionStore(secure, profile);

  await store.save({
    accessToken: "AT-secret",
    refreshToken: "RT-secret",
    expiresAt: 1_700_000_000_000,
    tokenType: "Bearer",
    user: { subject: "u-1", displayName: "张三", email: "z@x.com", username: "zs" },
  });

  assert.equal(secure.data.size, 1);
  assert.ok(secure.data.get("z-biz-tool.sso.tokens")!.includes("AT-secret"));
  // 展示信息里**不含** token
  const profileRaw = profile.data.get("z-biz-tool.sso.profile")!;
  assert.ok(!profileRaw.includes("AT-secret"));
  assert.ok(!profileRaw.includes("RT-secret"));
});

test("会话存储：读回登录态", async () => {
  const secure = memorySecureStore();
  const store = new SsoSessionStore(secure, memoryProfileStore());
  await store.save({
    accessToken: "AT",
    refreshToken: null,
    expiresAt: null,
    tokenType: "Bearer",
    user: { subject: "u-1", displayName: null, email: null, username: null },
  });
  const loaded = await store.load();
  assert.equal(loaded?.tokens.accessToken, "AT");
  assert.equal(loaded?.profile?.subject, "u-1");
});

test("会话存储：安全存储里没有 ⇒ 视为未登录（哪怕 profile 还在）", async () => {
  const secure = memorySecureStore();
  const profile = memoryProfileStore();
  profile.setItem("z-biz-tool.sso.profile", JSON.stringify({ subject: "u-1" }));
  const store = new SsoSessionStore(secure, profile);
  assert.equal(await store.load(), null);
});

test("会话存储：坏数据当未登录并清掉", async () => {
  const secure = memorySecureStore();
  await secure.set("z-biz-tool.sso.tokens", "{not json");
  const store = new SsoSessionStore(secure, memoryProfileStore());
  assert.equal(await store.load(), null);
  assert.equal(secure.data.get("z-biz-tool.sso.tokens"), undefined, "坏数据要被清掉");
});

test("会话存储：过期判定留 60 秒余量", () => {
  const now = 1_700_000_000_000;
  const tokens = { accessToken: "A", refreshToken: null, tokenType: "Bearer", expiresAt: now + 30_000 };
  assert.equal(SsoSessionStore.isExpired(tokens, 60_000, now), true, "30 秒后过期 ⇒ 提前判过期");
  const later = { ...tokens, expiresAt: now + 300_000 };
  assert.equal(SsoSessionStore.isExpired(later, 60_000, now), false);
  const forever = { ...tokens, expiresAt: null };
  assert.equal(SsoSessionStore.isExpired(forever, 60_000, now), false, "没有过期时间 = 长期有效");
});

test("会话存储：退出登录清掉两处", async () => {
  const secure = memorySecureStore();
  const profile = memoryProfileStore();
  const store = new SsoSessionStore(secure, profile);
  await store.save({
    accessToken: "AT",
    refreshToken: null,
    expiresAt: null,
    tokenType: "Bearer",
    user: { subject: "u-1", displayName: null, email: null, username: null },
  });
  await store.clear();
  assert.equal(await store.load(), null);
  assert.equal(profile.data.size, 0);
});
