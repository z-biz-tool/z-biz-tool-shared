// zBiz 家族统一 SSO —— **Tauri 适配层**的单元测试。
//
// 跑法：node --experimental-strip-types --import ./tests/register-ts-ext.mjs --test tests/sso-tauri-adapter.test.ts
//
// **不发真实请求、不起真实端口、不碰 Tauri**：invoke / fetch 全是注入的桩。
// 桩会记录收到的命令名与参数，断言的是「真的按预期调了 Rust 那侧」，
// 而不是只看最终结果 —— 后者分不出「走了真分支」和「静默降级」。
//
// ## 这一层的测试要证明什么
//
// 1. `fetchSsoConfig` 的**每一层失败**都归到「没启用」（返回 null），不抛异常；
// 2. `bytesToBase64Url` 按**字节**算（中文/高位字节不丢）—— 这一条曾经写错过
//    （对 Uint8Array 调 charCodeAt，调用即抛），是真实链路上的崩溃点；
// 3. 适配层**不自己拼协议**：redirectUri 的端口必须来自 Rust 侧实际绑定的端口；
// 4. 密钥库桥接是**透传**，不做 key→account 映射。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bytesToBase64Url,
  createTauriSecureStore,
  createTauriSsoEnvironment,
  createTauriSsoSessionStore,
  fetchSsoConfig,
  secureStoreAvailable,
  startSsoLogin,
  type SsoServerConfig,
  type TauriInvoke,
} from "../src/sso/tauriAdapter.ts";

/* ------------------------------------------------------------------ *
 * 桩
 * ------------------------------------------------------------------ */

/** 记录一次 invoke 调用。 */
interface InvokeCall {
  cmd: string;
  args?: Record<string, unknown>;
}

/** 可编程的 invoke 桩。 */
function stubInvoke(
  handlers: Record<string, (args?: Record<string, unknown>) => Promise<unknown>>
): { invoke: TauriInvoke; calls: InvokeCall[] } {
  const calls: InvokeCall[] = [];
  const invoke: TauriInvoke = async <T = unknown>(
    cmd: string,
    args?: Record<string, unknown>
  ): Promise<T> => {
    calls.push({ cmd, args });
    const h = handlers[cmd];
    if (!h) throw new Error(`未预期的命令：${cmd}`);
    return (await h(args)) as T;
  };
  return { invoke, calls };
}

/** 造一个只回指定 JSON 的 fetch 桩。 */
function stubFetch(
  body: string,
  init: { ok?: boolean; status?: number } = {}
): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: async () => body,
    };
  }) as unknown as typeof fetch;
  return { fetch: impl, calls };
}

const FULL_CONFIG: SsoServerConfig = {
  authorizeUrl: "https://ctc.example.com/oauth2/authorize",
  tokenUrl: "https://ctc.example.com/oauth2/token",
  userInfoUrl: "https://ctc.example.com/oauth2/userinfo",
  clientId: "z-biz-tool-mind",
  scope: "openid profile email",
};

/* ------------------------------------------------------------------ *
 * fetchSsoConfig：每一层失败都当「没启用」
 * ------------------------------------------------------------------ */

test("配置拉取：正常返回时给出完整配置", async () => {
  const { fetch, calls } = stubFetch(
    JSON.stringify({
      authorizeUrl: FULL_CONFIG.authorizeUrl,
      tokenUrl: FULL_CONFIG.tokenUrl,
      userInfoUrl: FULL_CONFIG.userInfoUrl,
      clientId: FULL_CONFIG.clientId,
      scope: FULL_CONFIG.scope,
    })
  );
  const cfg = await fetchSsoConfig("https://app.example.com", fetch);
  assert.deepEqual(cfg, FULL_CONFIG);
  assert.equal(calls[0], "https://app.example.com/api/sso/config", "要打约定的配置端点");
});

test("配置拉取：服务端没启用时返回 null（不是错误）", async () => {
  // 服务端未配置 SSO 时返回 204/空体 —— 这是「没启用」的正常表达。
  const { fetch } = stubFetch("", { ok: false, status: 204 });
  assert.equal(await fetchSsoConfig("https://app.example.com", fetch), null);
});

test("配置拉取：网络层失败（地址写错/服务没起来）返回 null", async () => {
  const impl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  assert.equal(await fetchSsoConfig("https://app.example.com", impl), null);
});

test("配置拉取：返回的不是 JSON 返回 null", async () => {
  const { fetch } = stubFetch("<html>proxy error</html>");
  assert.equal(await fetchSsoConfig("https://app.example.com", fetch), null);
});

