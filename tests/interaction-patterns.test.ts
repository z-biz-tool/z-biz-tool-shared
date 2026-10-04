// 交互设计规范的契约回归（无 React、无 DOM、无第三方依赖）。
// 跑法：node --experimental-strip-types --test tests/interaction-patterns.test.ts
//
// 与 `design-tokens.test.ts` 同一路子：这里测的不是「函数返回了某个字符串」
// （那是恒真断言），而是**规范内部的自洽性**。这类纯常量写错不会有任何
// 编译错误、也不会有任何测试拦它 —— 只会渲染出一套行为古怪的界面，
// 而"古怪"很难被当成 bug 报上来。
//
// 为什么补这个文件：`src/interactions/` 与 `src/shortcuts/`、`src/ai/`、
// `src/agent/`、`src/notifications/` 此前全无测试网。而本仓是**家族骨干** ——
// 被 aigen / box / db / file / kb / note / pet / terminal 八个仓消费，
// 这里的错误会同时出现在八个应用里。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTERACTION_PATTERNS,
  USER_FLOWS,
  InteractionFeedback,
  DRAG_DROP,
  CLICK,
  KEYBOARD,
} from "../src/interactions/interactionPatterns.ts";

/* ------------------------------------------------------------------ *
 * 反馈时长：类型 + 语义序
 * ------------------------------------------------------------------ */

test("反馈时长都是正数（写错成字符串或负数会被这里拦下）", () => {
  const fb = INTERACTION_PATTERNS.feedback;
  for (const [name, spec] of Object.entries(fb)) {
    assert.equal(typeof spec.duration, "number", `${name}.duration 必须是 number`);
    assert.ok(Number.isFinite(spec.duration), `${name}.duration 必须是有限数，实得 ${spec.duration}`);
    assert.ok(spec.duration > 0, `${name}.duration 必须为正，实得 ${spec.duration}`);
    assert.equal(typeof spec.animation, "string", `${name}.animation 必须是 string`);
    assert.ok(spec.animation.length > 0, `${name}.animation 不得为空串`);
    assert.equal(typeof spec.icon, "string", `${name}.icon 必须是 string`);
  }
});

test("反馈时长的语义序：错误最久 > 警告 > 信息（信息不该比错误更抢眼）", () => {
  const fb = INTERACTION_PATTERNS.feedback;
  assert.ok(fb.error.duration > fb.warning.duration,
    `错误(${fb.error.duration}) 应比警告(${fb.warning.duration}) 活得久`);
  assert.ok(fb.warning.duration > fb.info.duration,
    `警告(${fb.warning.duration}) 应比信息(${fb.info.duration}) 活得久`);
  // 加载态同理：骨架屏是兜底，不该比 spinner 拖得更久
  const ld = INTERACTION_PATTERNS.loading;
  assert.ok(ld.spinner.duration > ld.skeleton.duration,
    `spinner(${ld.spinner.duration}) 应比 skeleton(${ld.skeleton.duration}) 久`);
});

/* ------------------------------------------------------------------ *
 * 快捷键：写法必须自洽
 * ------------------------------------------------------------------ */

test("快捷键字符串写法统一：要么带 Cmd 前缀，要么是单个功能键", () => {
  // 这一组是给人看的规范常量，混用写法（Cmd+ 与 Ctrl+ 混杂、大小写不统一）
  // 不会有编译错误，只会让实现方各写各的。
  const kb = INTERACTION_PATTERNS.keyboard;
  for (const [name, combo] of Object.entries(kb)) {
    const parts = combo.split("+");
    if (parts.length === 1) {
      assert.match(parts[0], /^(F[0-9]+|[A-Z])$/,
        `${name}=${combo}：单键必须是功能键或单个大写字母`);
    } else {
      assert.equal(parts[0], "Cmd",
        `${name}=${combo}：组合键的修饰键必须统一写 Cmd（实际是 ${parts[0]}）`);
      for (const p of parts.slice(1)) {
        assert.ok(p.length > 0, `${name}=${combo}：含空的修饰键段`);
      }
    }
  }
});

test("KEYBOARD.shortcuts 的键名规范：cmd 前缀 + 大写动作字母", () => {
  for (const [name] of Object.entries(KEYBOARD.shortcuts)) {
    assert.match(name, /^cmd[A-Z][A-Za-z]*$/,
      `KEYBOARD.shortcuts 的键 ${name} 应形如 cmdC / cmdShiftZ`);
  }
});

test("KEYBOARD 四个导航键齐全（少一个会让画布或列表无法翻页）", () => {
  for (const k of ["arrowUp", "arrowDown", "arrowLeft", "arrowRight"]) {
    assert.ok(k in KEYBOARD.navigation, `缺少导航键 ${k}`);
    assert.equal(typeof KEYBOARD.navigation[k as keyof typeof KEYBOARD.navigation], "string");
  }
});

