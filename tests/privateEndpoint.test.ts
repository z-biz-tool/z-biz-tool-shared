// 前端侧「私网 / 免密钥」判据的契约回归。
// 跑法：node --experimental-strip-types --test tests/privateEndpoint.test.ts
//
// ## 本文件与 Rust 侧的关系（重要）
//
// 金标：`z-biz-tool-capability/crates/cap-llm/src/config.rs` 的
// `is_private_endpoint()` 与 `LlmConfig::needs_api_key()`。
//
// **下面每一条断言都对应 Rust 侧同名用例**（`private_endpoint_is_recognised_without_preset`
// / `private_endpoint_does_not_rescue_key_requiring_preset`）。
// 两边判据漂移 ⇒ 请求发出去了、没带鉴权头、拿到 401，而用户完全不知道为什么 ——
// 这种不一致不会有任何编译错误，只表现为「本地网关配了却用不了」。
//
// 改这边之前先看 Rust 侧有没有变；Rust 是金标（它决定实际发不发鉴权头）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateEndpoint, needsApiKey, hostOf, serviceHost } from "../src/ai/privateEndpoint.ts";

test("私有地址一律认得 —— 与 Rust 侧 is_private_endpoint 同名单测一一对应", () => {
  for (const url of [
    "http://127.0.0.1:8200/v1",
    "http://localhost:11434/v1",
    "192.168.1.2:8200/v1", // 历史写法：无 scheme
    "http://zifangs-mac-mini.local:8200/v1", // mDNS
    "http://host.docker.internal:1234/v1",
    "http://10.0.0.9/v1",
    "http://172.20.1.4/v1",
    "http://[::1]:8200/v1",
    "http://user:pw@127.0.0.1:8200/v1", // 带 userinfo
  ]) {
    assert.equal(isPrivateEndpoint(url), true, `${url} 应判为私有地址`);
  }
});

test("公网地址一个都不能误判 —— 放行公网等于把「没填 key」的错误挪到 401 里", () => {
  for (const url of [
    "https://api.openai.com/v1",
    "https://api.deepseek.com/v1",
    "http://172.32.0.1/v1", // 172.16/12 的下界之外
    "http://192.169.1.1/v1", // 192.168/16 的下界之外
    "http://11.0.0.1/v1",
    "https://example.local.evil.com/v1", // 后缀在域名中间，不算 .local
  ]) {
    assert.equal(isPrivateEndpoint(url), false, `${url} 不该判为私有地址`);
  }
});

test("预设说不免就不免 —— 哪怕地址是本机", () => {
  // 对应 Rust 侧 private_endpoint_does_not_rescue_key_requiring_preset：
  // 用户显式选了 DeepSeek（要 key），却把地址指向本机代理 ——
  // 按预设走。放开的话请求会没带鉴权头发出去，拿到 401 而用户不知道为什么。
  assert.equal(needsApiKey(true, "http://127.0.0.1:8200/v1"), true);
});

test("预设说免就免 —— 哪怕地址是公网", () => {
  // 对应 Rust 侧 keyless_presets_are_loopback_only 里的 zbiz-local 分支。
  assert.equal(needsApiKey(false, "https://api.openai.com/v1"), false);
});

test("没匹配到预设时看地址 —— 私网免、公网要", () => {
  // 对应 Rust 侧 private_endpoint_is_recognised_without_preset：
  // 用户不选预设、直接把 mini 的地址粘进来。
  assert.equal(needsApiKey(undefined, "http://192.168.31.249:8200/v1"), false);
  assert.equal(needsApiKey(undefined, "https://api.openai.com/v1"), true);
});

test("阴性对照：判据不是永真 —— 换个地址结论就得反过来", () => {
  // 这条是给「判据自己得有牙齿」用的：如果哪天有人把实现改成恒返回 true，
  // 这条立刻红。而恒真的判据会让所有本地网关用户被静默放行，
  // 公网用户则被静默拦下 —— 两种故障都不会有人来报。
  const priv = needsApiKey(undefined, "http://192.168.31.249:8200/v1");
  const pub = needsApiKey(undefined, "https://api.openai.com/v1");
  assert.notEqual(priv, pub, "同一判据对私网与公网必须给出相反结论");
  assert.equal(priv, false);
  assert.equal(pub, true);
});

