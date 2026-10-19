// 通知（toast）健壮性测试（无 React、无 DOM）
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 对应 06 验收矩阵：UT-NOTIF-01。
// 覆盖 01 A-12 的三个子问题：
//   1. toast id 用 Math.random 生成 → 碰撞会让一个 removeToast 干掉两个 toast；
//   2. setTimeout 句柄没保存 → toast 提前移除后回调仍在跑；
//   3. clearToasts 不清定时器 → 清空后每个到点的回调仍会跑一次 removeToast。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useNotificationStore, toastManager } from '../src/notifications/notificationManager.ts';

/** 每个用例前把 store 和挂起的定时器都清干净（06 §1.1 的隔离原则） */
function resetStore() {
  useNotificationStore.getState().clearToasts();
  useNotificationStore.setState({ toasts: [] });
}

/** 等待 n 毫秒（比 fake timer 少一层依赖，Node 内置 timers 足够） */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------------ 基本

test("UT-NOTIF-01 addToast 返回 id 且 toast 进入 store", () => {
  resetStore();
  const id = useNotificationStore.getState().addToast({
    type: 'success',
    message: 'ok',
  });

  assert.ok(id.length > 0);
  const toasts = useNotificationStore.getState().toasts;
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].id, id);
  assert.equal(toasts[0].message, 'ok');
});

test("UT-NOTIF-01 removeToast 只移除指定的那一条", () => {
  resetStore();
  const a = useNotificationStore.getState().addToast({ type: 'info', message: 'a' });
  const b = useNotificationStore.getState().addToast({ type: 'info', message: 'b' });

  useNotificationStore.getState().removeToast(a);

  const toasts = useNotificationStore.getState().toasts;
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].id, b);
});

test("UT-NOTIF-01 clearToasts 清空全部 toast", () => {
  resetStore();
  useNotificationStore.getState().addToast({ type: 'info', message: 'a' });
  useNotificationStore.getState().addToast({ type: 'info', message: 'b' });
  assert.equal(useNotificationStore.getState().toasts.length, 2);

  toastManager.clear();

  assert.equal(useNotificationStore.getState().toasts.length, 0);
});

// ------------------------------------------------------- id 唯一性（A-12）
// 此前 id 是 Math.random().toString(36).substring(2, 9)。碰撞概率低，
// 但**碰撞的后果不是"少一条 toast"**：两个 toast 共用 id 时，
// removeToast 会一次干掉两个。

test("A-12 连续创建的 toast id 互不相同", () => {
  resetStore();
  const ids = new Set<string>();
  for (let i = 0; i < 200; i++) {
    ids.add(useNotificationStore.getState().addToast({ type: 'info', message: `m${i}` }));
  }
  assert.equal(ids.size, 200);
  assert.equal(useNotificationStore.getState().toasts.length, 200);
});

test("A-12 toast id 是自增的，不依赖随机数（变异可判）", () => {
  resetStore();
  // **这条才是能咬住「id 改回 Math.random」的判据**。
  // 上面那条「200 次不碰撞」在随机实现下几乎必然通过 ——
  // 7 位 base36 的碰撞概率极低，判据形同虚设（变异跑批时被当场放跑）。
  //
  // 改成断言 id 的**结构**：自增计数器必然产出 toast-N 形状且 N 严格递增，
  // 随机实现产不出这个形状。
  //
  // 注意：计数器是模块级的，跨用例累积，所以不能断言具体数字，
  // 只能断言「后一个比前一个大 1」这个相对关系。
  const first = useNotificationStore.getState().addToast({ type: 'info', message: 'a' });
  const second = useNotificationStore.getState().addToast({ type: 'info', message: 'b' });
  const third = useNotificationStore.getState().addToast({ type: 'info', message: 'c' });

  const seq = (id: string) => {
    const m = /^toast-(\d+)$/.exec(id);
    assert.ok(m, `id 应是 toast-N 形状，实际是 ${id}`);
    return Number(m[1]);
  };

  assert.equal(seq(second) - seq(first), 1);
  assert.equal(seq(third) - seq(second), 1);
});

test("A-12 移除其中一条不会误伤其它同 id 风险项", () => {
  resetStore();
  const ids: string[] = [];
  for (let i = 0; i < 50; i++) {
    ids.push(useNotificationStore.getState().addToast({ type: 'info', message: `m${i}` }));
  }
  useNotificationStore.getState().removeToast(ids[10]);

  const toasts = useNotificationStore.getState().toasts;
  assert.equal(toasts.length, 49);
  assert.equal(toasts.some((t) => t.id === ids[10]), false);
  // 其余 49 条都还在
  for (const id of ids.slice(0, 10).concat(ids.slice(11))) {
    assert.equal(toasts.some((t) => t.id === id), true);
  }
});

// --------------------------------------------------- duration 默认值
// 隐藏缺陷：addToast 原本写 `{ id, duration: 3000, ...toast }`。
// toast 里 `duration: undefined`（调用方显式传了 undefined）会**覆盖**掉
// 默认的 3000 —— 于是 `if (fullToast.duration)` 为假，自动消失整个失效，
// toast 永远挂在屏幕上。toastManager 的四个方法全都传 `duration`（可能是
// undefined），所以这条路径是**默认路径**。

test("A-12 duration 传 undefined 时仍用默认 3000（不会被 undefined 吞掉）", () => {
  resetStore();
  useNotificationStore.getState().addToast({
    type: 'info',
    message: 'no duration',
    duration: undefined,
  });

  const toast = useNotificationStore.getState().toasts[0];
  assert.equal(toast.duration, 3000);
});

