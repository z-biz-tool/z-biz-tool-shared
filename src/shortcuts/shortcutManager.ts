import { create } from 'zustand';
import { ShortcutConfig } from './types';

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
    return get().shortcuts;
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
  buildShortcut: (modifiers: string[], key: string): string => {
    return [...modifiers, key].join('+');
  }
};
