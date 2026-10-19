// 主题偏好（纯逻辑，无 React、无 DOM 依赖）
//
// 为什么独立成 .ts 而不是留在 ThemeContext.tsx：
//   仓里的测试跑在 `node --experimental-strip-types` 上，而 Node 的
//   strip-types **只擦除类型、不转译 JSX** —— .tsx 文件在这条链路上
//   没法被 import。所以凡是要被单测覆盖的判定逻辑，都必须落在 .ts 里，
//   React 组件只做薄封装。
//
// 位置说明：本文件在 src/theme/ 而不是 src/shared/，是因为 05 台账 T3.1
//   的终态是「主题归一到 theme 子路径、取消 shared 目录」。放在 theme/ 下，
//   将来 T3.4 把 ThemeContext.tsx 挪进 theme/ 时，纯逻辑不用跟着搬。

/** 用户对主题的偏好：跟随系统 / 强制亮色 / 强制暗色 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** 解析后的实际模式（真正决定界面明暗） */
export type ResolvedThemeMode = 'light' | 'dark';

/**
 * localStorage 键命名空间。
 *
 * A-14：原先主题有两个键 —— themeManager 用通用名 'theme'，
 * shared/ThemeContext 用 'z-tool-theme-mode'。'theme' 这种通用键名在
 * 同源多应用场景下会互相污染，本仓统一收敛到 'z-biz-tool-' 前缀。
 */
export const THEME_NAME_KEY = 'z-biz-tool-theme-name';
export const LEGACY_THEME_NAME_KEY = 'theme';

export const THEME_PREFERENCE_KEY = 'z-biz-tool-theme-preference';
export const LEGACY_THEME_PREFERENCE_KEY = 'z-tool-theme-mode';

/** 只需要 localStorage 的这三个方法，便于测试注入内存实现 */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 判断一个字符串是不是合法的 ThemePreference */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * 把偏好解析成实际模式。
 *
 * 'system' 时以系统的 prefers-color-scheme 为准 —— 系统偏好由调用方
 * 从 matchMedia 读出来传进来，本函数不碰 DOM（好测）。
 */
export function resolveThemeMode(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedThemeMode {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

/**
 * 读出用户偏好，没有则返回 null（表示"没选过"）。
 *
 * 迁移：先读新键；新键没有再读旧键（'z-tool-theme-mode'），命中则
 * **顺手写回新键并删掉旧键** —— 这样老用户升级后偏好不丢，同时旧键
 * 不会一直占着让别的应用看得到。
 */
export function readStoredPreference(storage: ThemeStorage): ThemePreference | null {
  const current = storage.getItem(THEME_PREFERENCE_KEY);
  if (current !== null) {
    return isThemePreference(current) ? current : null;
  }

  const legacy = storage.getItem(LEGACY_THEME_PREFERENCE_KEY);
  if (legacy === null) {
    return null;
  }
  if (!isThemePreference(legacy)) {
    // 旧键存的是 'light'/'dark'（旧格式只记两态），不是三态偏好。
    // 只认这两个值 —— 其它一律当非法值丢掉，**不能**顺手兜成 'light'，
    // 否则一个写坏的存储值会静默变成"用户选了亮色"。
    storage.removeItem(LEGACY_THEME_PREFERENCE_KEY);
    if (legacy === 'dark' || legacy === 'light') {
      return legacy;
    }
    return null;
  }
  storage.setItem(THEME_PREFERENCE_KEY, legacy);
  storage.removeItem(LEGACY_THEME_PREFERENCE_KEY);
  return legacy;
}

/** 写入偏好；写 'system' 时清掉键（"跟随系统" = 不落盘固定值） */
export function writeStoredPreference(
  storage: ThemeStorage,
  preference: ThemePreference
): void {
  if (preference === 'system') {
    storage.removeItem(THEME_PREFERENCE_KEY);
    return;
  }
  storage.setItem(THEME_PREFERENCE_KEY, preference);
}

/**
 * toggle 的目标偏好。
 *
 * 原来 ThemeToggle 的语义是"在 light/dark 之间来回切"；但一旦引入了
 * 'system' 这第三态，'system' 的下一个就该是解析出来的实际模式的反面，
 * 而不是固定的 'dark' —— 否则在浅色系统上点一下会跳到暗色，体验突兀。
 */
export function nextPreference(
  current: ThemePreference,
  resolvedMode: ResolvedThemeMode
): ThemePreference {
  if (current === 'system') {
    return resolvedMode === 'dark' ? 'light' : 'dark';
  }
  return current === 'dark' ? 'light' : 'dark';
}
