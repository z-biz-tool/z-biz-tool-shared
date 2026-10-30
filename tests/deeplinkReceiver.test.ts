/**
 * 深链接收侧通用件的测试。
 *
 * 覆盖的是**机制**（冷启动补取、事件触发、不静默吞掉、执行隔离），
 * 不是各仓的语义 —— 语义在各仓自己的仓里测。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  startDeepLinkReceiver,
  ZBIZ_TAKE_PENDING,
  type DeepLinkEffect,
  type DeepLinkReceiverOptions,
} from "../src/protocol/deeplinkReceiver.ts";
import type { Handoff } from "../src/protocol/deeplink.ts";

/* ------------------------------------------------------------------ *
 * 脚手架
 * ------------------------------------------------------------------ */

interface Harness {
  stop: () => void;
  /** 触发的深链（onEffect 收到的） */
  effects: Array<{ effect: Record<string, unknown>; item: Handoff }>;
  /** 用户看到的提示 */
  problems: string[];
  /** 队列被取了几次 */
  takeCalls: number;
  /** 手动触发事件 */
  fire: () => void;
  /** 队列里当前的内容 */
  setQueue: (items: Handoff[]) => void;
}

function makeHarness(
  overrides: Partial<DeepLinkReceiverOptions> = {},
  initial: Handoff[] = [],
): Harness {
  const effects: Harness["effects"] = [];
  const problems: string[] = [];
  let queue = initial;
  let takeCalls = 0;
  let handler: (() => void) | undefined;

  const stop = startDeepLinkReceiver({
    productId: "note",
    invoke: async () => {
      takeCalls += 1;
      // 出队即清空：取出后队列为空。
      const out = queue;
      queue = [];
      return out;
    },
    listen: async (_event, h) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
    translate: (item) => ({ ok: true, effect: { action: item.action } }),
    onProblem: (msg) => {
      problems.push(msg);
    },
    onEffect: (effect, item) => {
      effects.push({ effect, item });
    },
    ...overrides,
  });

  return {
    stop,
    effects,
    problems,
    get takeCalls() {
      return takeCalls;
    },
    fire: () => handler?.(),
    setQueue: (items) => {
      queue = items;
    },
  };
}

/** 等微任务队列排空（drain 是异步的）。 */
const tick = async () => {
  await new Promise((r) => setTimeout(r, 0));
};

/* ------------------------------------------------------------------ *
 * 测试
 * ------------------------------------------------------------------ */

test("mount 时先取一次队列 —— 冷启动那条深链不能漏", async () => {
  const h = makeHarness(
    {},
    [{ product: "note", action: "open", params: { file: "/tmp/a.md" } }],
  );
  await tick();

  assert.equal(h.takeCalls, 1, "mount 必须主动取一次");
  assert.equal(h.effects.length, 1, "冷启动的深链必须被执行");
  assert.deepEqual(h.effects[0].effect, { action: "open" });
  h.stop();
});

test("事件触发后再取一次 —— 已运行实例被二次唤起", async () => {
  const h = makeHarness();
  await tick();
  assert.equal(h.takeCalls, 1, "mount 那一次");

  h.setQueue([{ product: "note", action: "open", params: {} }]);
  h.fire();
  await tick();

  assert.equal(h.takeCalls, 2, "事件应触发一次取队列");
  assert.equal(h.effects.length, 1);
  h.stop();
});

test("发给别的产品的深链 —— 判为「不是本应用」并给可见提示", async () => {
  const h = makeHarness(
    {},
    [{ product: "aigen", action: "open", params: {} }],
  );
  await tick();

  assert.equal(h.effects.length, 0, "不该执行");
  assert.equal(h.problems.length, 1, "必须给用户提示，不能静默吞掉");
  assert.match(h.problems[0], /aigen/);
  h.stop();
});

test("translate 说接不住 —— 同样给可见提示，且不执行", async () => {
  const h = makeHarness(
    {
      translate: () => ({ ok: false, problem: "这个动作本应用不支持" }),
    },
    [{ product: "note", action: "weird", params: {} }],
  );
  await tick();

  assert.equal(h.effects.length, 0);
  assert.deepEqual(h.problems, ["这个动作本应用不支持"]);
  h.stop();
});

test("translate 说接不住但没给原因 —— 也要有提示，不能是空串", async () => {
  const h = makeHarness(
    { translate: () => ({ ok: false }) },
    [{ product: "note", action: "weird", params: {} }],
  );
  await tick();

  assert.equal(h.problems.length, 1);
  assert.ok(h.problems[0].length > 0, "提示不能是空串");
  h.stop();
});

