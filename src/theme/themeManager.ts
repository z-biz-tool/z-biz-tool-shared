import { create } from 'zustand';
import { ThemeName, ThemeConfig } from './types';

// 主题配置
const themes: Record<ThemeName, ThemeConfig> = {
  dark: {
    name: 'dark',
    colors: {
      background: '#1e1e1e',
      surface: '#2d2d2d',
      primary: '#FFC131',
      text: '#ffffff',
      textSecondary: '#b0b0b0',
      border: '#3d3d3d',
      accent: '#61DAFB'
    }
  },
  light: {
    name: 'light',
    colors: {
      background: '#ffffff',
      surface: '#f5f5f5',
      primary: '#FFC131',
      text: '#1e1e1e',
      textSecondary: '#666666',
      border: '#e0e0e0',
      accent: '#61DAFB'
    }
  },
  dracula: {
    name: 'dracula',
    colors: {
      background: '#282a36',
      surface: '#44475a',
      primary: '#ff79c6',
      text: '#f8f8f2',
      textSecondary: '#b0b0b0',
      border: '#282a36',
      accent: '#8be9fd'
    }
  },
  solarized: {
    name: 'solarized',
    colors: {
      background: '#002b36',
      surface: '#073642',
      primary: '#b58900',
      text: '#839496',
      textSecondary: '#93a1a1',
      border: '#073642',
      accent: '#2aa198'
    }
  },
  tokyoNight: {
    name: 'tokyo-night',
    colors: {
      background: '#1a1b26',
      surface: '#24283b',
      primary: '#7aa2f7',
      text: '#c0caf5',
      textSecondary: '#565f89',
      border: '#24283b',
      accent: '#bb9af7'
    }
  },
  nord: {
    name: 'nord',
    colors: {
      background: '#2e3440',
      surface: '#3b4252',
      primary: '#88c0d0',
      text: '#eceff4',
      textSecondary: '#d8dee9',
      border: '#3b4252',
      accent: '#81a1c1'
    }
  },
  oneDark: {
    name: 'one-dark',
    colors: {
      background: '#282c34',
      surface: '#353b45',
      primary: '#e5c07b',
      text: '#abb2bf',
      textSecondary: '#5c6370',
      border: '#353b45',
      accent: '#61afef'
    }
  },
  monokai: {
    name: 'monokai',
    colors: {
      background: '#272822',
      surface: '#3e3d32',
      primary: '#f92672',
      text: '#f8f8f2',
      textSecondary: '#75715e',
      border: '#3e3d32',
      accent: '#66d9ef'
    }
  },
  ayu: {
    name: 'ayu',
    colors: {
      background: '#0f1117',
      surface: '#1f2229',
      primary: '#ffae57',
      text: '#e6e1cf',
      textSecondary: '#5c6773',
      border: '#1f2229',
      accent: '#36bfcc'
    }
  },
  gruvbox: {
    name: 'gruvbox',
    colors: {
      background: '#282828',
      surface: '#3c3836',
      primary: '#fabd2f',
      text: '#ebdbb2',
      textSecondary: '#a89984',
      border: '#3c3836',
      accent: '#458588'
    }
  }
};

// 主题存储
interface ThemeStore {
  currentTheme: ThemeName;
  themeConfig: ThemeConfig;
  setTheme: (theme: ThemeName) => void;
  updateTheme: (theme: Partial<ThemeConfig>) => void;
  getThemeColors: () => Record<string, string>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  currentTheme: 'dark',
  themeConfig: themes['dark'],

  setTheme: (theme) => {
    set({
      currentTheme: theme,
      themeConfig: themes[theme]
    });
    localStorage.setItem('theme', theme);
  },

  updateTheme: (theme) => {
    set((state) => {
      const newTheme = { ...state.themeConfig, ...theme };
      return {
        themeConfig: newTheme
      };
    });
  },

  getThemeColors: () => {
    const { themeConfig } = get();
    return themeConfig.colors;
  }
}));

// 初始化主题
export const initTheme = (): void => {
  const savedTheme = localStorage.getItem('theme') as ThemeName;
  if (savedTheme && themes[savedTheme]) {
    useThemeStore.getState().setTheme(savedTheme);
  } else {
    // 检测系统主题
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    useThemeStore.getState().setTheme(prefersDark ? 'dark' : 'light');
  }
};
