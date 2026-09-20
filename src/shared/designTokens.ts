/**
 * 设计令牌 - 统一的设计系统变量
 * 用于跨组件保持一致的视觉风格
 */

export const radius = {
  small: 4,
  medium: 8,
  large: 12,
  round: 999,
} as const;

export const shadow = {
  floating: "0 4px 12px rgba(0,0,0,0.08)",
  card: "0 2px 8px rgba(0,0,0,0.04)",
  elevated: "0 8px 24px rgba(0,0,0,0.12)",
  hover: "0 4px 16px rgba(0,0,0,0.08)",
} as const;

export const size = {
  navWidth: 180,
  categoryWidth: 200,
  floatingRadius: 16,
  headerHeight: 48,
  tabHeight: 32,
} as const;

export const motion = {
  fast: "0.15s cubic-bezier(0.4, 0, 0.2, 1)",
  normal: "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const gradient = {
  primary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  success: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  warning: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  darkHeader: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  lightHeader: "linear-gradient(135deg, #ffffff 0%, #f8fafd 100%)",
} as const;

export const colors = {
  primary: "#667eea",
  secondary: "#764ba2",
  textPrimary: "var(--ant-color-text)",
  textSecondary: "var(--ant-color-text-secondary)",
  textTertiary: "var(--ant-color-text-tertiary)",
  border: "rgba(0,0,0,0.06)",
  borderDark: "rgba(255,255,255,0.08)",
} as const;

/**
 * 悬停背景色辅助函数
 */
export function hoverBackground(isDark: boolean = false): string {
  return isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.04)";
}

/**
 * 渐变背景辅助函数
 */
export function backgroundGradient(isDark: boolean = false): string {
  return isDark ? gradient.darkHeader : gradient.lightHeader;
}
