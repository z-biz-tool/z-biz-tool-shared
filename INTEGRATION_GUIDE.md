# z-biz-tool 核心库集成指南

## 📦 已完成的功能

### 1. 统一 AI 中台
- ✅ AIManager - 统一的 AI 服务管理
- ✅ 支持 14 种功能类型
- ✅ 配置驱动，快速扩展

### 2. 统一主题系统
- ✅ 10 种预设主题（Dark/Light/Dracula/Nord/Drift/Midnight 等）
- ✅ 实时主题切换
- ✅ 主题配置同步

### 3. 统一快捷键系统
- ✅ 全局快捷键注册中心
- ✅ 自动冲突检测
- ✅ 统一的快捷键显示组件

### 4. 统一通知系统
- ✅ Toast 通知
- ✅ 多种通知类型（success/error/warning/info）
- ✅ 自定义时长

### 5. 优化交互
- ✅ Spotlight 命令面板
- ✅ 全局快捷键处理
- ✅ 导航栏和侧边栏组件

### 6. UI 设计系统
- ✅ Button 组件（支持 4 种变体）
- ✅ Input/Textarea 组件
- ✅ Card 组件
- ✅ Badge 组件
- ✅ Divider 组件
- ✅ Modal 组件
- ✅ Icon 组件（15 种图标）
- ✅ EmptyState 组件
- ✅ LoadingSpinner 组件
- ✅ Skeleton 组件

## 🚀 快速开始

### 1. 安装依赖

```bash
cd z-biz-tool-shared
npm install
```

### 2. 导入模块

```typescript
import {
  AIManager,
  ThemeProvider,
  ThemeContext,
  ShortcutManager,
  NotificationManager,
  Spotlight,
  SpotlightProvider,
  GlobalShortcutHandler,
  useSpotlight,
  Navbar,
  Sidebar,
  Button,
  Card,
  Icon,
  EmptyState,
  LoadingSpinner,
  Skeleton,
  DESIGN_TOKENS
} from 'z-biz-tool-shared';
```

## 📚 使用示例

### AI 中台使用

```typescript
import { AIManager, AIManagerProvider } from 'z-biz-tool-shared';

// 配置 AI 模型
const aiManager = new AIManager({
  apiKey: 'your-api-key',
  models: {
    gpt4: 'gpt-4',
    claude3: 'claude-3-opus-20240229'
  }
});

// 在应用中使用
<AIManagerProvider manager={aiManager}>
  <YourApp />
</AIManagerProvider>

// 在组件中使用 AI 功能
const { generateText, generateCode, translate } = useAIContext();

const result = await generateText({
  prompt: '帮我写一个 hello world 程序',
  model: 'gpt4'
});
```

### 主题系统使用

```typescript
import { ThemeProvider, useTheme } from 'z-biz-tool-shared';

// 在应用顶层包裹
<ThemeProvider initialTheme="dark">
  <YourApp />
</ThemeProvider>

// 在组件中使用主题
const { themeColors, themeName, setTheme } = useTheme();

// 切换主题
setTheme('light');
```

### 快捷键系统使用

```typescript
import { shortcutManager, useShortcut } from 'z-biz-tool-shared';

// 注册快捷键
shortcutManager.register('editor', 'save', {
  description: '保存当前文件',
  category: '编辑器',
  action: () => console.log('保存'),
  enabled: true
});

// 在组件中使用快捷键 Hook
const { register, unregister } = useGlobalShortcut();

useShortcut(['Cmd', 'S'], () => {
  console.log('保存');
});

// 删除快捷键
shortcutManager.unregister('editor', 'save');
```

### 通知系统使用

```typescript
import { toastManager } from 'z-biz-tool-shared';

// 显示不同类型的 Toast
toastManager.success('操作成功！');
toastManager.error('操作失败！');
toastManager.warning('警告信息');
toastManager.info('提示信息');

// 自定义 Toast
toastManager.show('自定义消息', {
  type: 'success',
  duration: 3000,
  position: 'bottom-right'
});
```

