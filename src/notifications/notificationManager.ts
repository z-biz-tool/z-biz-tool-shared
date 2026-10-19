import { create } from 'zustand';
// 必须是 `import type`：ToastConfig 是纯类型。
// 写成普通 import 时 tsc 会自动擦除，但 node --experimental-strip-types
// 只擦除、不做类型分析，擦不掉这条语句 —— 运行期会真去 ./types 找一个
// 只存在于编译期的导出并抛「does not provide an export named 'ToastConfig'」。
import type { ToastConfig } from './types';

// Toast 存储
export interface NotificationStore {
  toasts: ToastConfig[];
  addToast: (toast: Omit<ToastConfig, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/**
 * 自增 id 计数器。
 *
 * 此前用 `Math.random().toString(36).substring(2, 9)`（01 A-12）：
 * 7 位 base36 的碰撞概率虽低，但**碰撞的后果不是"少一条 toast"**——
 * 两个 toast 拿到同一个 id，removeToast 会一次干掉两个。
 * 自增计数器保证同一进程内绝不重复。
 */
let toastSeq = 0;

/**
 * 自动移除的定时器句柄。
 *
 * 此前 setTimeout 的返回值直接丢掉了（01 A-12），于是：
 *   - toast 提前被移除后，定时器仍然挂着，到点再 removeToast 一次（无害但脏）；
 *   - clearToasts 清空了 store，却不清定时器，组件卸载后仍有回调在跑。
 * 现在按 id 记账，移除时一并清掉。
 */
const autoRemoveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    toastSeq += 1;
    const id = `toast-${toastSeq}`;

    // 注意默认值的展开顺序：`{ duration: 3000, ...toast }` 会被 toast 里
    // 显式的 `duration: undefined` 覆盖成 undefined —— 调用方写
    // `addToast({ type, message, duration })` 而 duration 恰好是 undefined 时，
    // 自动消失就整个失效了（toast 永远挂在屏幕上）。
    // 用 `??` 而不是展开顺序来兜这个默认值。
    const duration = toast.duration ?? 3000;
    const fullToast: ToastConfig = {
      ...toast,
      id,
      duration
    };

    set((state) => ({
      toasts: [...state.toasts, fullToast]
    }));

    // 自动移除
    if (duration) {
      const timer = setTimeout(() => {
        autoRemoveTimers.delete(id);
        get().removeToast(id);
      }, duration);
      autoRemoveTimers.set(id, timer);
    }

    return id;
  },

  removeToast: (id) => {
    // 顺手清掉这个 id 的自动移除定时器，避免回调在 toast 早没了之后还跑。
    const timer = autoRemoveTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      autoRemoveTimers.delete(id);
    }

    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  clearToasts: () => {
    // 清空 store 的同时把挂起的定时器也清掉 —— 否则 clear() 之后
    // 每个到点的回调仍会跑一次 removeToast。
    for (const timer of autoRemoveTimers.values()) {
      clearTimeout(timer);
    }
    autoRemoveTimers.clear();

    set({ toasts: [] });
  }
}));

// Toast 管理器
export const toastManager = {
  success: (message: string, duration?: number): string => {
    return useNotificationStore.getState().addToast({
      type: 'success',
      message,
      duration
    });
  },

  error: (message: string, duration?: number): string => {
    return useNotificationStore.getState().addToast({
      type: 'error',
      message,
      duration
    });
  },

  warning: (message: string, duration?: number): string => {
    return useNotificationStore.getState().addToast({
      type: 'warning',
      message,
      duration
    });
  },

  info: (message: string, duration?: number): string => {
    return useNotificationStore.getState().addToast({
      type: 'info',
      message,
      duration
    });
  },

  remove: (id: string): void => {
    useNotificationStore.getState().removeToast(id);
  },

  clear: (): void => {
    useNotificationStore.getState().clearToasts();
  }
};
