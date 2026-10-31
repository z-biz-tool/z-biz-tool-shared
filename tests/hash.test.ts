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
import { crc32, crc32Hex, fnv1a32, fnv1a32Hex, fnv1a32Str } from "../src/hash/index.ts";

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
