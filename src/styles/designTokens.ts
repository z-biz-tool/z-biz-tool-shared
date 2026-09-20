/**
 * 设计系统规范
 * z-biz-tool UI/UX 设计指南
 */

/**
 * 设计原则
 * 1. 统一 - 保持一致的视觉语言和交互模式
 * 2. 简洁 - 清晰直观，减少认知负担
 * 3. 反馈 - 及时的状态反馈和交互提示
 * 4. 灵活 - 支持主题切换和自定义
 */

// 颜色系统
export const COLORS = {
  // 主色
  primary: '#FFC131',
  primaryLight: '#FFD54F',
  primaryDark: '#FFA000',
  
  // 辅助色
  accent: '#61DAFB',
  accentLight: '#88E0FC',
  accentDark: '#3DB8E9',
  
  // 状态色
  success: '#4caf50',
  successLight: '#81c784',
  successDark: '#388e3c',
  
  warning: '#ff9800',
  warningLight: '#ffb74d',
  warningDark: '#f57c00',
  
  error: '#f44336',
  errorLight: '#e57373',
  errorDark: '#d32f2f',
  
  info: '#2196f3',
  infoLight: '#64b5f6',
  infoDark: '#1976d2',
  
  // 中性色
  white: '#ffffff',
  black: '#1e1e1e',
  
  // 背景色
  backgroundLight: '#ffffff',
  backgroundDark: '#1e1e1e',
  surfaceLight: '#f5f5f5',
  surfaceDark: '#2d2d2d',
  
  // 文本色
  textLight: '#1e1e1e',
  textDark: '#ffffff',
  textSecondaryLight: '#666666',
  textSecondaryDark: '#b0b0b0',
  
  // 边框色
  borderLight: '#e0e0e0',
  borderDark: '#3d3d3d'
};

// 间距系统
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64
};

// 圆角系统
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999
};

// 字体系统
export const FONT_FAMILY = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'Fira Code, "JetBrains Mono", "Consolas", "Monaco", monospace'
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36
};

export const FONT_WEIGHT = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

// 阴影系统
export const SHADOW = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

// 过渡系统
export const TRANSITION = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',
  all: 'all 200ms ease-in-out'
};

// 断点系统
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

// 按钮样式
export const BUTTON_STYLES = {
  primary: {
    backgroundColor: COLORS.primary,
    color: COLORS.black,
    hover: {
      backgroundColor: COLORS.primaryDark
    },
    active: {
      transform: 'scale(0.98)'
    }
  },
  secondary: {
    backgroundColor: COLORS.surfaceDark,
    color: COLORS.textDark,
    border: `1px solid ${COLORS.borderDark}`,
    hover: {
      backgroundColor: '#3d3d3d'
    }
  },
  ghost: {
    backgroundColor: 'transparent',
    color: COLORS.textDark,
    hover: {
      backgroundColor: COLORS.backgroundDark
    }
  },
  danger: {
    backgroundColor: COLORS.error,
    color: COLORS.white,
    hover: {
      backgroundColor: COLORS.errorDark
    }
  }
};

// 卡片样式
export const CARD_STYLES = {
  base: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: BORDER_RADIUS.lg,
    border: `1px solid ${COLORS.borderDark}`
  },
  padding: {
    sm: 16,
    md: 24,
    lg: 32
  }
};

// 表单样式
export const FORM_STYLES = {
  input: {
    backgroundColor: COLORS.surfaceDark,
    color: COLORS.textDark,
    border: `1px solid ${COLORS.borderDark}`,
    borderRadius: BORDER_RADIUS.md,
    padding: {
      sm: '8px 12px',
      md: '12px 16px',
      lg: '16px 20px'
    }
  },
  label: {
    color: COLORS.textSecondaryDark,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium
  }
};

// 状态指示器样式
export const STATUS_INDICATOR = {
  online: {
    backgroundColor: COLORS.success,
    animation: 'pulse'
  },
  busy: {
    backgroundColor: COLORS.warning,
    animation: 'pulse'
  },
  error: {
    backgroundColor: COLORS.error
  },
  offline: {
    backgroundColor: COLORS.textSecondaryDark
  }
};