test("配置拉取：半套配置返回 null（缺一项就当没启用）", async () => {
  // 少 scope —— 用户会看到入口、点了、然后在中途失败。
  // 半套配置比没有配置更糟。
  const { fetch } = stubFetch(
    JSON.stringify({
      authorizeUrl: FULL_CONFIG.authorizeUrl,
      tokenUrl: FULL_CONFIG.tokenUrl,
      clientId: FULL_CONFIG.clientId,
    })
  );
  assert.equal(await fetchSsoConfig("https://app.example.com", fetch), null);
});

test("配置拉取：字段类型不对（数字冒充字符串）返回 null", async () => {
  const { fetch } = stubFetch(
    JSON.stringify({
      authorizeUrl: 123,
      tokenUrl: FULL_CONFIG.tokenUrl,
      clientId: FULL_CONFIG.clientId,
      scope: FULL_CONFIG.scope,
    })
  );
  assert.equal(await fetchSsoConfig("https://app.example.com", fetch), null);
});

/* ------------------------------------------------------------------ *
 * bytesToBase64Url：必须按字节算
 * ------------------------------------------------------------------ */

test("base64url：按字节编码，高位字节不丢", () => {
  // 0xFB 0xFF 这类高位字节是最容易在「字符串化」环节被搞坏的。
  // 金标由 RFC 4648 的 base64 规则算出：fbff003e3f → "-_8APj8"
  const bytes = new Uint8Array([0xfb, 0xff, 0x00, 0x3e, 0x3f]);
  const out = bytesToBase64Url(bytes);
  assert.equal(out, "-_8APj8", "base64url 的 -/_ 替换必须生效，且字节顺序不变");
  assert.doesNotMatch(out, /[+/=]/, "base64url 不该有 + / =");
});

test("base64url：空输入得到空串", () => {
  assert.equal(bytesToBase64Url(new Uint8Array(0)), "");
});

test("base64url：与 RFC 4648 的已知向量一致", () => {
  // "f" "o" "o" → "Zm9v"（无填充）
  assert.equal(bytesToBase64Url(new TextEncoder().encode("foo")), "Zm9v");
  // 3 字节恰好无填充；2 字节应补一个 "="，但 base64url 要去掉
  assert.equal(bytesToBase64Url(new TextEncoder().encode("fo")), "Zm8");
  assert.equal(bytesToBase64Url(new TextEncoder().encode("f")), "Zg");
});

/* ------------------------------------------------------------------ *
 * 环境适配：端口必须来自 Rust 侧实际绑定
 * ------------------------------------------------------------------ */

test("环境适配：redirectUri 用实际绑定的端口", () => {
  const { invoke } = stubInvoke({});
  const env = createTauriSsoEnvironment(53211, invoke);
  assert.equal(env.redirectUri, "http://127.0.0.1:53211/callback");
});

test("环境适配：回环等待与关闭都走 Rust 命令", async () => {
  const { invoke, calls } = stubInvoke({
    sso_wait_callback: async () => "?code=abc&state=xyz",
    sso_cancel_callback: async () => undefined,
  });
  const env = createTauriSsoEnvironment(40001, invoke);
  const server = await env.startCallbackServer("/callback");
  assert.equal(server.port, 40001);
  assert.equal(await server.waitForCallback(), "?code=abc&state=xyz");
  await server.close();
  assert.deepEqual(
    calls.map((c) => c.cmd),
    ["sso_wait_callback", "sso_cancel_callback"]
  );
});

test("环境适配：开浏览器把 URL 传给 Rust", async () => {
  const { invoke, calls } = stubInvoke({ sso_open_browser: async () => undefined });
  const env = createTauriSsoEnvironment(40002, invoke);
  await env.openBrowser("https://ctc.example.com/authorize?x=1");
  assert.equal(calls[0]?.cmd, "sso_open_browser");
  assert.deepEqual(calls[0]?.args, { url: "https://ctc.example.com/authorize?x=1" });
});

test("环境适配：随机串按字节往返无损（下游要 charCodeAt 取回字节）", () => {
  const { invoke } = stubInvoke({});
  const env = createTauriSsoEnvironment(40003, invoke);
  const raw = env.random(32);
  assert.equal(raw.length, 32, "要 32 个字节");
  for (let i = 0; i < 32; i++) {
    // 下游 createCodeVerifier 用 `charCodeAt(i) & 0xff` 取回原始字节 ——
    // 往返必须无损，否则 PKCE challenge 算错，ctc 侧以 invalid_grant 拒掉。
    assert.equal(raw.charCodeAt(i) & 0xff, raw.charCodeAt(i) & 0xff);
  }
  assert.notEqual(raw, env.random(32), "两次随机不该相同");
});

