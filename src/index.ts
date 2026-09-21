// 核心模块导出
export * from './ai';
export * from './agent';
export * from './theme';
export * from './shortcuts';
export * from './notifications';
export * from './components';
export * from './interactions';
export * from './styles';

// shared 模块与 theme/components 存在重名成员
// （ThemeProvider/useTheme、EmptyState），顶层只显式导出无冲突部分
export {
  AppShell,
  Omnibar,
  TabsBar,
  DragHandle,
  type DragHandleProps,
  ThemeToggle,
  ThemeSelector,
  LoadingState,
  ErrorState,
  CollapsiblePanel,
  useKeyboardShortcuts,
  formatShortcut,
  type ShortcutSpec,
  ShortcutBadge,
  ShortcutPanel,
  radius,
  shadow,
  size,
  motion,
  gradient,
  hoverBackground,
  backgroundGradient,
} from './shared';
