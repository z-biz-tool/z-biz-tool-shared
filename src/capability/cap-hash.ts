// cap-hash 命令契约（z-biz-tool-capability crates/cap-hash 0.1.0）。
//
// 矩阵规划 03 §4.2：shared 只放契约，不放实现。本文件只描述 Rust 侧
// cap-hash 的调用面；实现落在 `z-biz-tool-capability`，消费方在 Tauri 后端的
// `#[tauri::command]` 薄壳里调用 Rust 后再透传给前端。
//
// 文件命名约定：Rust 侧 snake_case，前端侧 camelCase（如 crc32_ieee → computeCrc32）。

/** FNV-1a 32 位哈希的 8 位小写十六进制（补零） */
export interface HashDigest {
  /** 8 位小写十六进制，如 `"e40c292c"` */
  hex: string;
  /** 32 位无符号数值 */
  value: number;
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * 哈希是纯字节计算：入参是字节，出参是一个数。
 * 大文件请用 Rust 侧的流式 `Crc32`（薄壳里分块喂字节），不要把整文件读进前端。
 */
export interface CapHashCommands {
  /** FNV-1a 32 位哈希（字节进 → 数值出） */
  computeFnv1a32: { args: { bytes: number[] }; returns: HashDigest };
  /** FNV-1a 32 位哈希（字符串按 UTF-8 字节） */
  computeFnv1a32OfText: { args: { text: string }; returns: HashDigest };
  /** CRC-32/IEEE 哈希（字节进 → 数值出） */
  computeCrc32: { args: { bytes: number[] }; returns: HashDigest };
}

/**
 * ⚠️ 口径说明：FNV-1a 按 **UTF-8 字节**混合。
 * 家族里几处历史 TS 实现按 UTF-16 码元混合 —— ASCII 输入两者相同，
 * 含非 ASCII 的输入结果不同。换口径是有意的，不是 bug。
 */
export const CapHashNotes = {
  /** 字节口径：字符串先按 UTF-8 编码再逐字节混合 */
  ByteBasis: "按 UTF-8 字节计算；历史 TS 实现的 UTF-16 码元口径在非 ASCII 输入上结果不同",
} as const;