### Spotlight 命令面板

```typescript
import { Spotlight, SpotlightProvider, useSpotlight } from 'z-biz-tool-shared';

// 在应用中使用
const spotlight = useSpotlight();

<SpotlightProvider>
  <YourApp />
  <Spotlight 
    isOpen={spotlight.isOpen} 
    onClose={spotlight.closeSpotlight} 
  />
</SpotlightProvider>

// 快捷键打开
// Cmd+Shift+Space 或 Ctrl+Shift+Space
```

### UI 组件使用

```typescript
import { 
  Button, 
  Card, 
  Icon, 
  EmptyState, 
  LoadingSpinner,
  Modal 
} from 'z-biz-tool-shared';

// 按钮
<Button 
  variant="primary" 
  onClick={() => console.log('点击')}
  icon={<Icon name="check" />}
>
  主要按钮
</Button>

// 卡片
<Card title="标题" footer={<Button>操作</Button>}>
  <p>内容</p>
</Card>

// 空状态
<EmptyState 
  title="暂无数据" 
  description="点击按钮添加内容"
  action={<Button>添加</Button>}
/>

// 加载状态
<LoadingSpinner size="md" />

// 骨架屏
<Skeleton width="100%" height="100px" />

// 模态框
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="标题"
>
  <p>内容</p>
</Modal>
```

### 设计令牌使用

```typescript
import { DESIGN_TOKENS } from 'z-biz-tool-shared';

// 使用设计令牌
const { borderRadius, spacing, fontSize } = DESIGN_TOKENS;

// 在样式中使用
const styles = {
  padding: spacing.md,
  borderRadius: borderRadius.lg,
  fontSize: fontSize.base
};
```

## 🎨 主题预设

| 主题名 | 描述 |
|--------|------|
| dark | 经典深色主题 |
| light | 经典浅色主题 |
| dracula | Dracula 主题 |
| nord | Nord 主题 |
| drift | Drift 主题 |
| midnight | 午夜蓝主题 |
| sunrise | 日出橙主题 |
| forest | 森林绿主题 |
| ocean | 海洋蓝主题 |
| sunset | 日落紫主题 |

## 🔌 集成到现有项目

### 1. 在 terminal 中集成

```typescript
// src/features/terminal/Terminal.tsx
import {
  AIManager,
  ThemeProvider,
  ThemeContext,
  useTheme,
  toastManager,
  SpotlightProvider,
  useSpotlight,
  Navbar,
  Sidebar
} from 'z-biz-tool-shared';

function Terminal() {
  const { themeColors } = useTheme();
  const spotlight = useSpotlight();

  return (
    <div style={{ backgroundColor: themeColors.background }}>
      <Navbar 
        title="终端" 
        actions={[<Button key="1">AI</Button>]}
      />
      
      <div style={{ display: 'flex' }}>
        <Sidebar items={[]} />
        <div style={{ flex: 1, padding: '20px' }}>
          {/* 终端内容 */}
        </div>
      </div>
      
      <Spotlight 
        isOpen={spotlight.isOpen} 
        onClose={spotlight.closeSpotlight} 
      />
    </div>
  );
}
```

### 2. 在 aigen 中集成

```typescript
// src/features/aigen/AIGen.tsx
import {
  AIManager,
  ThemeProvider,
  ThemeContext,
  useTheme,
  useAIContext,
  toastManager
} from 'z-biz-tool-shared';

function AIGen() {
  const { themeColors } = useTheme();
  const { generateText, generateCode } = useAIContext();

  const handleGenerate = async () => {
    const result = await generateText({
      prompt: '生成一段代码',
      model: 'gpt4'
    });
    toastManager.success('生成完成');
  };

  return (
    <div style={{ backgroundColor: themeColors.background }}>
      <Button onClick={handleGenerate}>生成代码</Button>
    </div>
  );
}
```

