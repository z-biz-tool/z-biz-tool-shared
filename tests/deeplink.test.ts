// zBiz deep-link 协议的契约回归。
// 跑法：node --experimental-strip-types --test tests/deeplink.test.ts
//
// ## 本文件与 box 仓的关系（重要）
//
// 规范来源：`z-biz-tool-lead/doc/矩阵规划/04_连接度：家族面板与统一协议.md` §2。
// 字节级金标：`z-biz-tool-box/src-tauri/src/handoff.rs` 的 12 条单测。
//
// **下面每一条 `test(...)` 都与 handoff.rs 里的同名单测一一对应**，
// 断言的期望值（尤其是整串 URL）是照抄的。改一边必须改另一边，
// 否则 box 与其它 app 会互相不认识对方的链接 —— 而这种不一致
// 不会有任何编译错误，只表现为「点了没反应」。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ACTION,
  DEEPLINK_EVENT,
  ZBIZ_SCHEME,
  buildDeepLink,
  decodeValue,
  deepLinksFromArgs,
  encodeValue,
  parseDeepLink,
  type Handoff,
} from "../src/protocol/deeplink.ts";
import {
  PRODUCT_IDS,
  buildProductRegistry,
  isProductId,
  listDeepLinkProducts,
  listProductsByAction,
  validateProductMeta,
  type ProductMeta,
} from "../src/types/product.ts";
import {
  FAMILY_EVENTS,
  isFamilyEventName,
} from "../src/protocol/familyEvents.ts";

/* ------------------------------------------------------------------ *
 * 与 handoff.rs 一一对应的 12 条
 * ------------------------------------------------------------------ */

/** handoff.rs::round_trip_plain_path */
test("round_trip_plain_path", () => {
  const r = buildDeepLink("note", "open", { file: "/tmp/a.md", from: "box" });
  assert.ok(r.ok, r.ok ? "" : r.reason);
  assert.equal(
    r.value,
    "zbiz://note/open?file=/tmp/a.md&from=box",
    "整串必须与 box 的 handoff.rs 逐字节相同",
  );

  const p = parseDeepLink("zbiz://note/open?file=/tmp/a.md&from=box");
  assert.ok(p.ok, p.ok ? "" : p.reason);
  assert.deepEqual(p.value, {
    product: "note",
    action: "open",
    params: { file: "/tmp/a.md", from: "box" },
  });
});

/** handoff.rs::round_trip_cjk_and_space */
test("round_trip_cjk_and_space", () => {
  const path = "/Users/zifang/文稿/季度 总结.md";
  const r = buildDeepLink("note", "open", { file: path });
  assert.ok(r.ok);
  assert.ok(r.value.includes("%E6%96%87"), `中文应逐字节转义: ${r.value}`);
  assert.ok(r.value.includes("%20"), `空格应转义: ${r.value}`);
  assert.ok(!r.value.includes(" "), `深链里不能留裸空格: ${r.value}`);

  const p = parseDeepLink(r.value);
  assert.ok(p.ok);
  assert.equal(p.value.params.file, path);
});

/** handoff.rs::round_trip_values_with_separators */
test("round_trip_values_with_separators", () => {
  const nasty = "a&b=c#d+e%f";
  const r = buildDeepLink("box", "tool", { q: nasty });
  assert.ok(r.ok);
  assert.equal(r.value.match(/&/g)?.length ?? 0, 0, "值里的 & 必须被转义");
  assert.equal(r.value.match(/=/g)?.length ?? 0, 1, "值里的 = 必须被转义");

  const p = parseDeepLink(r.value);
  assert.ok(p.ok);
  assert.equal(p.value.params.q, nasty);
});

/** handoff.rs::action_defaults_to_open */
test("action_defaults_to_open", () => {
  const p = parseDeepLink("zbiz://note?file=/tmp/a.md");
  assert.ok(p.ok, p.ok ? "" : p.reason);
  assert.equal(p.value.action, "open");
  assert.equal(p.value.product, "note");
  assert.equal(DEFAULT_ACTION, "open");
});

