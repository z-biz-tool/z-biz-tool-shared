/**
 * 全局样式
 * z-biz-tool 的全局 CSS
 */

// CSS 变量注入
export const globalStyles = `
  :root {
    /* 颜色变量 */
    --color-primary: #FFC131;
    --color-primary-light: #FFD54F;
    --color-primary-dark: #FFA000;
    --color-accent: #61DAFB;
    --color-success: #4caf50;
    --color-warning: #ff9800;
    --color-error: #f44336;
    --color-info: #2196f3;
    
    /* 背景变量 */
    --color-background: #1e1e1e;
    --color-surface: #2d2d2d;
    --color-text: #ffffff;
    --color-text-secondary: #b0b0b0;
    --color-border: #3d3d3d;
    
    /* 间距变量 */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    
    /* 圆角变量 */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    
    /* 字体变量 */
    --font-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --font-mono: "Fira Code", "JetBrains Mono", Consolas, Monaco, monospace;
    
    /* 阴影变量 */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    
    /* 过渡变量 */
    --transition-fast: 150ms ease-in-out;
    --transition-normal: 200ms ease-in-out;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 1.5;
    color: var(--color-text);
    background-color: var(--color-background);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* 滚动条样式 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: var(--radius-md);
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  
  /* 选择器样式 */
  ::selection {
    background: var(--color-primary);
    color: var(--color-text);
  }
  
  /* 按钮样式 */
  button {
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }
  
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  /* 输入框样式 */
  input,
  textarea,
  select {
    font-family: inherit;
    font-size: inherit;
  }
  
  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
  }
  
  /* 链接样式 */
  a {
    color: var(--color-primary);
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  /* 动画 */
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-slide-in {
    animation: slide-in var(--transition-normal);
  }
  
  .animate-fade-in {
    animation: fade-in var(--transition-normal);
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* 暗色模式适配 */
  @media (prefers-color-scheme: dark) {
    :root {
      --color-background: #1e1e1e;
      --color-surface: #2d2d2d;
      --color-text: #ffffff;
      --color-text-secondary: #b0b0b0;
      --color-border: #3d3d3d;
    }
  }
  
  /* 浅色模式适配 */
  @media (prefers-color-scheme: light) {
    :root {
      --color-background: #ffffff;
      --color-surface: #f5f5f5;
      --color-text: #1e1e1e;
      --color-text-secondary: #666666;
      --color-border: #e0e0e0;
    }
  }
`;

// 加载全局样式
export const loadGlobalStyles = () => {
  if (typeof document === 'undefined') return;
  
  // 检查是否已加载
  const styleId = 'z-biz-tool-global-styles';
  if (document.getElementById(styleId)) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = globalStyles;
  document.head.appendChild(styleElement);
};

// 卸载全局样式
export const unloadGlobalStyles = () => {
  if (typeof document === 'undefined') return;
  
  const styleElement = document.getElementById('z-biz-tool-global-styles');
  if (styleElement) {
    styleElement.remove();
  }
};