## 📖 API 文档

### AIManager

| 方法 | 说明 | 参数 |
|------|------|------|
| `generateText` | 生成文本 | `{ prompt: string; model?: string }` |
| `generateCode` | 生成代码 | `{ prompt: string; language: string; model?: string }` |
| `translate` | 翻译 | `{ text: string; targetLang: string }` |
| `summarize` | 摘要 | `{ text: string }` |
| `optimize` | 优化 | `{ text: string; type: 'grammar' \| 'style' }` |
| `explain` | 解释 | `{ text: string }` |
| `review` | 代码审查 | `{ code: string; language: string }` |

### ThemeContext

| 属性 | 说明 |
|------|------|
| `themeColors` | 当前主题的颜色配置 |
| `themeName` | 当前主题名称 |
| `setTheme` | 设置主题 |

### ShortcutManager

| 方法 | 说明 | 参数 |
|------|------|------|
| `register` | 注册快捷键 | `category: string, id: string, config: ShortcutConfig` |
| `unregister` | 注销快捷键 | `category: string, id: string` |
| `getAll` | 获取所有快捷键 | 无参数 |
| `hasConflict` | 检查冲突 | `key: string` |

### ToastManager

| 方法 | 说明 | 参数 |
|------|------|------|
| `success` | 成功通知 | `message: string, duration?: number` |
| `error` | 错误通知 | `message: string, duration?: number` |
| `warning` | 警告通知 | `message: string, duration?: number` |
| `info` | 信息通知 | `message: string, duration?: number` |
| `show` | 自定义通知 | `message: string, options?: ToastOptions` |

## 📦 文件结构

```
z-biz-tool-shared/
├── src/
│   ├── ai/                    # AI 中台
│   │   ├── AIManager.ts       # AI 管理器
│   │   ├── context.ts         # AI Context
│   │   ├── types.ts           # 类型定义
│   │   └── index.ts
│   ├── theme/                 # 主题系统
│   │   ├── ThemeContext.tsx   # 主题 Context
│   │   ├── themeManager.ts    # 主题管理器
│   │   ├── types.ts           # 类型定义
│   │   └── index.ts
│   ├── shortcuts/             # 快捷键系统
│   │   ├── shortcutManager.ts # 快捷键管理器
│   │   ├── types.ts           # 类型定义
│   │   └── index.ts
│   ├── notifications/         # 通知系统
│   │   ├── notificationManager.ts # 通知管理器
│   │   ├── ToastContainer.tsx     # Toast 容器
│   │   └── index.ts
│   ├── components/            # UI 组件
│   │   ├── Spotlight/         # Spotlight 组件
│   │   ├── ShortcutDisplay.tsx
│   │   ├── StateIndicator.tsx
│   │   ├── ProgressIndicator.tsx
│   │   ├── GlobalShortcutHandler.tsx
│   │   ├── Navbar.tsx
│   │   ├── UIDesignSystem.tsx
│   │   └── index.ts
│   ├── interactions/          # 交互模式
│   │   └── interactionPatterns.ts
│   ├── styles/                # 样式
│   │   ├── designTokens.ts    # 设计令牌
│   │   └── globalStyles.ts
│   └── index.ts               # 统一导出
├── examples/                  # 示例代码
│   ├── AIExample.tsx
│   ├── ThemeExample.tsx
│   ├── KeyboardShortcutsExample.tsx
│   └── NotificationExample.tsx
└── README.md
```

## 🎯 后续计划

1. **多终端协同** - 实现终端、AI、文件等多终端数据同步
2. **自动化流程引擎** - 支持自动化任务配置
3. **插件系统** - 支持第三方插件
4. **云同步** - 配置和数据云同步
5. **性能优化** - 大数据量下的性能优化

---

**有任何问题请查看文档或联系开发团队！**
