import { create } from 'zustand';
// 2026-10-04 改：`ShortcutConfig` 是纯类型（interface），这里必须是 `import type`。
// 原先写成普通 import，tsc 会按「只用于类型」自动擦除，所以编译一直是好的；
// 但 node --experimental-strip-types 是**仅擦除、不做类型分析**，擦不掉这条语句，
// 于是在运行期真去 ./types 找一个只存在于编译期的导出并抛
// 「does not provide an export named 'ShortcutConfig'」。
// 换句话说：这条 import 此前**从未在 Node 里被真正执行过**——
// tests/ 之前没有任何文件 import 过本模块，所以它躲过了所有测试。
import type { ShortcutConfig } from './types';

// 快捷键冲突检测器
class ShortcutConflictDetector {
  private shortcuts: Map<string, string> = new Map();

  register(shortcut: string, action: string): boolean {
    if (this.shortcuts.has(shortcut)) {
      console.error(`快捷键冲突: ${shortcut} 已被 ${this.shortcuts.get(shortcut)} 使用`);
      return false;
    }
    this.shortcuts.set(shortcut, action);
    return true;
  }

  unregister(shortcut: string): void {
    this.shortcuts.delete(shortcut);
  }

  getActions(shortcut: string): string[] {
    const action = this.shortcuts.get(shortcut);
    return action ? [action] : [];
  }

  hasConflict(shortcut: string): boolean {
    return this.shortcuts.has(shortcut);
  }
}

export const shortcutConflictDetector = new ShortcutConflictDetector();

// 快捷键存储
interface ShortcutStore {
  shortcuts: Record<string, ShortcutConfig>;
  registerShortcut: (key: string, config: ShortcutConfig) => boolean;
  unregisterShortcut: (key: string) => void;
  getShortcut: (key: string) => ShortcutConfig | undefined;
  getAllShortcuts: () => Record<string, ShortcutConfig>;
}

export const useShortcutStore = create<ShortcutStore>((set, get) => ({
  shortcuts: {},

  registerShortcut: (key, config) => {
    // 检查冲突
    const hasConflict = shortcutConflictDetector.hasConflict(key);
    if (hasConflict) {
      console.error(`快捷键冲突: ${key}`);
      return false;
    }

    shortcutConflictDetector.register(key, config.description);
    
    set((state) => ({
      shortcuts: {
        ...state.shortcuts,
        [key]: { ...config, key }
      }
    }));
    
    return true;
  },

  unregisterShortcut: (key) => {
    shortcutConflictDetector.unregister(key);
    set((state) => {
      const { [key]: _, ...rest } = state.shortcuts;
      return { shortcuts: rest };
    });
  },

  getShortcut: (key) => {
    return get().shortcuts[key];
  },

  getAllShortcuts: () => {
    // 2026-10-04 改：原先直接 `return get().shortcuts`，把 store 的内部对象
    // **按引用**交了出去，调用方改一下返回值就等于绕过 register/unregister
    // 直接改状态（例如删掉某项来"取消冲突"），而 detector 那边毫不知情 ——
    // 于是两处状态漂移，症状是「界面里没有了但仍报冲突」或反过来。
    // 改法：返回浅拷贝 + 每个值也拷一份，全族 grep 确认过没有任何调用方
    // 依赖引用相等（唯一调用点是 shortcutManager.getAll 转发给 UI 读用），
    // 所以收紧引用不改变任何现有行为。
    const src = get().shortcuts;
    const out: Record<string, ShortcutConfig> = {};
    for (const k of Object.keys(src)) out[k] = { ...src[k] };
    return out;
  }
}));

// 统一快捷键管理
export const shortcutManager = {
  // 注册快捷键
  register: (category: string, key: string, config: Omit<ShortcutConfig, 'key'>): boolean => {
    const fullKey = `${category}.${key}`;
    return useShortcutStore.getState().registerShortcut(fullKey, { ...config, key: fullKey });
  },

  // 注销快捷键
  unregister: (category: string, key: string): void => {
    const fullKey = `${category}.${key}`;
    useShortcutStore.getState().unregisterShortcut(fullKey);
  },

  // 获取快捷键
  get: (category: string, key: string): ShortcutConfig | undefined => {
    const fullKey = `${category}.${key}`;
    return useShortcutStore.getState().getShortcut(fullKey);
  },

  // 获取所有快捷键
  getAll: (): Record<string, ShortcutConfig> => {
    return useShortcutStore.getState().getAllShortcuts();
  },

  // 构建快捷键字符串
  //
  // 2026-10-04 修：原先是 `[...modifiers, key].join('+')`，**不做修饰键归一化**，
  // 于是 ['Mod','Shift'] 与 ['Shift','Mod'] 生成两个不同字符串
  // （"Mod+Shift+K" 与 "Shift+Mod+K"），同一个物理按键组合被当成两个键注册，
  // 冲突检测因此**漏报**。现场症状：两个功能抢同一个组合键，用户按一次触发两件事；
  // 且只在特定功能组合下才复现，没有单测就只能靠用户投诉发现。
  //
  // 归一化规则：修饰键去重后按固定顺序排列，保证「同一组合 ⇒ 同一字符串」。
  // 顺序表覆盖 Electron 常用的那套（Meta 先于 Control 先于 Alt 先于 Shift），
  // 不在表内的修饰键排到后面但仍按字典序排，避免顺序又变成新的不确定性来源。
  buildShortcut: (modifiers: string[], key: string): string => {
    const ORDER = ['Mod', 'CmdOrCtrl', 'Meta', 'Command', 'Control', 'Ctrl', 'Alt', 'Shift'];
    const rank = (m: string) => {
      const i = ORDER.indexOf(m);
      return i === -1 ? ORDER.length : i;
    };
    const mods = [...new Set(modifiers)].sort((a, b) => {
      const d = rank(a) - rank(b);
      // 同层（都不在表内）用字典序兜底，保证全序、稳定、与输入顺序无关
      return d !== 0 ? d : a < b ? -1 : a > b ? 1 : 0;
    });
    return [...mods, key].join('+');
  }
};
