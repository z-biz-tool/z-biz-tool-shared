/**
 * 主题 Context - 提供给组件使用
 */

import React, { createContext, useContext, useEffect } from 'react';
import { useThemeStore, initTheme } from './themeManager';
import type { ThemeColors, ThemeName } from './types';

interface ThemeContextType {
  currentTheme: ThemeName;
  themeColors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // 初始化主题
    initTheme();
  }, []);

  const { currentTheme, themeConfig, setTheme } = useThemeStore();
  
  const themeColors = themeConfig.colors;

  return (
    <ThemeContext.Provider value={{
      currentTheme: currentTheme,
      themeColors,
      setTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// 主题样式注入组件
export const ThemeStyles: React.FC = () => {
  const { themeColors } = useTheme();

  return (
    <style>{`
      :root {
        --color-background: ${themeColors.background};
        --color-surface: ${themeColors.surface};
        --color-primary: ${themeColors.primary};
        --color-text: ${themeColors.text};
        --color-text-secondary: ${themeColors.textSecondary};
        --color-border: ${themeColors.border};
        --color-accent: ${themeColors.accent};
      }
      
      body {
        background-color: var(--color-background);
        color: var(--color-text);
      }
      
      .bg-primary {
        background-color: var(--color-primary);
      }
      
      .text-primary {
        color: var(--color-primary);
      }
      
      .border-primary {
        border-color: var(--color-primary);
      }
    `}</style>
  );
};