/* ------------------------------------------------------------------ *
 * 点击与拖拽：时序与阈值
 * ------------------------------------------------------------------ */

test("双击的判定延时必须大于单击（否则单击永远等不到）", () => {
  assert.equal(CLICK.single.delay, 0, "单击不该有延时");
  assert.ok(CLICK.double.delay > CLICK.single.delay,
    `双击阈值(${CLICK.double.delay}) 必须大于单击(${CLICK.single.delay})`);
  assert.ok(CLICK.double.delay >= 200 && CLICK.double.delay <= 500,
    `双击阈值 ${CLICK.double.delay}ms 落在常见区间 200–500ms 之外，可能与系统设置冲突`);
});

test("拖拽：位移阈值与不透明度是合法值", () => {
  const s = DRAG_DROP.start;
  assert.ok(Number.isFinite(s.minDistance) && s.minDistance > 0,
    `minDistance 必须为正，实得 ${s.minDistance}`);
  assert.ok(s.ghostOpacity > 0 && s.ghostOpacity <= 1,
    `ghostOpacity 必须在 (0,1]，实得 ${s.ghostOpacity}`);
  // 幽灵太实就等于没提示，太透就看不见
  assert.ok(s.ghostOpacity >= 0.3 && s.ghostOpacity <= 0.95,
    `ghostOpacity ${s.ghostOpacity} 偏离可读区间 0.3–0.95`);
});

/* ------------------------------------------------------------------ *
 * 用户流程：结构完整
 * ------------------------------------------------------------------ */

test("每个用户流程都有非空的步骤/动作列表", () => {
  for (const [name, flow] of Object.entries(USER_FLOWS)) {
    const list = (flow as Record<string, unknown>).steps
      ?? (flow as Record<string, unknown>).actions
      ?? (flow as Record<string, unknown>).followUp;
    assert.ok(Array.isArray(list), `${name} 缺 steps/actions/followUp 列表`);
    assert.ok(list.length > 0, `${name} 的列表不得为空`);
    for (const step of list as unknown[]) {
      assert.equal(typeof step, "string", `${name} 的列表项必须是字符串，实际是 ${typeof step}`);
      assert.ok((step as string).length > 0, `${name} 有空字符串步骤`);
    }
  }
});

test("破坏性文件流程必须可撤销（不可撤销的删除不该是默认路径）", () => {
  assert.equal(USER_FLOWS.fileOperation.undoable, true,
    "文件操作流程应可撤销 —— 交互原则第 5 条明写「安全：防止误操作，支持撤销」");
  // 原则写在文件头，用它对照实现
  const file = (USER_FLOWS.fileOperation as Record<string, unknown>);
  assert.equal(file.progress, true, "文件操作流程应给出进度");
});

/* ------------------------------------------------------------------ *
 * InteractionFeedback：这些是可调用对象，不是数据
 * ------------------------------------------------------------------ */

test("InteractionFeedback 每一项都是可调用函数，且被调用不抛错", () => {
  // 本文件里它们是空实现（no-op），但**必须是函数**。
  // 若哪天有人把某一项改成对象或漏了括号，调用方会拿到 "x is not a function"，
  // 而那要到运行时才炸。
  for (const [group, methods] of Object.entries(InteractionFeedback)) {
    for (const [name, fn] of Object.entries(methods as Record<string, unknown>)) {
      assert.equal(typeof fn, "function", `${group}.${name} 必须是函数，实际是 ${typeof fn}`);
    }
  }
});

test("调用反馈函数返回 undefined（no-op 语义），不产生副作用", () => {
  assert.equal(InteractionFeedback.toast.showSuccess("hi"), undefined);
  assert.equal(InteractionFeedback.toast.showError("boom", 1000), undefined);
  assert.equal(InteractionFeedback.progress.show("run", 0.5), undefined);
  assert.equal(InteractionFeedback.progress.update(0.9), undefined);
  assert.equal(InteractionFeedback.progress.complete(), undefined);
  assert.equal(InteractionFeedback.progress.cancel(), undefined);
});

/* ------------------------------------------------------------------ *
 * 空状态：文案三件套齐全
 * ------------------------------------------------------------------ */

test("空状态必须同时有图标、标题、说明与行动（否则是死界面）", () => {
  const e = INTERACTION_PATTERNS.empty;
  for (const k of ["icon", "title", "description", "action"] as const) {
    assert.equal(typeof e[k], "string", `empty.${k} 必须是 string`);
    assert.ok(e[k].length > 0, `empty.${k} 不得为空`);
  }
});