/** handoff.rs::rejects_foreign_scheme */
test("rejects_foreign_scheme", () => {
  assert.equal(parseDeepLink("https://example.com/open?file=/x").ok, false);
  assert.equal(parseDeepLink("/tmp/a.md").ok, false);
  assert.equal(parseDeepLink("zbiz:/note").ok, false);
});

/** handoff.rs::rejects_invalid_token */
test("rejects_invalid_token", () => {
  assert.equal(parseDeepLink("zbiz://no te/open").ok, false);
  assert.equal(parseDeepLink("zbiz://note/../etc").ok, false);
  assert.equal(parseDeepLink("zbiz://note/open?fi le=x").ok, false);
  assert.equal(buildDeepLink("note", "open", { "a.b": "1" }).ok, false);
});

/** handoff.rs::rejects_control_chars */
test("rejects_control_chars", () => {
  assert.equal(buildDeepLink("note", "open", { file: "/tmp/a\nb" }).ok, false);
  assert.equal(buildDeepLink("note", "open", { file: "/tmp/a\0b" }).ok, false);
});

/** handoff.rs::rejects_bad_escape */
test("rejects_bad_escape", () => {
  assert.equal(parseDeepLink("zbiz://note/open?file=%2").ok, false);
  assert.equal(parseDeepLink("zbiz://note/open?file=%ZZ").ok, false);
});

/** handoff.rs::rejects_duplicate_param */
test("rejects_duplicate_param", () => {
  assert.equal(parseDeepLink("zbiz://note/open?file=/a&file=/b").ok, false);
});

/** handoff.rs::empty_value_still_parses */
test("empty_value_still_parses", () => {
  const p = parseDeepLink("zbiz://box/tool?flag=");
  assert.ok(p.ok, p.ok ? "" : p.reason);
  assert.equal(p.value.params.flag, "");
});

/** handoff.rs::from_args_picks_only_deeplinks */
test("from_args_picks_only_deeplinks", () => {
  const got = deepLinksFromArgs([
    "/Applications/z-biz-tool-note.app/Contents/MacOS/z-biz-tool-note",
    "-psn_0_12345",
    "zbiz://note/open?file=/tmp/a.md",
    "zbiz://坏深链",
  ]);
  assert.equal(got.length, 1, "只有一条合法深链");
  assert.equal(got[0].product, "note");
});

/** handoff.rs::queue_dedupes_and_drains（队列部分见 pending-queue.test.ts） */
test("queue_dedupes_and_drains", () => {
  // 这里只验「同样的链接解析结果相同」——去重与清空是队列的职责
  const a = parseDeepLink("zbiz://note/open?file=/tmp/a.md");
  assert.ok(a.ok);
  const b = parseDeepLink("zbiz://note/open?file=/tmp/a.md");
  assert.ok(b.ok);
  assert.deepEqual(a.value, b.value);
});

/* ------------------------------------------------------------------ *
 * 跨语言 golden 比对（Rust ↔ TS）
 * ------------------------------------------------------------------ */

/**
 * 这条是整个协议层**最重要的一条测试**。
 *
 * `tests/fixtures/deeplink-golden.json` 里的每条 `uri` 都是
 * **box 仓 Rust 实现（handoff.rs 的 build()）实际产出**的字节串。
 * TS 侧必须复现出一模一样的结果。
 *
 * 为什么非要这样测：Rust 与 TS 是两套独立实现，同一份协议写两遍，
 * 最容易出的错是「两边都自洽，但细节不一致」—— 比如百分号转义的
 * 大小写、参数排序规则、空值的表现。这类不一致**不会让任何一边报错**，
 * 只会在真实唤起时表现为「box 发过去的链接，note 解析不出参数」。
 *
 * golden 样本覆盖：纯 ASCII 路径 / 中文路径 / 含空格 / 参数里嵌
 * `&=+#%` 分隔符 / 参数顺序 / 空值 / Windows 盘符路径。
 */
