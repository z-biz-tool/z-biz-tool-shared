// 给 dist 里的相对 import / export 补上 `.js` 扩展名。
//
// ## 为什么需要它
//
// `tsc` 不会改写模块说明符：源码里写 `export * from './deeplink'`，
// 产物里就还是 `./deeplink`。**Vite / webpack 能容忍**（bundler 会自己解析），
// 但 **Node 的 ESM 解析器不能** —— `ERR_MODULE_NOT_FOUND`。
//
// 这个包是 `"type": "module"`，消费方可能是：
//   - Vite 应用（能跑，但掩盖了问题）
//   - **vitest**（跑不了）
//   - Node 脚本（跑不了）
//
// 2026-10-31 踩的就是这个：aigen 装上本包后，vitest 直接
// `Cannot find module '.../dist/protocol/deeplink'`。
//
// 而这个包此前 **0 仓依赖** —— 因为它在 Node 侧根本 import 不了。
// 「名义共享层」不是没时间收敛，是技术上还没法用。
//
// ## 做法
//
// 只改**相对路径**的说明符（以 `./` 或 `../` 开头），
// 补 `.js`；已带扩展名或不是相对路径的一律不动。
//
// `.d.ts` 里同样要补 —— 否则 TS 侧的 `moduleResolution: bundler`
// 能过、`node16/nodenext` 的消费方会挂。

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

if (!statSync(dist, { throwIfNoEntry: false })) {
  console.error('✗ dist 不存在 —— 先跑 tsc 再跑这个脚本');
  process.exit(1);
}

/** 递归列出 dist 下所有 .js / .d.ts 文件。 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.js') || p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * 匹配相对模块说明符。
 *
 * 只认引号紧贴 `./` `../` 的形式，避免误伤字符串字面量里的内容。
 * 捕获组 1 = 说明符，捕获组 2 = 结尾引号。
 */
const SPECIFIER = /(['"])(\.\.?\/[^'"]*?)\1/g;

/** 说明符是否已经有可用的扩展名。 */
function hasExtension(spec) {
  const last = spec.split('/').pop() ?? '';
  return /\.[a-zA-Z0-9]+$/.test(last);
}

/**
 * 说明符指向的是一个**目录**（如 `./ai` → `./ai/index.js`）。
 *
 * 这种情况不能补 `.js` —— 补了会变成 `./ai.js`，而实际文件是 `./ai/index.js`。
 */
function isDirectory(spec) {
  const abs = resolve(dirname(currentFile), spec);
  return statSync(abs, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

let changed = 0;
/** 当前正在改写的文件 —— isDirectory 要用它算绝对路径。 */
let currentFile = '';
const files = walk(dist);
for (const file of files) {
  currentFile = file;
  const src = readFileSync(file, 'utf8');
  const out = src.replace(SPECIFIER, (m, quote, spec) => {
    if (hasExtension(spec)) return m;
    if (isDirectory(spec)) return `${quote}${spec}/index.js${quote}`;
    return `${quote}${spec}.js${quote}`;
  });
  if (out !== src) {
    writeFileSync(file, out);
    changed += 1;
  }
}

console.log(`✓ 补扩展名：${changed} / ${files.length} 个产物文件被改写`);