test("translate 抛异常 —— 不让整批深链都丢掉", async () => {
  const h = makeHarness(
    {
      translate: () => {
        throw new Error("语义崩了");
      },
    },
    [
      { product: "note", action: "open", params: {} },
      { product: "note", action: "open", params: {} },
    ],
  );
  await tick();

  assert.equal(h.problems.length, 2, "两条各自给提示");
  assert.ok(h.problems.every((p) => p.includes("语义崩了")));
  h.stop();
});

test("onEffect 抛异常 —— 同样不让整批深链都丢掉", async () => {
  const h = makeHarness(
    {
      onEffect: () => {
        throw new Error("执行崩了");
      },
    },
    [
      { product: "note", action: "open", params: {} },
      { product: "note", action: "open", params: {} },
    ],
  );
  await tick();

  assert.equal(h.problems.length, 2);
  assert.ok(h.problems.every((p) => p.includes("执行崩了")));
  h.stop();
});

test("invoke 失败（无 Tauri 环境）—— 不算错误，静默返回", async () => {
  const problems: string[] = [];
  const stop = startDeepLinkReceiver({
    productId: "note",
    invoke: async () => {
      throw new Error("no tauri");
    },
    listen: async () => () => {},
    translate: () => ({ ok: true }),
    onProblem: (m) => problems.push(m),
    onEffect: () => {},
  });
  await tick();

  assert.deepEqual(problems, [], "取队列失败不该打扰用户");
  stop();
});

test("stop 之后事件不再触发处理", async () => {
  const h = makeHarness();
  await tick();
  const before = h.takeCalls;

  h.stop();
  h.fire();
  await tick();

  assert.equal(h.takeCalls, before, "停止后不该再取队列");
});

test("stop 之后再 fire 不会报错（监听已注销）", async () => {
  const h = makeHarness();
  await tick();
  h.stop();
  assert.doesNotThrow(() => h.fire());
});

test("取队列失败后仍可继续 —— 一次失败不致命", async () => {
  let calls = 0;
  const effects: unknown[] = [];
  let handler: (() => void) | undefined;
  const stop = startDeepLinkReceiver({
    productId: "note",
    invoke: async () => {
      calls += 1;
      if (calls === 1) throw new Error("第一次失败");
      return [{ product: "note", action: "open", params: {} }];
    },
    listen: async (_e, h) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
    translate: () => ({ ok: true, effect: { a: 1 } }),
    onProblem: () => {},
    onEffect: (e) => effects.push(e),
  });
  await tick();
  assert.equal(calls, 1, "首次取队列失败");

  // 失败不应把收侧「废掉」：下一次事件照常取队列。
  handler?.();
  await tick();

  assert.equal(calls, 2, "失败后应能再次取队列");
  assert.equal(effects.length, 1, "第二次取到的深链应被执行");
  stop();
});

test("同一批里多条深链 —— 全部按序执行", async () => {
  const h = makeHarness(
    {},
    [
      { product: "note", action: "open", params: { n: "1" } },
      { product: "note", action: "open", params: { n: "2" } },
      { product: "note", action: "open", params: { n: "3" } },
    ],
  );
  await tick();

  assert.equal(h.effects.length, 3);
  assert.deepEqual(
    h.effects.map((e) => e.item.params.n),
    ["1", "2", "3"],
  );
  h.stop();
});

test("effect 为空（ok 但没内容）—— 不执行也不报错", async () => {
  const h = makeHarness(
    { translate: (): DeepLinkEffect => ({ ok: true }) },
    [{ product: "note", action: "open", params: {} }],
  );
  await tick();

  assert.equal(h.effects.length, 0);
  assert.deepEqual(h.problems, []);
  h.stop();
});

test("只订阅家族统一的事件名", async () => {
  const events: string[] = [];
  const stop = startDeepLinkReceiver({
    productId: "note",
    invoke: async () => [],
    listen: async (event) => {
      events.push(event);
      return () => {};
    },
    translate: () => ({ ok: true }),
    onProblem: () => {},
    onEffect: () => {},
  });
  await tick();

  assert.deepEqual(events, ["zbiz-open"]);
  stop();
});

test("取队列的命令名是家族统一的 zbiz_take_pending", () => {
  // 这条是给**消费方的契约测试**用的锚点：
  // 各仓的「前端 invoke ⇄ Rust 命令」门禁要能认出
  // 「本仓通过共享层调用了 zbiz_take_pending」，
  // 否则共享层化之后门禁就瞎了。
  assert.equal(ZBIZ_TAKE_PENDING, "zbiz_take_pending");
});
