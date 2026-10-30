// 产物可导入性闸门：**每个 exports 子路径都要能被 Node 真的 import 一次**。
//
// ## 为什么需要它
//
// `check-dist.mjs` 只检查「文件在不在」。但 0.1.0 ~ 0.1.2 三个版本
// 文件全在、闸门全绿，**包在 Node 侧却一个模块都 import 不了** ——
// 因为产物里的相对说明符没有 `.js` 扩展名。
//
// 于是：Vite 应用能跑（bundler 会自己解析）⇒ 看起来没问题；
// vitest / Node 脚本直接 `ERR_MODULE_NOT_FOUND` ⇒ 消费方根本用不了。
// 而这个包此前 0 仓依赖 —— 「名义共享层」不是没时间收敛，是技术上没法用。
//
// 「文件存在」和「能被 import」是两件事。这里守后者。
//
// ## 怎么守
//
// 用子进程 `import()` 每个子路径。子进程是必须的 —— 同一个进程里
// import 失败会污染模块缓存，后续的 import 会拿到半初始化状态。

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const subpaths = Object.keys(pkg.exports || {});
if (subpaths.length === 0) {
  console.error('✗ package.json 没有 exports —— 闸门无从谈起');
  process.exit(1);
}

const failed = [];

for (const subpath of subpaths) {
  const entry = pkg.exports[subpath].default;
  const abs = resolve(root, entry);
  if (!existsSync(abs)) {
    failed.push(`${subpath}: 文件不存在 ${entry}`);
    continue;
  }

  // 子进程里 import，出错信息才完整（不会污染本进程的模块缓存）。
  try {
    execFileSync(
      process.execPath,
      ['-e', `import(${JSON.stringify(pathToFileURL(abs).href)}).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})`],
      { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
    );
  } catch (e) {
    const detail = (e.stderr || e.message || '').trim().split('\n').slice(0, 3).join(' | ');
    failed.push(`${subpath}: ${detail}`);
  }
}

if (failed.length) {
  console.error(`✗ 产物无法被 Node import（${failed.length}/${subpaths.length} 项）：`);
  for (const f of failed) console.error(`    ${f}`);
  console.error('  常见原因：相对说明符缺 .js 扩展名 —— 跑 npm run fix-dist-ext。');
  process.exit(1);
}

console.log(`✓ 产物可导入：${subpaths.length} 个 exports 子路径全部能被 Node import`);