test("golden 比对：TS 产出的链接与 Rust 侧逐字节相同", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const goldenPath = resolve(here, "fixtures/deeplink-golden.json");
  const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
    cases: Array<{
      product: string;
      action: string;
      params: Record<string, string>;
      uri: string;
    }>;
  };

  assert.ok(golden.cases.length > 0, "golden 样本不应为空");

  for (const c of golden.cases) {
    const r = buildDeepLink(c.product, c.action, c.params);
    assert.ok(r.ok, `${c.product}/${c.action} 构造应成功：${r.ok ? "" : r.reason}`);
    assert.equal(
      r.value,
      c.uri,
      `与 Rust golden 不一致：${c.product}/${c.action}\n  TS:    ${r.value}\n  Rust:  ${c.uri}`,
    );
  }
});

test("golden 比对：TS 解析 Rust 产出的链接，参数完全还原", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const goldenPath = resolve(here, "fixtures/deeplink-golden.json");
  const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
    cases: Array<{
      product: string;
      action: string;
      params: Record<string, string>;
      uri: string;
    }>;
  };

  for (const c of golden.cases) {
    const p = parseDeepLink(c.uri);
    assert.ok(p.ok, `解析应成功：${c.uri}`);
    assert.equal(p.value.product, c.product);
    assert.equal(p.value.action, c.action);
    assert.deepEqual(p.value.params, c.params, `参数还原不一致：${c.uri}`);
  }
});

/* ------------------------------------------------------------------ *
 * 参数顺序稳定性
 * ------------------------------------------------------------------ */

/**
 * handoff.rs 用 BTreeMap 保证「同样的输入永远得到同一串字节」。
 * JS 的对象键序在「整数样键名」上会按数字升序排 —— 与 BTreeMap 的字典序不同。
 * 这里显式排序，且**不能用数字样的键名**（那会绕过排序）。
 */
test("参数顺序固定（同样的输入得到同样的字节串）", () => {
  const a = buildDeepLink("note", "open", { zeta: "1", alpha: "2" });
  const b = buildDeepLink("note", "open", { alpha: "2", zeta: "1" });
  assert.ok(a.ok && b.ok);
  assert.equal(a.value, b.value, "参数顺序必须与书写顺序无关");
  assert.equal(a.value, "zbiz://note/open?alpha=2&zeta=1");
});

test("参数顺序与 box 的 BTreeMap 字典序一致", () => {
  // BTreeMap 是字节字典序：'a' < 'z'，'ab' < 'b'
  const r = buildDeepLink("note", "open", { b: "1", a: "2", ab: "3" });
  assert.ok(r.ok);
  assert.equal(r.value, "zbiz://note/open?a=2&ab=3&b=1");
});

/* ------------------------------------------------------------------ *
 * 编解码细节
 * ------------------------------------------------------------------ */

test("百分号编解码往返", () => {
  for (const s of [
    "/tmp/a.md",
    "/Users/zifang/文稿/季度 总结.md",
    "a&b=c#d+e%f",
    "",
  ]) {
    const d = decodeValue(encodeValue(s));
    assert.ok(d.ok, `${s} 解码应成功`);
    assert.equal(d.value, s);
  }
});

test("编码保留路径可读性（斜杠与冒号不转义）", () => {
  assert.equal(encodeValue("/tmp/a.md"), "/tmp/a.md");
  assert.equal(encodeValue("C:/Users/x"), "C:/Users/x");
});

test("解码非 UTF-8 序列报错而非替换成替身字符", () => {
  // %FF 不是合法 UTF-8 起始字节
  const d = decodeValue("%FF");
  assert.equal(d.ok, false, "非法 UTF-8 必须报错");
});

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

test("协议常量与 box 侧一致", () => {
  assert.equal(ZBIZ_SCHEME, "zbiz://");
  assert.equal(DEEPLINK_EVENT, "zbiz-open", "前端事件名必须与 handoff.rs 的 EVENT 一致");
});

/* ------------------------------------------------------------------ *
 * 产品清单
 * ------------------------------------------------------------------ */

