// 设计令牌的契约回归（无 React、无 DOM）。
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 这一层测的不是"函数返回了某个字符串"（那是恒真断言），而是
// **设计系统内部的自洽性**：间距是不是递增的、断点是不是升序、
// 组件样式引用的令牌是不是真的存在。常量写错不会有任何编译错误，
// 只会渲染出一套看起来不对的界面。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOW,
  TRANSITION,
  BREAKPOINTS,
} from "../src/styles/designTokens.ts";
import {
  hoverBackground,
  backgroundGradient,
} from "../src/shared/designTokens.ts";

/* ------------------------------------------------------------------ *
 * 令牌自身的取值合法性
 * ------------------------------------------------------------------ */

test("SPACING：值必须随档位单调递增", () => {
  const values = Object.values(SPACING) as unknown as number[];
  assert.ok(values.length >= 3, `SPACING 档位过少（${values.length}），正则可能已失效`);
  for (let i = 1; i < values.length; i++) {
    assert.ok(
      values[i] > values[i - 1],
      `SPACING 第 ${i} 档没有比上一档大: ${values[i - 1]} -> ${values[i]}（${Object.keys(SPACING).join(",")}）`,
    );
  }
});

test("BORDER_RADIUS：全是非负数、随档位递增，且含一个胶囊档", () => {
  // 注意：这套令牌**没有 0（直角）档**，最小是 sm=4 —— 第一版断言写了
  // "必须含 0"，实测才发现它压根不存在。断言要照真实设计写，不要照想当然写。
  const entries = Object.entries(BORDER_RADIUS) as [string, number][];
  const values = entries.map(([, v]) => v);
  for (const [k, v] of entries) {
    assert.ok(Number.isFinite(v) && v >= 0, `BORDER_RADIUS.${k} 非法: ${v}`);
  }
  for (let i = 1; i < values.length; i++) {
    assert.ok(
      values[i] >= values[i - 1],
      `BORDER_RADIUS 未升序: ${values[i - 1]} -> ${values[i]}（${entries.map(([k]) => k).join(",")}）`,
    );
  }
  assert.ok(values.some((v) => v >= 9999), "应含一个 full（胶囊/圆形）档");
});

test("FONT_SIZE：正数且单调递增", () => {
  const values = Object.values(FONT_SIZE) as unknown as number[];
  for (const v of values) {
    assert.ok(v > 0, `字号必须为正: ${v}`);
  }
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] >= values[i - 1], `字号第 ${i} 档回退了: ${values[i - 1]} -> ${values[i]}`);
  }
});

test("FONT_WEIGHT：只用合法的 CSS 数值字重", () => {
  const legal = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  for (const [k, v] of Object.entries(FONT_WEIGHT)) {
    assert.ok(legal.has(v as number), `FONT_WEIGHT.${k} = ${v} 不是合法 CSS 字重`);
  }
});

test("BREAKPOINTS：按升序排列（倒序会让媒体查询逐条失效且无人察觉）", () => {
  const values = Object.values(BREAKPOINTS) as unknown as number[];
  for (let i = 1; i < values.length; i++) {
    assert.ok(
      values[i] >= values[i - 1],
      `BREAKPOINTS 未升序: ${values[i - 1]} -> ${values[i]}（${Object.keys(BREAKPOINTS).join(",")}）`,
    );
  }
});

test("COLORS：所有值都得是合法 CSS 颜色字面量", () => {
  // COLORS 是**扁平映射**：{ 令牌名: "颜色字符串" }，值本身就是字符串。
  // 第一版多套了一层 Object.entries，把字符串当可迭代对象逐字符拆开，
  // 于是报出 primary.0="#" 这种莫名其妙的"不匹配"。值就是值，别再解一层。
  const re = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-zA-Z]+)$/;
  const entries = Object.entries(COLORS);
  assert.ok(entries.length >= 20, `颜色令牌只有 ${entries.length} 个，正则或结构可能变了`);
  for (const [k, v] of entries) {
    assert.equal(typeof v, "string", `COLORS.${k} 不是字符串而是 ${typeof v}`);
    assert.match(v as string, re, `COLORS.${k} = "${v}" 不是可识别的 CSS 颜色`);
  }
});

test("COLORS：每个语义色的 Light/Dark 变体都在", () => {
  // 少一个 Dark 变体，引用它的组件在深色模式下会拿到 undefined，
  // 表现为整块样式塌掉 —— 编译期完全看不出来。
  for (const base of ["primary", "accent", "success", "warning", "error", "info"]) {
    for (const suffix of ["", "Light", "Dark"]) {
      const key = `${base}${suffix}`;
      assert.ok(
        key in COLORS,
        `COLORS 缺 ${key} —— 引用它的深色/浅色模式会塌`,
      );
    }
  }
});

test("SHADOW / TRANSITION：非空且是字符串", () => {
  for (const [k, v] of Object.entries(SHADOW)) {
    assert.ok(typeof v === "string" && v.trim().length > 0, `SHADOW.${k} 为空或非字符串`);
  }
  for (const [k, v] of Object.entries(TRANSITION)) {
    assert.ok(typeof v === "string" && v.trim().length > 0, `TRANSITION.${k} 为空或非字符串`);
  }
});

/* ------------------------------------------------------------------ *
 * 辅助函数
 * ------------------------------------------------------------------ */

test("hoverBackground：默认走浅色，显式传参才切深色", () => {
  // 默认值是 false —— 忘传参会得到浅色而不是 undefined，这是有意设计。
  assert.equal(hoverBackground(), hoverBackground(false));
  assert.notEqual(hoverBackground(true), hoverBackground(false), "深浅两套必须不同");
});

test("backgroundGradient：默认走浅色渐变，且两种模式都非空", () => {
  assert.equal(backgroundGradient(), backgroundGradient(false));
  const light = backgroundGradient(false);
  const dark = backgroundGradient(true);
  assert.ok(light.trim().length > 0);
  assert.ok(dark.trim().length > 0);
  assert.notEqual(light, dark, "深浅两套渐变必须不同");
});
