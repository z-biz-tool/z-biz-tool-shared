/**
 * antd v6 静态 API 守卫（shared 包）。
 *
 * ## 为什么 shared 仓要自己守一遍
 *
 * 家族里十个仓的 AI 配置面板现在**共用** `z-biz-tool-shared/ai/settings`
 * 这一个实现。任何仓自己的守卫都扫不到它（它在 node_modules 里），
 * 于是统一面板里如果用了 antd v6 已废弃的旧名，十个仓一起用旧名，
 * 而**没有一个仓的 CI 会红** —— 这正是「守卫覆盖不到真源」的典型盲区。
 *
 * 修法是把守卫建在**真源所在的地方**：面板在 shared 里，守卫就在 shared 里。
 *
 * ## 钉的是什么
 *
 * v6 把 `Alert.message` / `Space.direction` / `Modal.destroyOnClose` 等标了
 * `@deprecated`。用旧名不会坏，但每次挂载都往控制台写一条警告；
 * 而 `destroyOnClose` 的语义已经不等价（v6 里 Modal 关闭后节点留在 DOM 里）。
 *
 * 断言只钉「不许再用旧名」+「替代名确实存在」，
 * **不钉数量** —— 数量会随功能增删漂移，漂了就等于逼着人改断言而不是改代码。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./_strip_comments";

let pass = 0;
let fail = 0;
const fails: string[] = [];

function ok(name: string, cond: boolean) {
  if (cond) pass += 1;
  else {
    fail += 1;
    fails.push(name);
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk("src");
const sources = files.map((f) => ({ f, src: readFileSync(f, "utf8") }));

/**
 * v6 废弃的 API → 替代名。
 *
 * 每一项都必须写明替代名，并在下面断言替代名确实被用上了 ——
 * 只禁旧名而不验新名，等于允许有人把属性删掉（组件照样渲染，
 * 表现是「少了个标题」而不是「报错」，没人会当成 bug 报上来）。
 */
const DEPRECATED: [string, RegExp, string][] = [
  ["Alert message（应为 title）", /<Alert[^>]*?\bmessage=/s, "title"],
  ["Space direction（应为 orientation）", /<Space[^>]*\bdirection=/s, "orientation"],
  ["Modal destroyOnClose（应为 destroyOnHidden）", /\bdestroyOnClose\b/, "destroyOnHidden"],
  ["Modal maskClosable（应为 mask.closable）", /\bmaskClosable\b/, "mask"],
  ["Modal bodyStyle / maskStyle（应为 styles）", /\b(bodyStyle|maskStyle)=/, "styles"],
  ["Modal visible（应为 open）", /\bvisible=\{/, "open"],
  ["Spin tip（应为 description）", /<Spin[^>]*\btip=/s, "description"],
  ["Divider type（应为 orientation）", /<Divider[^>]*\btype=/, "orientation"],
  ["Tabs onPrevClick/onNextClick", /\b(onPrevClick|onNextClick)=/, ""],
];

for (const [name, re] of DEPRECATED) {
  const hits = sources.filter((s) => re.test(stripComments(s.src))).map((s) => s.f);
  ok(`没有 ${name} 的用法（命中 ${hits.join(", ") || "无"}）`, hits.length === 0);
}

const all = sources.map((s) => stripComments(s.src)).join("\n");

// 替代名确实存在 —— 防「把属性删掉」这种假绿。
// 只有面板真的用到某个组件时才断言对应替代名。
const REPLACEMENTS: [string, RegExp][] = [
  ["Alert 用上了 title", /<Alert[\s\S]{0,400}?\btitle=/],
  ["Space 用上了 orientation", /<Space[^>]*\borientation=/],
];
for (const [name, re] of REPLACEMENTS) {
  ok(name, re.test(all));
}

// 统一面板必须真的用了 Alert 与 Space —— 否则上面两条断言会因
// 「压根没用过」而恒真（假绿）。
const panel = readFileSync("src/ai/settings/AiSettingsPanel.tsx", "utf8");
ok("统一面板里确实有 Alert", /<Alert[\s\S]{0,400}?\btitle=/.test(panel));
ok("统一面板里确实有 Space", /<Space/.test(panel));
// 统一面板用了纵向 Space ⇒ 必须用 orientation 这个新名
ok("统一面板的纵向 Space 用的是 orientation", /<Space[^>]*\borientation="vertical"/.test(panel));

console.log(`\n[antd-v6-apis] PASS ${pass} / FAIL ${fail}`);
if (fail) {
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
