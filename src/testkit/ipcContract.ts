/**
 * 契约测试的公共件：让各仓的「前端 invoke ⇄ Rust 命令」门禁能认出
 * **经由共享层消费**的命令。
 *
 * ## 为什么需要这个
 *
 * 2026-10-31 起，深链接收侧改用共享层（`startDeepLinkReceiver`）。
 * 取队列的 `invoke` **发生在共享层内部**，各仓源码里扫不到那个调用点。
 *
 * 于是各仓的门禁会把 `zbiz_take_pending` 判成「实现了却没人用」。
 * **门禁失灵比测试挂掉更严重**：误报久了大家就会把命令塞进「预留未接线」清单，
 * 门禁就名存实亡了。
 *
 * 修法如果让每个仓各写一遍，又回到「私有副本」的老路 ——
 * 而且每份副本都会漂移（有的仓改了、有的没改）。
 *
 * 所以这份清单放在共享层，各仓直接用。
 *
 * ## 两类「扫不到」
 *
 * 1. **命令名是常量**：前端把 `invoke("zbiz_take_pending")` 提成
 *    `invoke(ZBIZ_TAKE_PENDING)`（为的是拼错能编译期报错）。
 *    只认字面量的扫描器会漏掉它。
 * 2. **调用发生在共享层内部**：共享层替各仓调了这条命令。
 *
 * ## 用法
 *
 * ```ts
 * import {
 *   collectSharedConsumedCommands,
 *   collectCmdConstants,
 * } from "z-biz-tool-shared/testkit";
 *
 * const sharedConsumed = collectSharedConsumedCommands(sourceFiles);
 * const cmdConstants = collectCmdConstants(sourceFiles);
 * // 然后把 sharedConsumed 并进「被调用过的命令」集合
 * ```
 */

/* ------------------------------------------------------------------ *
 * 依赖
 * ------------------------------------------------------------------ */

import { readFileSync } from "node:fs";

/* ------------------------------------------------------------------ *
 * 共享层消费的命令清单
 * ------------------------------------------------------------------ */

/**
 * 共享层各模块内部调用了哪些 Rust 命令。
 *
 * key = 共享层模块的导出名；value = 它内部调用的 Rust 命令。
 *
 * **这份表是「共享层 ↔ Rust」之间的契约** ——
 * 共享层改了调用方式（比如不再调某条命令），这里要同步改，
 * 否则各仓的门禁会继续以为那条命令被消费着。
 */
export const SHARED_CONSUMED_COMMANDS: Record<string, readonly string[]> = {
  /** 深链接收侧：取队列。 */
  startDeepLinkReceiver: ["zbiz_take_pending"],
};

/* ------------------------------------------------------------------ *
 * 扫描器
 * ------------------------------------------------------------------ */

/**
 * 收集「命令名常量」：`export const ZBIZ_TAKE_PENDING = "zbiz_take_pending"`。
 *
 * 为什么要认常量：前端把命令名提成常量，是为了让拼错在**编译期**就报错。
 * 若扫描器只认字面量，就得让前端退回 `invoke("zbiz_take_pending")` ——
 * 那样拼错**编译期也发现不了**，常量就白提了。
 */
export function collectCmdConstants(files: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  const re = /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*["']([a-z_]+)["']/g;
  for (const f of files) {
    const txt = readFileSync(f, "utf8");
    for (const m of txt.matchAll(re)) {
      map.set(m[1], m[2]);
    }
  }
  return map;
}

/**
 * 本仓通过共享层消费掉的 Rust 命令。
 *
 * 判据：本仓源码里 import 了共享层的协议子路径。
 * 「import 了」是**足够强**的证据 —— 不用去解析调用点，
 * 也不用共享层暴露运行时信息。
 *
 * @param files   本仓源文件列表
 * @param sharedPath 共享层子路径（默认 `z-biz-tool-shared/protocol`）
 */
export function collectSharedConsumedCommands(
  files: readonly string[],
  sharedPath = "z-biz-tool-shared/protocol",
): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`from\\s+["']${escapeRe(sharedPath)}["']`);
  for (const f of files) {
    const txt = readFileSync(f, "utf8");
    if (!re.test(txt)) continue;
    for (const cmds of Object.values(SHARED_CONSUMED_COMMANDS)) {
      for (const c of cmds) out.add(c);
    }
  }
  return out;
}

/** 正则里的特殊字符要转义（路径里有 `-` 和 `/`，`-` 在字符类外是安全的，但统一处理更稳）。 */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