test("A-12 toastManager.success 不传 duration 时也落默认 3000", () => {
  resetStore();
  toastManager.success('hello');
  const toast = useNotificationStore.getState().toasts[0];
  assert.equal(toast.duration, 3000);
});

test("A-12 显式传 duration 时尊重调用方的值", () => {
  resetStore();
  useNotificationStore.getState().addToast({
    type: 'info',
    message: 'custom',
    duration: 5000,
  });
  assert.equal(useNotificationStore.getState().toasts[0].duration, 5000);
});

// --------------------------------------------------- 自动移除（UT-NOTIF-01）

test("UT-NOTIF-01 到期后 toast 自动被移除", async () => {
  resetStore();
  useNotificationStore.getState().addToast({
    type: 'info',
    message: 'auto',
    duration: 40,
  });
  assert.equal(useNotificationStore.getState().toasts.length, 1);

  await sleep(120);

  assert.equal(useNotificationStore.getState().toasts.length, 0);
});

test("A-12 duration 为 0 时不自动移除（显式要求常驻）", async () => {
  resetStore();
  useNotificationStore.getState().addToast({
    type: 'info',
    message: 'sticky',
    duration: 0,
  });

  await sleep(80);

  assert.equal(useNotificationStore.getState().toasts.length, 1);
});

/** 当前进程里挂起的定时器数量（Node 内置，无需额外依赖） */
function pendingTimers(): number {
  return process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
}

// --------------------------------------------------- 定时器句柄管理
// 此前 setTimeout 的返回值直接丢掉了：toast 提前被移除后，定时器仍挂着；
// clearToasts 清空 store 却不清定时器。

test("A-12 提前 removeToast 之后，那个自动移除定时器不再挂着（变异可判）", () => {
  resetStore();
  // 观测点：挂起的定时器数量。
  //
  // 第一版这条用例的判据是「到点后 store 里还剩几条 toast」——
  // 而悬挂的回调执行时调的是 removeToast(已被移除的 id)，
  // **对 store 没有任何可见影响** ⇒ 变异跑批时被当场放跑。
  //
  // 改成直接数「还挂着几个定时器」，这条判据才真的能咬住。
  const baseline = pendingTimers();

  const id = useNotificationStore.getState().addToast({
    type: 'info',
    message: 'early',
    duration: 5000,
  });
  assert.equal(pendingTimers(), baseline + 1, '加一条 toast 应挂上 1 个定时器');

  // 立刻移除；原实现的定时器仍然挂着
  useNotificationStore.getState().removeToast(id);
  assert.equal(useNotificationStore.getState().toasts.length, 0);
  assert.equal(pendingTimers(), baseline, '移除后定时器应被清掉');
});

test("A-12 clearToasts 之后，所有挂起的定时器都被清掉（变异可判）", () => {
  resetStore();
  const baseline = pendingTimers();

  useNotificationStore.getState().addToast({ type: 'info', message: 'x', duration: 5000 });
  useNotificationStore.getState().addToast({ type: 'info', message: 'y', duration: 5000 });
  assert.equal(pendingTimers(), baseline + 2, '两条 toast 应挂上 2 个定时器');

  toastManager.clear();
  assert.equal(useNotificationStore.getState().toasts.length, 0);
  assert.equal(pendingTimers(), baseline, 'clear 之后定时器应被清掉');
});

test("A-12 提前 removeToast 之后，到点不会再触发一次 removeToast", async () => {
  resetStore();
  const id = useNotificationStore.getState().addToast({
    type: 'info',
    message: 'early',
    duration: 50,
  });

  // 立刻移除；原实现的定时器仍然挂着，到点会再跑一次 removeToast(id)
  useNotificationStore.getState().removeToast(id);
  assert.equal(useNotificationStore.getState().toasts.length, 0);

  // 再加一条同 id 之外的 toast，验证那个悬挂的回调没有误伤
  const survivor = useNotificationStore.getState().addToast({
    type: 'info',
    message: 'survivor',
    duration: 5000,
  });

  await sleep(120);

  const toasts = useNotificationStore.getState().toasts;
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].id, survivor);
});

test("A-12 clearToasts 之后，挂起的定时器不再操作 store", async () => {
  resetStore();
  useNotificationStore.getState().addToast({ type: 'info', message: 'x', duration: 50 });
  useNotificationStore.getState().addToast({ type: 'info', message: 'y', duration: 50 });

  toastManager.clear();
  assert.equal(useNotificationStore.getState().toasts.length, 0);

  // 原实现：两个到点的回调仍会跑 removeToast（对空 store 无害，但是脏）
  // 修好后：store 仍是空的，且不会有任何对已清空 store 的写入
  await sleep(120);
  assert.equal(useNotificationStore.getState().toasts.length, 0);
});

// --------------------------------------------------- toastManager 门面

test("toastManager 四个方法各自产出对应类型的 toast", () => {
  resetStore();
  toastManager.success('s');
  toastManager.error('e');
  toastManager.warning('w');
  toastManager.info('i');

  const types = useNotificationStore.getState().toasts.map((t) => t.type);
  assert.deepEqual(types, ['success', 'error', 'warning', 'info']);
});

test("toastManager.remove 与 clear 都作用于同一个 store", () => {
  resetStore();
  const id = toastManager.info('x');
  assert.equal(useNotificationStore.getState().toasts.length, 1);

  toastManager.remove(id);
  assert.equal(useNotificationStore.getState().toasts.length, 0);

  toastManager.info('y');
  toastManager.clear();
  assert.equal(useNotificationStore.getState().toasts.length, 0);
});