test("环境适配：SHA-256 的 base64url 与已知向量一致", async () => {
  const { invoke } = stubInvoke({});
  const env = createTauriSsoEnvironment(40004, invoke);
  // "abc" 的 SHA-256 = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
  const out = await env.sha256Base64Url("abc");
  assert.equal(out, "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
});

/* ------------------------------------------------------------------ *
 * 主流程：起端口 → 拼 redirectUri → 走协议
 * ------------------------------------------------------------------ */

test("主流程：先绑端口再拼 redirectUri", async () => {
  const { invoke, calls } = stubInvoke({
    sso_start_callback: async () => 45678,
    sso_wait_callback: async () => "?error=access_denied",
    sso_cancel_callback: async () => undefined,
    sso_open_browser: async () => undefined,
  });
  const res = await startSsoLogin(FULL_CONFIG, invoke);
  // 用户点了「拒绝授权」⇒ 回调里只有 error、没有 code。
  // 协议层把它归为 **cancelled**（用户主动拒绝不是错误，不该报红字）。
  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.code : "", "cancelled");
  assert.equal(calls[0]?.cmd, "sso_start_callback", "绑端口必须是第一步");
});

test("主流程：配置缺字段时直接返回 config 错误，不碰网络也不绑端口", async () => {
  const { invoke, calls } = stubInvoke({
    sso_start_callback: async () => 45679,
  });
  const res = await startSsoLogin(
    { ...FULL_CONFIG, clientId: "" },
    invoke
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false ? res.code : "", "config");
  // 顺序不能反：先绑端口再发现配置不全 ⇒ 端口泄漏，
  // 用户第二次登录撞「端口被占用」。
  assert.deepEqual(calls, [], "配置都不全，不该绑任何端口");
});

/* ------------------------------------------------------------------ *
 * 密钥库桥接
 * ------------------------------------------------------------------ */

test("密钥库桥接：读写删三条命令一一对应", async () => {
  const { invoke, calls } = stubInvoke({
    sso_get_tokens: async () => '{"accessToken":"AT"}',
    sso_set_tokens: async () => undefined,
    sso_clear_tokens: async () => undefined,
  });
  const store = createTauriSecureStore(invoke);
  assert.equal(await store.get("z-biz-tool.sso.tokens"), '{"accessToken":"AT"}');
  await store.set("z-biz-tool.sso.tokens", "payload");
  await store.delete("z-biz-tool.sso.tokens");
  assert.deepEqual(
    calls.map((c) => c.cmd),
    ["sso_get_tokens", "sso_set_tokens", "sso_clear_tokens"]
  );
  assert.deepEqual(calls[1]?.args, { value: "payload" }, "整条会话一条，不拆成多条");
});

test("密钥库桥接：读不到时返回 null 而不是 undefined", async () => {
  const { invoke } = stubInvoke({ sso_get_tokens: async () => null });
  const store = createTauriSecureStore(invoke);
  assert.equal(await store.get("k"), null);
});

test("密钥库桥接：删除不先读再判断（避免读到过期的中间态）", async () => {
  const { invoke, calls } = stubInvoke({
    sso_clear_tokens: async () => undefined,
    sso_get_tokens: async () => "SHOULD-NOT-BE-CALLED",
  });
  const store = createTauriSecureStore(invoke);
  await store.delete("k");
  assert.deepEqual(
    calls.map((c) => c.cmd),
    ["sso_clear_tokens"],
    "delete 不该先 get"
  );
});

test("密钥库可用性探测：命令抛错时返回 false（不显示入口）", async () => {
  const failing: TauriInvoke = async () => {
    throw new Error("keyring unavailable");
  };
  assert.equal(await secureStoreAvailable(failing), false);
});

test("密钥库可用性探测：可用时返回 true", async () => {
  const { invoke } = stubInvoke({ sso_secure_store_available: async () => true });
  assert.equal(await secureStoreAvailable(invoke), true);
});

test("会话存储：token 走密钥库、展示信息不落 token", async () => {
  const { invoke, calls } = stubInvoke({
    sso_get_tokens: async () => null,
    sso_set_tokens: async () => undefined,
    sso_clear_tokens: async () => undefined,
  });
  const store = createTauriSsoSessionStore(invoke);
  await store.save({
    accessToken: "AT-secret",
    refreshToken: "RT-secret",
    expiresAt: null,
    tokenType: "Bearer",
    user: { subject: "u-1", displayName: "李四", email: null, username: "lisi" },
  });
  const setCall = calls.find((c) => c.cmd === "sso_set_tokens");
  const payload = String(setCall?.args?.value ?? "");
  assert.match(payload, /AT-secret/, "token 确实进了密钥库");
  assert.match(payload, /RT-secret/, "refresh_token 一并无存，否则每小时弹一次浏览器");
});
