// 产物完整性闸门：package.json 的每个 exports 子路径都必须真的存在 .js + .d.ts。
// 0.1.1 就是靠 tsc 增量状态跳过 emit，把只有 tsbuildinfo 的空 dist 发上了 npm。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const missing = [];
for (const [subpath, map] of Object.entries(pkg.exports || {})) {
  for (const kind of ['types', 'default']) {
    const rel = map[kind];
    if (!rel) continue;
    if (!existsSync(resolve(root, rel))) missing.push(`${subpath} -> ${rel}`);
  }
}

if (missing.length) {
  console.error(`✗ 构建产物不完整（${missing.length} 项）：`);
  for (const m of missing) console.error(`    ${m}`);
  console.error('  先跑 npm run build（它会清 dist 再全量 emit），别把空包发出去。');
  process.exit(1);
}
console.log(`✓ 产物完整：${Object.keys(pkg.exports).length} 个 exports 子路径全部有 .js + .d.ts`);
