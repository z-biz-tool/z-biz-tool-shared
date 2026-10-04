// 快捷键注册与冲突检测测试。
//
// 为什么这层必须补网：shared 是家族骨干（48 源文件，被 8 个仓消费），
// 而 shortcuts/ 是「同一个按键在 8 个子仓里都可能被占用」的那一层。
// 它的冲突检测一旦漏判，后果是**两个功能抢同一个键**：用户按一次触发两件事，
// 且现场只在特定功能组合下才复现——没有单测就只能靠用户投诉发现。
//
// 本文件同时钉住一个已确认的缺陷：buildShortcut 原本直接 [...modifiers, key].join('+')，
// 不做修饰键归一化，['Mod','Shift'] 与 ['Shift','Mod'] 生成两个不同字符串，
// 于是「同一个键被注册两次」检测不出来。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  shortcutManager,
  shortcutConflictDetector,
  useShortcutStore,
} from '../src/shortcuts/shortcutManager.ts';

describe('buildShortcut：修饰键归一化', () => {
  // 缺陷本身：join 之前不排序，顺序不同 ⇒ 字符串不同。
  test('顺序无关：Shift+Mod 与 Mod+Shift 归一成同一个键', () => {
    const a = shortcutManager.buildShortcut(['Mod', 'Shift'], 'K');
    const b = shortcutManager.buildShortcut(['Shift', 'Mod'], 'K');
    assert.equal(a, b, `归一化后两者应相等，实际 "${a}" vs "${b}"`);
  });

  test('三键时同样与顺序无关', () => {
    const a = shortcutManager.buildShortcut(['Mod', 'Alt', 'Shift'], 'S');
    const b = shortcutManager.buildShortcut(['Shift', 'Alt', 'Mod'], 'S');
    assert.equal(a, b);
  });

  test('归一化后仍是可读的 Mod+Shift+K 形式', () => {
    assert.equal(shortcutManager.buildShortcut(['Shift', 'Mod'], 'K'), 'Mod+Shift+K');
  });

  test('无修饰键时就是主键本身', () => {
    assert.equal(shortcutManager.buildShortcut([], 'F5'), 'F5');
  });

  test('单个修饰键不加多余分隔符', () => {
    assert.equal(shortcutManager.buildShortcut(['Mod'], 'K'), 'Mod+K');
  });
});

describe('冲突检测：归一化之后才真正咬得住', () => {
  test('同一组合的两种书写顺序被判为冲突', () => {
    const d = shortcutConflictDetector;
    d.unregister('c1');
    d.unregister('c2');
    const first = shortcutManager.buildShortcut(['Mod', 'Shift'], 'K');
    const second = shortcutManager.buildShortcut(['Shift', 'Mod'], 'K');
    assert.equal(d.register(first, '动作A'), true, '首次注册应成功');
    assert.equal(
      d.register(second, '动作B'),
      false,
      '顺序不同的同一组合必须被识别为冲突；这条在归一化前会返回 true（漏报）',
    );
    d.unregister(first);
  });
});

describe('快捷键注册表', () => {
  test('注册后可读回，且 key 被补成 category.name 全键', () => {
    const cfg = { description: '打开侧栏', action: 'toggleSidebar', keys: 'Mod+B' };
    assert.equal(shortcutManager.register('app', 'sidebar', cfg), true);
    const got = shortcutManager.get('app', 'sidebar');
    assert.ok(got, '注册后应能读回');
    assert.equal(got!.key, 'app.sidebar', 'key 字段应是 category.name 全键');
    assert.equal(got!.description, '打开侧栏');
    shortcutManager.unregister('app', 'sidebar');
  });

  test('不同类目下的同名 key 不算冲突', () => {
    const cfg = { description: 'd', action: 'a', keys: 'Mod+K' };
    assert.equal(shortcutManager.register('catA', 'k', cfg), true);
    assert.equal(shortcutManager.register('catB', 'k', cfg), true, '全键不同，不应冲突');
    shortcutManager.unregister('catA', 'k');
    shortcutManager.unregister('catB', 'k');
  });

  test('同类目同名重复注册被拒，且不会覆盖原配置', () => {
    const first = { description: '原动作', action: 'orig', keys: 'Mod+K' };
    const second = { description: '新动作', action: 'new', keys: 'Mod+K' };
    assert.equal(shortcutManager.register('dup', 'k', first), true);
    assert.equal(shortcutManager.register('dup', 'k', second), false, '重复注册应被拒');
    const got = shortcutManager.get('dup', 'k');
    assert.equal(got!.description, '原动作', '被拒的注册不能覆盖已有配置');
    shortcutManager.unregister('dup', 'k');
  });

  test('注销后可再次注册（原冲突被释放）', () => {
    const cfg = { description: 'd', action: 'a', keys: 'Mod+K' };
    assert.equal(shortcutManager.register('re', 'k', cfg), true);
    shortcutManager.unregister('re', 'k');
    assert.equal(shortcutManager.register('re', 'k', cfg), true, '注销后应能重新注册');
    shortcutManager.unregister('re', 'k');
  });

  test('注销后 get 返回 undefined，且从全表里消失', () => {
    const cfg = { description: 'd', action: 'a', keys: 'Mod+K' };
    shortcutManager.register('rm', 'k', cfg);
    assert.ok(shortcutManager.get('rm', 'k'));
    shortcutManager.unregister('rm', 'k');
    assert.equal(shortcutManager.get('rm', 'k'), undefined);
    assert.ok(!('rm.k' in shortcutManager.getAll()));
  });

  test('getAll 返回的是快照对象，外部改动不污染 store', () => {
    const cfg = { description: 'd', action: 'a', keys: 'Mod+K' };
    shortcutManager.register('snap', 'k', cfg);
    const all = shortcutManager.getAll();
    all['snap.k'] = undefined as never;
    delete all['snap.k'];
    // 上面改了返回的引用，但 store 内部不应被影响
    assert.ok(shortcutManager.get('snap', 'k'), '外部删改返回值不应影响 store');
    shortcutManager.unregister('snap', 'k');
  });

  test('未注册的 key 读回 undefined 而不是抛错', () => {
    assert.equal(shortcutManager.get('nope', 'nope'), undefined);
  });
});

describe('store 与 detector 的状态不漂移', () => {
  // 这是本文件最容易坏的地方：两处状态（detector 的 Map、store 的 Record）
  // 由 register/unregister 两条路径分别维护。任何一条漏改都会让它们不一致，
  // 症状是「注销后仍报冲突」或「没注册却报冲突」——都很难从 UI 上看出来。
  test('注册 → 注销 → detector 也清干净（否则注销后再也注册不进去）', () => {
    const cfg = { description: 'd', action: 'a', keys: 'Mod+K' };
    shortcutManager.register('sync', 'k', cfg);
    assert.equal(shortcutConflictDetector.hasConflict('sync.k'), true);
    shortcutManager.unregister('sync', 'k');
    assert.equal(
      shortcutConflictDetector.hasConflict('sync.k'),
      false,
      'store 删了但 detector 还留着 ⇒ 这个键永久不可用',
    );
  });

  test('从未注册过时 detector 也没有残留', () => {
    assert.equal(shortcutConflictDetector.hasConflict('never.registered'), false);
  });

  test('getActions 返回空数组而非抛错', () => {
    assert.deepEqual(shortcutConflictDetector.getActions('none'), []);
  });
});

describe('store 初始状态', () => {
  test('useShortcutStore.getState().shortcuts 存在且是对象', () => {
    assert.equal(typeof useShortcutStore.getState().shortcuts, 'object');
  });
});
