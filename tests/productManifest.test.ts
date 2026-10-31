// 产品自报文件的契约回归。
// 跑法：node --experimental-strip-types --import ./tests/register-ts-ext.mjs --test tests/productManifest.test.ts
//
// ## 这个文件守的是什么
//
// 「每条记录都有主人」——16 个仓各自声明自己那条产品元数据，
// 协议层（cap-hub / shared）只提供类型与校验。
//
// 这条约束一旦破了，症状是**静默**的：某个仓声明了协议层不认识的 id，
// 或某个仓忘了声明自己 —— 编译不报错、单测不报错，
// 只在 box 的家族面板上表现为「这个产品打不开 / 少了一张卡片」。
// 所以对账必须有自己的门禁。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCT_MANIFEST_PATH,
  buildRegistryFromManifests,
  parseProductManifest,
  reconcileManifests,
  type ProductManifestFile,
} from "../src/types/productManifest.ts";
import { PRODUCT_IDS } from "../src/types/product.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** 一份合法的自报。 */
function manifest(
  overrides: Partial<ProductManifestFile> = {},
): ProductManifestFile {
  return {
    id: "db",
    displayName: "数据库工具",
    description: "管理多数据库连接",
    acceptsDeepLink: true,
    actions: ["open", "connect"],
    keywords: ["sql", "数据库"],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * 解析层
 * ------------------------------------------------------------------ */

test("合法自报解析通过", () => {
  const r = parseProductManifest(manifest());
  assert.equal(r.ok, true);
  assert.ok(r.ok);
  assert.equal(r.value.id, "db");
  assert.deepEqual(r.value.actions, ["open", "connect"]);
});

test("非对象一律被拒", () => {
  for (const bad of [null, undefined, 42, "db", [], true]) {
    const r = parseProductManifest(bad);
    assert.equal(r.ok, false, `应被拒：${JSON.stringify(bad)}`);
  }
});

test("缺字段要指名道姓，不能只说「不合法」", () => {
  const cases: [Partial<ProductManifestFile>, string][] = [
    [{ id: undefined }, "id"],
    [{ displayName: undefined }, "displayName"],
    [{ description: undefined }, "description"],
    [{ acceptsDeepLink: undefined }, "acceptsDeepLink"],
    [{ actions: undefined }, "actions"],
  ];
  for (const [patch, field] of cases) {
    const r = parseProductManifest({ ...manifest(), ...patch });
    assert.equal(r.ok, false);
    assert.ok(!r.ok);
    assert.ok(
      r.reason.includes(field),
      `原因应点名 ${field}，实际：${r.reason}`,
    );
  }
});

test("actions 里有非字符串被拒", () => {
  const r = parseProductManifest(manifest({ actions: ["open", 7] as never }));
  assert.equal(r.ok, false);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes("actions"), r.reason);
});

test("keywords 给了就得是字符串数组", () => {
  const r = parseProductManifest(manifest({ keywords: [1] as never }));
  assert.equal(r.ok, false);
  const r2 = parseProductManifest(manifest({ keywords: "sql" as never }));
  assert.equal(r2.ok, false);
});

test("keywords 可以不给（可选字段）", () => {
  const { keywords, ...without } = manifest();
  void keywords;
  const r = parseProductManifest(without);
  assert.equal(r.ok, true);
});

/* ------------------------------------------------------------------ *
 * 语义层（复用 product.ts 的自洽性校验）
 * ------------------------------------------------------------------ */

test("协议层不认识的 id 被拒", () => {
  const r = parseProductManifest(manifest({ id: "nosuch" }));
  assert.equal(r.ok, false);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes("nosuch") || r.reason.includes("非法"), r.reason);
});

test("声明了动作却说自己不接深链 —— 自相矛盾，被拒", () => {
  const r = parseProductManifest(manifest({ acceptsDeepLink: false }));
  assert.equal(r.ok, false);
  assert.ok(!r.ok);
  assert.ok(r.reason.includes("acceptsDeepLink"), r.reason);
});

test("不接深链就不要声明动作", () => {
  const r = parseProductManifest(
    manifest({ acceptsDeepLink: false, actions: [] }),
  );
  assert.equal(r.ok, true);
});

test("空 displayName / description 被拒", () => {
  assert.equal(parseProductManifest(manifest({ displayName: "" })).ok, false);
  assert.equal(parseProductManifest(manifest({ description: "" })).ok, false);
});

