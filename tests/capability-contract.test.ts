// cap-img 跨语言命令契约的回归（无 React、无 DOM）。
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 为什么这个文件优先：src/capability/types.ts 里声明的命令名，是前端
// 透过 Tauri #[tauri::command] 薄壳调 Rust `cap_img::*` 的**唯一约定**。
// 两边任何一边改名/增删都不会编译报错 —— 前端调过去拿到的是运行时报错，
// 或是静默走错分支。契约漂移是这类分层里最难发现的一类 bug。
//
// src/capability/types.ts 的注释里留过一条待办：
//   "audit 加『声明 ↔ 注册』检查项"
// 这份测试就是那个检查项。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CapImgCommands } from "../src/capability/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
/** capability 仓在组织里的同级位置；不在盘上时下面那条交叉校验会跳过而不是假装通过 */
const RUST_LIB = resolve(HERE, "../../z-biz-tool-capability/crates/cap-img/src/lib.rs");
const TYPES_SRC = resolve(HERE, "../src/capability/types.ts");

/**
 * TS 命令名 → Rust 侧 `pub fn` 名。
 * 命名规则是 snake_case → camelCase，但命令名本身常带语义词
 * （getImageInfo ↔ info、saveImageData ↔ save_bytes），
 * 所以映射关系必须显式写死，不能靠"自动转驼峰"推导 —— 推导出来的等于没测。
 */
const TS_TO_RUST: Record<keyof CapImgCommands, string> = {
  getImageInfo: "info",
  getImageThumbnail: "thumbnail",
  saveImageData: "save_bytes",
  exportImage: "export",
  resizeImage: "resize",
  rotateImage: "rotate",
  flipImage: "flip",
  cropImage: "crop",
  applyFilter: "apply_filter",
};

/**
 * Rust 侧有、但**不该**进 IPC 契约的内部工具函数。
 * 它们是 crate 的实现细节，不走 Tauri 薄壳；反过来若哪天有人把内部函数
 * 漏进前端契约，这条会红。
 */
const RUST_INTERNAL_HELPERS = [
  "decode_data_url",
  "encode_data_url",
  "encode_frame_jpeg",
  "detect_format",
  "sniff_format",
  "parse_format",
  "mime_for_ext",
  "ext_for_mime",
];

/** 映射表里声明的命令名（运行时可枚举的只有这份 TS_TO_RUST） */
function declaredCommands(): string[] {
  return Object.keys(TS_TO_RUST);
}

/**
 * 从 types.ts 源码里解析 `CapImgCommands` 接口实际声明的命令名。
 *
 * 不能直接 `Object.keys(capImgCommands)` —— `CapImgCommands` 是 **interface**，
 * 编译后根本不存在于运行时，只有类型。所以只能从源码里抠出来。
 * （第一版这里写成了 `declare const`，运行时会直接炸 —— 类型和值不是一回事。）
 */
function declaredCommandsFromSource(): string[] {
  const src = readFileSync(TYPES_SRC, "utf8");
  // 只取 CapImgCommands 这个 interface 的花括号范围，避免抓到别的 interface
  const start = src.indexOf("export interface CapImgCommands");
  assert.notEqual(start, -1, "types.ts 里找不到 CapImgCommands 接口，源码结构变了？");
  const open = src.indexOf("{", start);
  const close = src.indexOf("\n}", open);
  assert.notEqual(close, -1, "CapImgCommands 接口没有正常闭合");
  const body = src.slice(open, close);
  return [...body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): \{/gm)].map((m) => m[1]);
}

test("契约表与映射表一一对应，不多不少", () => {
  // 映射表写错一个键名就会在这里暴露：TS 契约新增了命令但忘了更新映射。
  const fromContract = declaredCommandsFromSource();
  const fromMap = declaredCommands();
  assert.deepEqual(
    [...fromMap].sort(),
    [...fromContract].sort(),
    "TS 契约的命令与 TS_TO_RUST 映射不一致 —— 新增命令时两处都要改",
  );
});

test("每个映射的 Rust 函数名都是合法的 snake_case 标识符", () => {
  for (const [ts, rust] of Object.entries(TS_TO_RUST)) {
    assert.match(rust, /^[a-z][a-z0-9_]*$/, `${ts} → "${rust}" 不是合法的 snake_case 函数名`);
  }
});

test("与 Rust 源码交叉校验：声明的每个命令在 crate 里都有对应 pub fn", (t) => {
  if (!existsSync(RUST_LIB)) {
    t.skip(`capability 仓不在盘上（${RUST_LIB}），跳过交叉校验`);
    return;
  }
  const rust = readFileSync(RUST_LIB, "utf8");
  const pubFns = new Set(
    [...rust.matchAll(/^pub fn ([a-z_][a-z0-9_]*)/gm)].map((m) => m[1]),
  );
  assert.ok(pubFns.size > 0, "没从 Rust 源码里解析出任何 pub fn，正则可能已失效");

  for (const [ts, rustName] of Object.entries(TS_TO_RUST)) {
    assert.ok(
      pubFns.has(rustName),
      `TS 契约声明了 "${ts}" → Rust "${rustName}"，但 cap-img/src/lib.rs 里没有这个 pub fn。\n` +
        `Rust 现有: ${[...pubFns].sort().join(", ")}`,
    );
  }
});

test("与 Rust 源码交叉校验：内部工具函数没有被误登记进前端契约", (t) => {
  if (!existsSync(RUST_LIB)) {
    t.skip(`capability 仓不在盘上（${RUST_LIB}），跳过交叉校验`);
    return;
  }
  const declared = new Set(Object.values(TS_TO_RUST));
  for (const helper of RUST_INTERNAL_HELPERS) {
    assert.ok(
      !declared.has(helper),
      `"${helper}" 是 crate 内部函数，不该出现在前端 IPC 契约里`,
    );
  }
});

test("与 Rust 源码交叉校验：契约没有漏掉 Rust 的公开能力", (t) => {
  if (!existsSync(RUST_LIB)) {
    t.skip(`capability 仓不在盘上（${RUST_LIB}），跳过交叉校验`);
    return;
  }
  const rust = readFileSync(RUST_LIB, "utf8");
  const pubFns = new Set(
    [...rust.matchAll(/^pub fn ([a-z_][a-z0-9_]*)/gm)].map((m) => m[1]),
  );
  const declared = new Set(Object.values(TS_TO_RUST));
  const internals = new Set(RUST_INTERNAL_HELPERS);
  // Rust 里新增了公开函数却没在前端契约登记 ⇒ 前端调不到它。
  // 这条报错不代表一定是 bug（可能有意只在 Rust 侧提供），
  // 但必须被人看一眼，不该静默通过。
  const undeclared = [...pubFns]
    .filter((f) => !declared.has(f) && !internals.has(f))
    .sort();
  assert.deepEqual(
    undeclared,
    [],
    `Rust 新增了公开函数但前端契约没登记: ${undeclared.join(", ")}\n` +
      `若是有意只在 Rust 侧提供，请把名字补进 RUST_INTERNAL_HELPERS 并注明原因。`,
  );
});
