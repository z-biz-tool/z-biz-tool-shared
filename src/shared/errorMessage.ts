// 错误消息归一（纯逻辑，无 React、无 DOM 依赖）
//
// 为什么需要它：`catch (error: any)` 里直接写 `error.message` 有两个问题：
//   1. 抛出的可能不是 Error（比如 `throw '字符串'` 或 `throw { code: 500 }`），
//      此时 `error.message` 是 undefined，文案变成 "系统错误: undefined" ——
//      用户看到一句没有信息量的提示；
//   2. 写 `catch (error: any)` 会把 any 带进公共 API 面（01 A-13），
//      strict 模式下 catch 参数默认就是 unknown，用 unknown 反而更诚实。
//
// 放在 .ts 而不是 .tsx 的原因同 theme/themeMode.ts：
//   node --experimental-strip-types 不转译 JSX，.tsx 没法被测试 import。

/**
 * 从任意抛出物里取出可读的消息。
 *
 * - Error 实例 → 用它的 message；
 * - 字符串 → 直接用；
 * - 带 message 字段的对象 → 用它的 message；
 * - 其它 → 走 fallback。
 */
export function errorMessage(error: unknown, fallback = '未知错误'): string {
  if (error instanceof Error) {
    return error.message || error.name || fallback;
  }
  if (typeof error === 'string') {
    return error || fallback;
  }
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) {
      return message;
    }
  }
  return fallback;
}
