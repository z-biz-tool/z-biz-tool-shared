// 全局快捷键处理器
import React, { useEffect, useRef, useCallback } from 'react';

// 全局快捷键处理器
export const GlobalShortcutHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shortcutsRef = useRef<Record<string, () => void>>({});

  // 注册快捷键处理器
  const registerShortcutHandler = useCallback((key: string, handler: () => void) => {
    shortcutsRef.current[key] = handler;
  }, []);

  // 移除快捷键处理器
  const unregisterShortcutHandler = useCallback((key: string) => {
    delete shortcutsRef.current[key];
  }, []);

  // 处理快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 构建快捷键字符串
      const modifiers: string[] = [];
      
      if (e.metaKey) modifiers.push('Cmd');
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      
      const key = e.key.toUpperCase();
      const shortcut = [...modifiers, key].join('+');
      
      // 执行对应的处理器
      if (shortcutsRef.current[shortcut]) {
        e.preventDefault();
        shortcutsRef.current[shortcut]();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <GlobalShortcutContext.Provider
      value={{
        register: registerShortcutHandler,
        unregister: unregisterShortcutHandler
      }}
    >
      {children}
    </GlobalShortcutContext.Provider>
  );
};

// 全局快捷键上下文
interface GlobalShortcutContextType {
  register: (key: string, handler: () => void) => void;
  unregister: (key: string) => void;
}

const GlobalShortcutContext = React.createContext<GlobalShortcutContextType | undefined>(undefined);

export const useGlobalShortcut = () => {
  const context = React.useContext(GlobalShortcutContext);
  if (!context) {
    throw new Error('useGlobalShortcut must be used within GlobalShortcutHandler');
  }
  return context;
};

// 快捷键 Hook
export const useShortcut = (keys: string[], handler: () => void, enabled = true) => {
  const { register, unregister } = useGlobalShortcut();

  useEffect(() => {
    if (!enabled) return;

    // 注册快捷键
    const shortcut = keys.join('+');
    register(shortcut, handler);

    // 清理
    return () => {
      unregister(shortcut);
    };
  }, [keys, handler, enabled, register, unregister]);
};

// 快捷键组件
export const Shortcut: React.FC<{
  keys: string[];
  children: React.ReactNode;
  className?: string;
}> = ({ keys, children, className = '' }) => {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {keys.map((key, index) => (
        <span
          key={index}
          className="px-2 py-0.5 rounded text-xs font-mono"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#b0b0b0'
          }}
        >
          {key}
        </span>
      ))}
      {children}
    </span>
  );
};