const meta = (id: ProductMeta["id"]): ProductMeta => ({
  id,
  displayName: id.toUpperCase(),
  description: `${id} 测试元数据`,
  acceptsDeepLink: true,
  actions: ["open"],
});

test("产品 id 无重复，且不含 capability/shared/lead（无窗口，唤起不了）", () => {
  const set = new Set(PRODUCT_IDS);
  assert.equal(set.size, PRODUCT_IDS.length, "产品 id 出现重复");
  for (const invisible of ["capability", "shared", "lead"]) {
    assert.ok(
      !(PRODUCT_IDS as readonly string[]).includes(invisible),
      `${invisible} 不该出现在产品 id 里`,
    );
  }
});

test("产品 id 与家族实际产品仓一致（新增产品要同步改 product.ts）", () => {
  // kb 2026-11-01 摘除：并入 note + cap-doc，仓库归档
  const expected = [
    "aigen",
    "box",
    "cpu",
    "db",
    "file",
    "history",
    "math",
    "mind",
    "music",
    "note",
    "pet",
    "remote",
    "sys",
    "terminal",
    "worker",
  ];
  assert.deepEqual(
    [...PRODUCT_IDS].sort(),
    expected.sort(),
    "协议产品集合与家族产品仓不一致 —— 新增/移除产品时必须同步改 product.ts",
  );
});

test("产品元数据校验：合规通过", () => {
  const v = validateProductMeta(meta("db"));
  assert.ok(v.ok, v.ok ? "" : v.reason);
});

test("产品元数据校验：缺字段被拒", () => {
  const cases: Array<[string, unknown]> = [
    ["非对象", "nope"],
    ["非法 id", { ...meta("db"), id: "nosuch" }],
    ["缺 displayName", { ...meta("db"), displayName: "" }],
    ["缺 description", { ...meta("db"), description: "" }],
    ["缺 acceptsDeepLink", { ...meta("db"), acceptsDeepLink: undefined }],
    ["actions 非数组", { ...meta("db"), actions: "open" }],
  ];
  for (const [label, m] of cases) {
    const v = validateProductMeta(m);
    assert.equal(v.ok, false, `${label} 应被拒`);
    assert.ok(!v.ok && v.reason.length > 0, `${label} 的失败必须带原因`);
  }
});

test("产品元数据校验：声明了 actions 却不开 acceptsDeepLink 是自相矛盾", () => {
  const v = validateProductMeta({ ...meta("db"), acceptsDeepLink: false });
  assert.equal(v.ok, false);
  assert.ok(!v.ok && v.reason.includes("acceptsDeepLink"), v.reason);
});

test("产品 registry：重复 id 直接抛错", () => {
  assert.throws(() => buildProductRegistry([meta("db"), meta("db")]), /重复/);
});

test("产品 registry 查询：只列出接深链的产品", () => {
  const reg = buildProductRegistry([
    meta("db"),
    { ...meta("file"), acceptsDeepLink: false, actions: [] },
    { ...meta("note"), actions: ["open", "create"] },
  ]);
  const ids = listDeepLinkProducts(reg).map((m) => m.id).sort();
  assert.deepEqual(ids, ["db", "note"]);

  const byAction = listProductsByAction(reg, "create").map((m) => m.id);
  assert.deepEqual(byAction, ["note"]);
});

/* ------------------------------------------------------------------ *
 * 家族事件
 * ------------------------------------------------------------------ */

test("家族事件名统一走 zbiz: 三段式", () => {
  for (const name of Object.values(FAMILY_EVENTS)) {
    assert.match(name, /^zbiz:[a-z-]+:[a-z-]+$/, `事件名格式不对：${name}`);
    assert.ok(isFamilyEventName(name));
  }
});

test("家族事件名不重复", () => {
  const vals = Object.values(FAMILY_EVENTS);
  assert.equal(new Set(vals).size, vals.length, "家族事件名出现重复");
});

test("未知事件名不被误认", () => {
  assert.equal(isFamilyEventName("zbiz:family:nope"), false);
  assert.equal(isFamilyEventName("some-other-event"), false);
});
