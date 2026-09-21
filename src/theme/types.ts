// 主题类型定义

export type ThemeName =
  | 'dark'
  | 'light'
  | 'dracula'
  | 'solarized'
  | 'tokyoNight'
  | 'nord'
  | 'oneDark'
  | 'monokai'
  | 'ayu'
  | 'gruvbox';

export interface ThemeColors {
  mode?: string;
  background: string;
  surface: string;
  primary: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
}