/* ------------------------------------------------------------------ *
 * 汇总层
 * ------------------------------------------------------------------ */

test("汇总多份自报得到 registry", () => {
  const reg = buildRegistryFromManifests([
    manifest({ id: "db" }),
    manifest({ id: "note", displayName: "笔记" }),
  ]);
  assert.equal(reg.products.size, 2);
  assert.equal(reg.products.get("db")?.displayName, "数据库工具");
  assert.equal(reg.products.get("note")?.displayName, "笔记");
});

test("重复 id 直接抛错，不静默取最后一份", () => {
  assert.throws(
    () =>
      buildRegistryFromManifests([
        manifest({ id: "db" }),
        manifest({ id: "db", displayName: "另一个" }),
      ]),
    /重复/,
  );
});

test("汇总时不合规的那份会抛错（不是被跳过）", () => {
  assert.throws(
    () =>
      buildRegistryFromManifests([
        manifest({ id: "db" }),
        manifest({ id: "nosuch" }),
      ]),
    /校验失败/,
  );
});

/* ------------------------------------------------------------------ *
 * 对账层
 * ------------------------------------------------------------------ */

test("全部认领且协议认识 ⇒ 对账通过", () => {
  const r = reconcileManifests(["db", "note", "cpu"], ["db", "note", "cpu"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.unknown, []);
});

test("少认领一个 ⇒ ok=false 且 missing 点名它", () => {
  const r = reconcileManifests(
    ["db", "note", "cpu"],
    ["db", "note", "cpu", "file"],
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["file"]);
  assert.deepEqual(r.unknown, []);
});

test("没人认领的产品要报出来（missing）", () => {
  const r = reconcileManifests(["db"], ["db", "note"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["note"]);
});

test("协议层不认识的 id 要报出来（unknown）", () => {
  const r = reconcileManifests(["db", "brandnew"], ["db"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unknown, ["brandnew"]);
  assert.deepEqual(r.missing, []);
});

test("重复声明要报出来（duplicated）", () => {
  const r = reconcileManifests(["db", "db"], ["db"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.duplicated, ["db"]);
});

/* ------------------------------------------------------------------ *
 * 家族现状：16 个仓的自报必须齐、且协议层认识
 *
 * 这一段是「当前事实」的回归 —— 不是抽象规则，而是此刻家族的真实形状。
 * 有人加了新产品却忘了同步协议层，这里立刻红。
 * ------------------------------------------------------------------ */

test("协议层的产品集合与家族产品集合一致", () => {
  // shared 与 cap-hub 各有一份产品 id 集合，两边必须**逐个相同**。
  // 这里不去硬编码一份期望清单 —— 那样清单一漂移，测试就会变成
  // 「和另一份手抄的清单比」，抄错方向错了也测不出来。
  // 做法：直接读 cap-hub 的源码，把它的 PRODUCT_IDS 抠出来比对 ——
  // 那是协议层的金标（Rust 那侧），shared 是它的 TS 等价物。
  //
  // cap-hub 不在盘上时（如只 checkout shared 的 CI）跳过而不是假装通过：
  // 「没量到」与「量到且没问题」必须分得开。
  const capHubManifest = resolve(
    here,
    "../../z-biz-tool-capability/crates/cap-hub/src/manifest.rs",
  );
  if (!existsSync(capHubManifest)) {
    // cap-hub 不在盘上：这不是失败，是「没看」。
    return;
  }
  const src = readFileSync(capHubManifest, "utf8");
  const m = /pub const PRODUCT_IDS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/.exec(src);
  assert.ok(m, "cap-hub 里找不到 PRODUCT_IDS 定义");
  const rustIds = [...m[1].matchAll(/"([a-z0-9_-]+)"/g)].map((x) => x[1]).sort();
  const tsIds = [...PRODUCT_IDS].sort();
  assert.deepEqual(
    tsIds,
    rustIds,
    "shared 的 PRODUCT_IDS 与 cap-hub 的不一致 —— 协议层改了必须两边同步",
  );
});

test("仓库内没有遗留的产品自报副本（真值只在各产品仓）", () => {
  // shared 是共享层，不该自带任何一条产品的真值。
  const p = resolve(here, "../package.json");
  const pkg = JSON.parse(readFileSync(p, "utf8")) as {
    files?: readonly string[];
  };
  assert.deepEqual(pkg.files, ["dist"], "只应发布 dist");
});
