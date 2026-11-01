// cap-hash 的跨语言一致性回归（无 React、无 DOM）。
//
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 与 `deeplink.test.ts` 同一套路：**Rust 是金标**，golden 样本由
// `z-biz-tool-capability/crates/cap-hash/examples/golden.rs` 实际产出，
// TS 侧逐字节比对。两边任何一边改了口径而没改另一边，这条会红。
//
// 口径：FNV-1a 32 / CRC-32-IEEE，按 UTF-8 字节参与计算。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, crc32Hex, fnv1a32, fnv1a32Hex, fnv1a32Str, fnv1a32StrHex } from "../src/hash/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = resolve(HERE, "fixtures/hash-golden.json");

interface GoldenCase {
  name: string;
  utf8: string;
  fnv1a32: string;
  fnv1a32Hex: string;
  crc32: string;
  crc32Hex: string;
}

const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as { cases: GoldenCase[] };

function bytesOf(c: GoldenCase): Uint8Array {
  return new Uint8Array(c.utf8.length === 0 ? [] : c.utf8.split(",").map(Number));
}

test("golden 比对：TS 算出的 FNV-1a 与 Rust 逐位相同", () => {
  for (const c of golden.cases) {
    const bytes = bytesOf(c);
    const got = fnv1a32(bytes);
    assert.equal(
      got,
      Number(c.fnv1a32),
      `FNV-1a 不一致（${c.name}）：TS=${got} Rust=${c.fnv1a32}`,
    );
    assert.equal(fnv1a32Hex(bytes), c.fnv1a32Hex, `FNV-1a 十六进制不一致（${c.name}）`);
  }
});

test("golden 比对：TS 算出的 CRC-32 与 Rust 逐位相同", () => {
  for (const c of golden.cases) {
    const bytes = bytesOf(c);
    const got = crc32(bytes);
    assert.equal(got, Number(c.crc32), `CRC-32 不一致（${c.name}）：TS=${got} Rust=${c.crc32}`);
    assert.equal(crc32Hex(bytes), c.crc32Hex, `CRC-32 十六进制不一致（${c.name}）`);
  }
});

test("字符串按 UTF-8 字节参与计算", () => {
  assert.equal(fnv1a32Str("abc"), fnv1a32(new TextEncoder().encode("abc")));
  assert.equal(fnv1a32Str(""), fnv1a32(new Uint8Array()));
});

test("标准参考值（不依赖 golden 也能自证）", () => {
  assert.equal(fnv1a32(new TextEncoder().encode("a")), 0xe40c292c);
  assert.equal(fnv1a32(new TextEncoder().encode("foobar")), 0xbf9cf968);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

// ---- 类型守卫（2026-11-01）------------------------------------------------
//
// 为什么要守卫：`fnv1a32Hex` 这类字节版 API 收到字符串时**不报错**，
// 只因 `bytes.length` / `bytes[i]` 在 string 上也成立，就逐字符取到字符码、
// `>>> 0` 之后变成 0，于是**静默算出一个错的哈希**。
// 实测：`fnv1a32Hex("foobar")` 返回 `7f77879d`，正确值是 `bf9cf968`。
// 哈希值会进缓存键、通关记录 id、组件版本号 —— 错值比崩更难查。
//
// 所以守卫的判据不是「抛了错」，而是「**抛错，而不是给错值**」。

test("字节版 API 收到字符串必须抛错，而不是给一个错哈希", () => {
  // 守卫在位时，"取错值"这一步本身就抛错 —— 所以这里不能先取再断言，
  // 判据只能是「抛 TypeError」：守卫一旦被摘掉，这四条立刻不抛 ⇒ 用例转红。
  //
  // 守卫摘掉时它会给出的是 `7f77879d`（正确值 `bf9cf968`）——
  // 不抛异常、不写错日志，只是把错值当对值用。
  assert.throws(
    () => fnv1a32Hex("foobar" as unknown as Uint8Array),
    TypeError,
  );
  assert.throws(
    () => fnv1a32("foobar" as unknown as Uint8Array),
    TypeError,
  );
  assert.throws(
    () => crc32("123456789" as unknown as Uint8Array),
    TypeError,
  );
  assert.throws(
    () => crc32Hex("123456789" as unknown as Uint8Array),
    TypeError,
  );
});

test("守卫的报错要能指路：字符串该走哪个 API", () => {
  assert.throws(
    () => fnv1a32Hex("foobar" as unknown as Uint8Array),
    /fnv1a32StrHex/,
    "报错必须告诉调用方字符串版是 fnv1a32StrHex",
  );
  assert.throws(
    () => crc32Hex("x" as unknown as Uint8Array),
    /TextEncoder/,
    "报错必须告诉调用方先 encode",
  );
});

test("字符串版 API 收到非字符串同样抛错", () => {
  assert.throws(
    () => fnv1a32Str(new Uint8Array() as unknown as string),
    TypeError,
  );
  assert.throws(
    () => fnv1a32StrHex(undefined as unknown as string),
    TypeError,
  );
});

test("守卫没误伤：正常调用照旧", () => {
  assert.equal(fnv1a32StrHex("foobar"), "bf9cf968");
  assert.equal(fnv1a32Hex(new TextEncoder().encode("foobar")), "bf9cf968");
  assert.equal(crc32Hex(new TextEncoder().encode("123456789")), "cbf43926");
  assert.equal(fnv1a32Hex(new Uint8Array()), "811c9dc5");
});
