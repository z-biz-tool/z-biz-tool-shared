// 示例：在新项目中使用统一主题系统

import React from 'react';
import { ThemeProvider, useTheme, ThemeStyles } from 'z-biz-tool-shared/theme';

// 使用主题的组件
const ThemedButton: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ 
  children, 
  onClick 
}) => {
  const { themeColors } = useTheme();
  
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: themeColors.primary,
        color: themeColors.text,
        padding: '12px 24px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'opacity 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
    >
      {children}
    </button>
  );
};

// 应用示例
export const ThemeExample: React.FC = () => {
  const { currentTheme, setTheme, themeColors } = useTheme();

  return (
    <div style={{
      padding: '20px',
      backgroundColor: themeColors.background,
      minHeight: '100vh'
    }}>
      <h1 style={{ color: themeColors.primary }}>主题系统示例</h1>
      
      <ThemedButton onClick={() => alert('点击了按钮！')}>
        按钮
      </ThemedButton>
      
      <div style={{ marginTop: '20px' }}>
        <label>切换主题：</label>
        <select 
          value={currentTheme}
          onChange={(e) => setTheme(e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: themeColors.surface,
            color: themeColors.text,
            border: `1px solid ${themeColors.border}`
          }}
        >
          <option value="dark">深色主题</option>
          <option value="light">浅色主题</option>
          <option value="dracula">Dracula</option>
          <option value="nord">Nord</option>
          <option value="tokyo-night">Tokyo Night</option>
        </select>
      </div>
      
      <div style={{ 
        marginTop: '20px',
        padding: '16px',
        backgroundColor: themeColors.surface,
        borderRadius: '8px'
      }}>
        <h3 style={{ color: themeColors.primary }}>当前主题配置</h3>
        <pre style={{ color: themeColors.textSecondary }}>
          {JSON.stringify(themeColors, null, 2)}
        </pre>
      </div>
    </div>
  );
};

// 在应用根组件使用
export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ThemeStyles />
      <ThemeExample />
    </ThemeProvider>
  );
};