test("host 提取：去掉 scheme / userinfo / 端口 / 路径", () => {
  assert.equal(hostOf("http://127.0.0.1:8200/v1"), "127.0.0.1");
  assert.equal(hostOf("https://api.openai.com/v1"), "api.openai.com");
  assert.equal(hostOf("192.168.1.2:8200/v1"), "192.168.1.2");
  assert.equal(hostOf("http://user:pw@127.0.0.1:8200/v1"), "127.0.0.1");
  assert.equal(hostOf("http://[::1]:8200/v1"), "[::1]");
  assert.equal(hostOf(""), "");
});

test("服务身份 host：保留端口 —— 与 Rust 侧 detect_preset 的 host_of 同口径", () => {
  // Rust 侧 `note/src-tauri/src/ai.rs` 的 `host_of` 保留端口。
  // 前端「服务身份匹配」必须同口径，否则同一个地址前后端结论相反。
  assert.equal(serviceHost("http://127.0.0.1:8200/v1"), "127.0.0.1:8200");
  assert.equal(serviceHost("http://127.0.0.1:8200"), "127.0.0.1:8200");
  assert.equal(serviceHost("http://localhost:11434"), "localhost:11434");
  assert.equal(serviceHost("https://api.openai.com/v1"), "api.openai.com");
  assert.equal(serviceHost("192.168.1.2:8200/v1"), "192.168.1.2:8200");
  assert.equal(serviceHost("http://user:pw@127.0.0.1:8200/v1"), "127.0.0.1:8200");
  assert.equal(serviceHost(""), "");
});

test("两套 host 口径各司其职：地址判定剥端口，服务身份留端口", () => {
  // 这条是本文件最关键的区分用例：
  // - `hostOf` 回答「是不是私网」⇒ 端口无关（RFC 1918 判定）；
  // - `serviceHost` 回答「是不是同一个服务」⇒ 端口是身份的一部分。
  //
  // 混用的后果：自建分类下 `zbiz-local`（8200，免密钥）与
  // `freellmapi`（3001，要密钥）都在 127.0.0.1 上。若服务身份也剥端口，
  // 两者被认成同一个 ⇒ 要求密钥的服务被判成免密钥 ⇒ 用户永远配不上。
  const zbizLocal = "http://127.0.0.1:8200/v1";
  const freellm = "http://127.0.0.1:3001/v1";

  // 地址判定：两个都是私网（端口无关）
  assert.equal(isPrivateEndpoint(zbizLocal), true);
  assert.equal(isPrivateEndpoint(freellm), true);

  // 服务身份：两个**不同**（端口是关键）
  assert.notEqual(serviceHost(zbizLocal), serviceHost(freellm));
  // 而剥端口的地址口径对两者给出的结论相同 —— 这正是它不能用于身份匹配的原因
  assert.equal(hostOf(zbizLocal), hostOf(freellm));
});

test("阴性对照：服务身份判据不是永真 —— 端口不同必须给出不同结论", () => {
  // 若有人把 serviceHost 改成剥端口（或恒返回同一个串），这条立刻红。
  const a = serviceHost("http://127.0.0.1:8200/v1");
  const b = serviceHost("http://127.0.0.1:3001/v1");
  assert.notEqual(a, b, "同 host 不同端口必须是不同服务");
  // 端口相同、路径不同 ⇒ 同一个服务
  assert.equal(
    serviceHost("http://127.0.0.1:8200/v1"),
    serviceHost("http://127.0.0.1:8200"),
  );
});

test("IPv6 唯一本地地址（fc00::/7）算私有", () => {
  assert.equal(isPrivateEndpoint("http://[fd00::1]:8200/v1"), true);
  assert.equal(isPrivateEndpoint("http://[fc00::1]:8200/v1"), true);
  // 公网 IPv6 不算
  assert.equal(isPrivateEndpoint("http://[2001:db8::1]/v1"), false);
});
