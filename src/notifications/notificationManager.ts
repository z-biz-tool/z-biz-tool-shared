import { create } from 'zustand';
import { ToastConfig } from './types';

// Toast 存储
interface NotificationStore {
  toasts: ToastConfig[];
  addToast: (toast: Omit<ToastConfig, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const fullToast: ToastConfig = {
      id,
      duration: 3000,
      ...toast
    };
    
    set((state) => ({
      toasts: [...state.toasts, fullToast]
    }));
    
    // 自动移除
    if (fullToast.duration) {
      setTimeout(() => {
        get().removeToast(id);
      }, fullToast.duration);
    }
    
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  clearToasts: () => {
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
