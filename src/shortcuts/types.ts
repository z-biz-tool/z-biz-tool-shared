// 快捷键配置类型
export interface ShortcutConfig {
  key: string;
  description: string;
  category?: string;
  action: () => void;
  enabled?: boolean;
}

// 主题名称类型
export type ThemeName = 
  | 'dark' 
  | 'light' 
  | 'dracula' 
  | 'solarized' 
  | 'tokyo-night' 
  | 'nord' 
  | 'one-dark' 
  | 'monokai' 
  | 'ayu' 
  | 'gruvbox';

// 主题配置类型
export interface ThemeConfig {
  name: ThemeName;
  colors: {
    background: string;
    surface: string;
    primary: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
  };
}

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onDismiss?: () => void;
}
