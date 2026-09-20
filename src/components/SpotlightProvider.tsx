import React, { useEffect } from 'react';
import { useSpotlight } from './Spotlight';

// Spotlight Provider - 管理全局 Spotlight
export const SpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toggleSpotlight } = useSpotlight();

  // 处理全局快捷键
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      // Cmd+Shift+Space 或 Ctrl+Shift+Space 打开 Spotlight
      if (
        (e.metaKey && e.shiftKey && e.code === 'Space') ||
        (e.ctrlKey && e.shiftKey && e.code === 'Space')
      ) {
        e.preventDefault();
        toggleSpotlight();
      }
    };

    document.addEventListener('keydown', handleGlobalShortcut);
    return () => document.removeEventListener('keydown', handleGlobalShortcut);
  }, [toggleSpotlight]);

  return (
    <>
      {children}
    </>
  );
};
