# z-biz-tool-shared - Shared Components

核心共享组件库，提供现代化的 UI 组件和设计令牌。

## 📦 组件列表

### 1. **AppShell** - 主布局组件
```tsx
import { AppShell } from "z-biz-tool-shared";

<AppShell
  title="文件管理器"
  icon={<FolderOutlined />}
  sidebar={<SideBar />}
  headerExtra={toolbar}
  collapsedSider={false}
  onToggleSider={toggleSider}
>
  <MainContent />
</AppShell>
```

**特性**:
- ✅ 渐变色头部导航栏（支持深色/浅色主题）
- ✅ 品牌渐变图标容器（带悬停旋转动画）
- ✅ Sider 区域渐变背景
- ✅ Content 区域渐变背景
- ✅ 平滑过渡动画

### 2. **Omnibar** - 智能地址栏
```tsx
import { Omnibar } from "z-biz-tool-shared";

<Omnibar
  currentPath="/Users/zifang"
  onNavigate={navigate}
  rootPath="/"
  onRootNavigate={goHome}
  onBack={goBack}
  onForward={goForward}
  onUp={goUp}
  historyIndex={0}
  history={["/", "/Users"]}
/>
```

**特性**:
- ✅ 卡片式容器设计（渐变背景 + 阴影）
- ✅ 三模式切换（路径/搜索/命令）
- ✅ 面包屑导航优化
- ✅ 导航按钮悬停缩放效果

### 3. **TabsBar** - 标签页栏
```tsx
import { TabsBar } from "z-biz-tool-shared";

<TabsBar
  onOpenNewTab={openNewTab}
  onSwitchTo={switchToTab}
/>
```

**特性**:
- ✅ Tab 图标渐变色
- ✅ Tab 悬停效果
- ✅ 关闭按钮红色高亮
- ✅ 新建标签页按钮渐变背景

### 4. **DragHandle** - 可拖动区域
```tsx
import { DragHandle } from "z-biz-tool-shared";

<DragHandle right={<CloseButton />}>
  <Input data-no-drag placeholder="搜索..." />
</DragHandle>
```

**特性**:
- ✅ macOS 窗口拖动支持
- ✅ 渐变背景
- ✅ Hover 状态提示

### 5. **ThemeProvider / useTheme / ThemeToggle / ThemeSelector** - 主题管理
```tsx
import { ThemeProvider, useTheme, ThemeToggle } from "z-biz-tool-shared";

function MyComponent() {
  const { mode, toggle } = useTheme();
  return <ThemeToggle />; // 主题切换按钮
}

// 在根组件包裹
<ThemeProvider>
  <App />
</ThemeProvider>
```

**特性**:
- ✅ 跟随系统深色模式偏好
- ✅ 渐变背景主题切换按钮
- ✅ 悬停缩放动画效果
- ✅ 主题选择器（系统/亮色/深色）

### 6. **EmptyState / LoadingState / ErrorState** - 状态组件
```tsx
import { EmptyState, LoadingState, ErrorState } from "z-biz-tool-shared";

<EmptyState 
  title="暂无数据" 
  description="请先添加内容" 
/>

<LoadingState tip="加载中..." />

<ErrorState 
  message="操作失败" 
  onRetry={retry} 
/>
```

**特性**:
- ✅ 渐变背景
- ✅ 圆角卡片设计
- ✅ 加载状态渐变背景

### 7. **CollapsiblePanel** - 可折叠面板
```tsx
import { CollapsiblePanel } from "z-biz-tool-shared";

<CollapsiblePanel 
  title="搜索结果" 
  defaultExpanded={true}
  icon={<SearchOutlined />}
  gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
>
  <div>内容...</div>
</CollapsiblePanel>
```

**特性**:
- ✅ 渐变标题背景（展开状态）
- ✅ 平滑展开/收起动画 (slide-down/slide-up)
- ✅ 悬停阴影效果
- ✅ 支持自定义图标和主题渐变色
- ✅ 底部指示条高亮

### 8. **ShortcutBadge / ShortcutPanel** - 快捷键提示
```tsx
import { ShortcutBadge, ShortcutPanel } from "z-biz-tool-shared";

// 快捷键徽章
<ShortcutBadge 
  spec={{ key: "k", meta: true, description: "打开搜索" }} 
  size="medium"
/>

// 快捷键面板
<ShortcutPanel 
  specs={[
    { key: "k", meta: true, description: "打开搜索" },
    { key: "l", ctrl: true, description: "编辑路径" }
  ]}
  title="常用快捷键"
  onClose={() => setShowShortcuts(false)}
/>
```

**特性**:
- ✅ 三种尺寸 (small/medium/large)
- ✅ 渐变背景和紫色边框
- ✅ 等宽字体显示键位
- ✅ 列表式快捷键展示
- ✅ 悬停渐变背景效果

### 9. **useKeyboardShortcuts** - 快捷键 Hook
```tsx
import { useKeyboardShortcuts, formatShortcut } from "z-biz-tool-shared";

useKeyboardShortcuts([
  {
    key: "k",
    meta: true,
    handler: (e) => console.log("Cmd+K pressed"),
    description: "打开搜索",
  },
]);

const shortcutStr = formatShortcut({ key: "k", meta: true }); // "⌘ + K"
```

## 🎨 设计令牌

统一管理的设计变量：

```tsx
import { radius, shadow, size, motion, gradient, colors } from "z-biz-tool-shared";

// 圆角
<div style={{ borderRadius: radius.large }}>Card</div>

// 阴影
<div style={{ boxShadow: shadow.floating }}>Floating Panel</div>

// 尺寸
const navWidth = size.navWidth; // 180

// 动画时长
const duration = motion.fast; // 0.15s

// 渐变色
<div style={{ background: gradient.primary }}>Gradient BG</div>

// 颜色常量
const primaryColor = colors.primary; // #667eea
```

## 📝 使用示例

### 完整应用结构

```tsx
import { 
  ThemeProvider, 
  AppShell, 
  Omnibar, 
  TabsBar,
  EmptyState,
  useTheme 
} from "z-biz-tool-shared";

function App() {
  const { mode } = useTheme();
  
  return (
    <ThemeProvider>
      <AppShell
        title="文件管理器"
        sidebar={<Sidebar />}
      >
        <Omnibar /* ... */ />
        <TabsBar /* ... */ />
        <EmptyState /* ... */ />
      </AppShell>
    </ThemeProvider>
  );
}
```

## 🎯 设计原则

1. **渐变美学**: 所有组件都使用紫色渐变 (#667eea → #764ba2)
2. **平滑动画**: cubic-bezier(0.4, 0, 0.2, 1) easing
3. **圆角设计**: 统一使用 4px/8px/12px/20px 圆角
4. **阴影层次**: floating/card/elevated/hover 四种阴影
5. **主题支持**: 完整的深色/浅色主题切换，跟随系统偏好
6. **交互反馈**: 悬停缩放、渐变色高亮、阴影变化
7. **macOS 风格**: 浮层、高光效果、拖动区域

## 🔧 扩展指南

新增组件时请遵循：
1. 放在 `src/shared/` 目录
2. 导出到 `src/shared/index.ts`
3. 添加 Props 类型定义
4. 编写 JSDoc 注释
5. 使用设计令牌保持一致性
