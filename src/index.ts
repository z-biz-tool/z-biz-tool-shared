// 核心模块导出
export * from './ai';
export * from './agent';
export * from './theme';
export * from './shortcuts';
export * from './notifications';
export * from './components';
export * from './interactions';
export * from './styles';
export * from './capability';
export * from './protocol';
export * from './types';

// capability/cap-hub 与 protocol/deeplink、types/product 有同名成员
// （Handoff、ProductMeta）：顶层显式点名各取一份，别让两处 `export *` 撞名
// （TS2308 = "has already exported a member named"）。
// 能力层那两份（Handoff/ProductMeta 契约）走子路径 '@z-biz-tool/shared/capability' 取。
export type { Handoff } from './protocol/deeplink';
export type { ProductMeta } from './types/product';

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
