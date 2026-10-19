// 主题偏好纯逻辑测试（无 React、无 DOM）
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 对应 06 验收矩阵：UT-THEME-01 / UT-THEME-02，以及 A-8 / A-14。
//
// **为什么测的是 themeMode.ts 而不是 ThemeContext.tsx**：
//   仓库测试跑在 node --experimental-strip-types 上，Node 只擦除类型、
//   不转译 JSX，.tsx 没法被 import。所以所有需要被测的判定逻辑都放在
//   .ts 纯逻辑模块里，React 组件只做薄封装（见 src/theme/themeMode.ts 头注）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isThemePreference,
  nextPreference,
  readStoredPreference,
  resolveThemeMode,
  writeStoredPreference,
  THEME_NAME_KEY,
  THEME_PREFERENCE_KEY,
  LEGACY_THEME_NAME_KEY,
  LEGACY_THEME_PREFERENCE_KEY,
  type ThemeStorage,
} from '../src/theme/themeMode.ts';

/** 内存版 localStorage */
function memStorage(initial: Record<string, string> = {}): ThemeStorage & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

// ------------------------------------------------------ 偏好解析

test("resolveThemeMode: 'system' 跟随系统偏好", () => {
  assert.equal(resolveThemeMode('system', true), 'dark');
  assert.equal(resolveThemeMode('system', false), 'light');
});

test("resolveThemeMode: 显式 light/dark 不受系统偏好影响", () => {
  assert.equal(resolveThemeMode('light', true), 'light');
  assert.equal(resolveThemeMode('dark', false), 'dark');
});

test("isThemePreference 只认三个合法取值", () => {
  assert.equal(isThemePreference('system'), true);
  assert.equal(isThemePreference('light'), true);
  assert.equal(isThemePreference('dark'), true);
  assert.equal(isThemePreference('auto'), false);
  assert.equal(isThemePreference(''), false);
  assert.equal(isThemePreference(null), false);
  assert.equal(isThemePreference(undefined), false);
});

// ------------------------------------------------------ 读写

test("写入 light/dark 落盘到命名空间键", () => {
  const storage = memStorage();
  writeStoredPreference(storage, 'dark');
  assert.equal(storage.data[THEME_PREFERENCE_KEY], 'dark');
});

test("写入 system 会清掉键（跟随系统 = 不落盘固定值）", () => {
  const storage = memStorage();
  writeStoredPreference(storage, 'dark');
  writeStoredPreference(storage, 'system');
  assert.equal(storage.data[THEME_PREFERENCE_KEY], undefined);
  assert.equal(THEME_PREFERENCE_KEY in storage.data, false);
});

test("readStoredPreference 没有存过时返回 null", () => {
  assert.equal(readStoredPreference(memStorage()), null);
});

test("readStoredPreference 读得到写进去的值", () => {
  const storage = memStorage();
  writeStoredPreference(storage, 'light');
  assert.equal(readStoredPreference(storage), 'light');
});

// ------------------------------------------------------ 迁移（A-14）
// 旧键 'z-tool-theme-mode' 存的是两态（'light'/'dark'），新键存三态。
// 迁移后老用户偏好不丢，同时旧键不再留着让同源应用看见。

test("A-14 旧键 'z-tool-theme-mode' 会被迁移到新键并删除旧键", () => {
  const storage = memStorage({ [LEGACY_THEME_PREFERENCE_KEY]: 'dark' });

  const preference = readStoredPreference(storage);

  assert.equal(preference, 'dark');
  assert.equal(storage.data[THEME_PREFERENCE_KEY], 'dark');
  assert.equal(LEGACY_THEME_PREFERENCE_KEY in storage.data, false);
});

test("A-14 旧键存的是非法值时不被当成合法偏好，且旧键被清掉", () => {
  const storage = memStorage({ [LEGACY_THEME_PREFERENCE_KEY]: 'rainbow' });

  const preference = readStoredPreference(storage);

  assert.equal(preference, null);
  assert.equal(LEGACY_THEME_PREFERENCE_KEY in storage.data, false);
});

test("A-14 新键优先于旧键（旧键不覆盖用户新设置）", () => {
  const storage = memStorage({
    [THEME_PREFERENCE_KEY]: 'light',
    [LEGACY_THEME_PREFERENCE_KEY]: 'dark',
  });

  assert.equal(readStoredPreference(storage), 'light');
});

test("A-14 新键存了非法值时返回 null，不回退去读旧键", () => {
  const storage = memStorage({
    [THEME_PREFERENCE_KEY]: 'nonsense',
    [LEGACY_THEME_PREFERENCE_KEY]: 'dark',
  });

  assert.equal(readStoredPreference(storage), null);
});

test("A-14 主题名键也有命名空间与旧键", () => {
  assert.equal(THEME_NAME_KEY, 'z-biz-tool-theme-name');
  assert.equal(LEGACY_THEME_NAME_KEY, 'theme');
  // 通用键 'theme' 不再被当作正式键使用
  assert.notEqual(THEME_NAME_KEY, LEGACY_THEME_NAME_KEY);
});

// ------------------------------------------------------ toggle 语义

test("nextPreference: light <-> dark 互切", () => {
  assert.equal(nextPreference('light', 'light'), 'dark');
  assert.equal(nextPreference('dark', 'dark'), 'light');
});

test("nextPreference: 从 'system' 切到当前实际模式的反面", () => {
  // 系统是暗色，实际模式是 dark → 下一次应切到 light
  assert.equal(nextPreference('system', 'dark'), 'light');
  // 系统是亮色，实际模式是 light → 下一次应切到 dark
  assert.equal(nextPreference('system', 'light'), 'dark');
});
