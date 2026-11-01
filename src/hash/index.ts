/**
 * 哈希原语的 TS 孪生 —— 金标是 Rust `cap-hash`。
 *
 * ## 为什么 TS 侧也有一份实现
 *
 * 能力层（`z-biz-tool-capability`）是 Rust 的，前端不能同步调它；
 * 但内容哈希要在浏览器里算（组件版本、通关记录 id）。
 * 于是同一个算法在两侧各有一份实现 —— 这正是"跨语言漂移"的高发区：
 * 一边改了口径，另一边不知道，同一份内容在两个仓里对不上。
 *
 * 所以这里的规矩和 `protocol/deeplink.ts` 一样：
 * **一份 canonical + 一份 golden 样本逐字节比对**，改一边必须改另一边。
 *
 * ## 口径（必须与 Rust `cap-hash` 完全一致）
 *
 * - FNV-1a 32：offset `0x811c9dc5`、prime `0x01000193`、**按字节**混合；
 * - CRC-32/IEEE：反射多项式 `0xEDB88320`、init/末尾异或 `0xFFFFFFFF`。
 * - 字符串按 **UTF-8 字节**参与计算（`TextEncoder`）。
 *
 * ⚠️ 迁移注意：家族里几处历史 TS 实现按 **UTF-16 码元**混合 FNV。
 * ASCII 输入两者相同；含非 ASCII 的输入结果不同 —— 换过来是**已知口径变更**，
 * 不是 bug，但要让使用方知道（见 `z-biz-tool-capability/crates/cap-hash/EVIDENCE.md`）。
 */

/** FNV-1a 32 位的 offset basis */
export const FNV1A_32_OFFSET = 0x811c9dc5;
/** FNV-1a 32 位的 prime */
export const FNV1A_32_PRIME = 0x01000193;
/** CRC-32/IEEE 的反射多项式 */
export const CRC32_IEEE_POLY = 0xedb88320;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? CRC32_IEEE_POLY ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

const encoder = new TextEncoder();

/**
 * 类型守卫：字节版 API 必须收 Uint8Array。
 *
 * 为什么要它：JS 的 `Uint8Array` 与 `string` 在 `bytes.length` / `bytes[i]` 上
 * 长得几乎一样 —— 把字符串传进字节版函数**不报错**，只是逐字符取到的是字符码，
 * `^= bytes[i]` 后 `>>> 0` 变成 0，于是**静默算出一个错的哈希**。
 *
 * 2026-11-01 实测：`fnv1a32Hex("foobar")` 返回 `7f77879d`，而正确值是
 * `bf9cf968` —— 不抛异常、不写错日志，只是把错值当对值用。
 * 哈希值会进缓存键、通关记录 id、组件版本号，错值比崩更难查。
 */
function assertBytes(value: unknown, fn: string, strHint: string): asserts value is Uint8Array {
  if (value instanceof Uint8Array) return;
  const got = value === null ? "null" : typeof value;
  throw new TypeError(
    typeof value === "string"
      ? `${fn} 需要 Uint8Array；收到 string。${strHint}`
      : `${fn} 需要 Uint8Array；收到 ${got}`,
  );
}

/** 类型守卫：字符串版 API 必须收 string。 */
function assertText(value: unknown, fn: string): asserts value is string {
  if (typeof value === "string") return;
  throw new TypeError(`${fn} 需要 string；收到 ${value === null ? "null" : typeof value}`);
}

/** FNV-1a 32 位哈希：字节进 → 数值出 */
export function fnv1a32(bytes: Uint8Array): number {
  assertBytes(bytes, "fnv1a32", "字符串请用 fnv1a32Str（按 UTF-8 字节）");
  let h = FNV1A_32_OFFSET;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV1A_32_PRIME) >>> 0;
  }
  return h >>> 0;
}

/** FNV-1a 32 位哈希（字符串按 UTF-8 字节） */
export function fnv1a32Str(text: string): number {
  assertText(text, "fnv1a32Str");
  return fnv1a32(encoder.encode(text));
}

/** FNV-1a 32 位哈希的 8 位小写十六进制（补零） */
export function fnv1a32Hex(bytes: Uint8Array): string {
  assertBytes(bytes, "fnv1a32Hex", "字符串请用 fnv1a32StrHex（按 UTF-8 字节）");
  return fnv1a32(bytes).toString(16).padStart(8, "0");
}

/** FNV-1a 32 位哈希的 8 位小写十六进制（字符串按 UTF-8 字节） */
export function fnv1a32StrHex(text: string): string {
  assertText(text, "fnv1a32StrHex");
  return fnv1a32Str(text).toString(16).padStart(8, "0");
}

/** CRC-32/IEEE：字节进 → 数值出 */
export function crc32(bytes: Uint8Array): number {
  assertBytes(bytes, "crc32", "字符串请先 new TextEncoder().encode(text) 再传字节");
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** CRC-32/IEEE 的 8 位小写十六进制（补零） */
export function crc32Hex(bytes: Uint8Array): string {
  assertBytes(bytes, "crc32Hex", "字符串请先 new TextEncoder().encode(text) 再传字节");
  return crc32(bytes).toString(16).padStart(8, "0");
}
