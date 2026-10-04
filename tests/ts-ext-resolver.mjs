// 加载期补 .ts 扩展名。
//
// src/shortcuts/shortcutManager.ts 内部写的是 `from './types'`（无 .ts），
// 这是 TS + bundler 的正常写法，Node 的 ESM 解析器却要求显式扩展名。
// 既有 tests/*.test.ts 没撞上，是因为它们 import 的模块没有内部相对 import。
//
// 为什么在加载期解决、而不是给源码加 .ts 后缀：后者会牵动 tsconfig、
// vite 构建与 tsc --noEmit 的整条解析路径，属于为迁就测试而改产品代码。
// 这里用 resolve 钩子只影响 Node 的加载，源码一个字不动。
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (!specifier.startsWith('.') || !context.parentURL) throw err;
    // 只对「相对路径 + 没有已知扩展名」补后缀
    if (/\.[cm]?[jt]sx?$|\.json$|\.css$|\.node$/.test(specifier)) throw err;
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const candidate = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
    throw err;
  }
}
