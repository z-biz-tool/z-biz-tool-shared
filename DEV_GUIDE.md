# z-biz-tool-shared 开发文档

## 项目概述

z-biz-tool-shared 是 z-biz-tool 系列工具的共享核心模块，提供统一的 AI 能力、主题系统、快捷键系统和通知系统。

## 模块结构

```
z-biz-tool-shared/
├── src/
│   ├── ai/              # AI 能力中台
│   │   ├── types.ts     # 类型定义
│   │   ├── AIManager.ts # AI 管理器 (Zustand Store)
│   │   └── context.ts   # 上下文管理器
│   ├── theme/           # 主题系统
│   │   ├── types.ts     # 类型定义
│   │   ├── themeManager.ts # 主题管理器
│   │   └── ThemeContext.tsx  # React Context
│   ├── shortcuts/       # 快捷键系统
│   │   ├── types.ts     # 类型定义
│   │   └── shortcutManager.ts # 快捷键管理器
│   ├── notifications/   # 通知系统
│   │   ├── types.ts     # 类型定义
│   │   ├── notificationManager.ts # 通知管理器
│   │   └── ToastContainer.tsx     # Toast 组件
│   ├── components/      # 共享组件
│   │   ├── ShortcutDisplay.tsx
│   │   ├── StateIndicator.tsx
│   │   └── ProgressIndicator.tsx
│   └── index.ts         # 统一导出
├── examples/            # 使用示例
│   ├── AIExample.tsx
│   ├── ThemeExample.tsx
│   ├── KeyboardShortcutsExample.tsx
│   └── NotificationExample.tsx
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 安装依赖

```bash
cd z-biz-tool-shared
npm install
```

### 运行示例

```bash
npm run dev
```

## 核心功能

### 1. AI 能力中台

统一的 AI 服务管理，支持多种 AI 提供商和功能类型。

#### 主要功能

- **统一配置管理**: 所有 AI 相关配置集中管理
- **多提供商支持**: OpenAI、Claude、Gemini、Ollama
- **多种功能类型**: 聊天、命令解释、错误分析、代码生成、图像生成等
- **上下文管理**: 自动传递文件、知识库、会话历史等上下文信息

#### 使用示例

```typescript
import { useAIManager } from 'z-biz-tool-shared/ai';
import { toastManager } from 'z-biz-tool-shared/notifications';

// 读取配置
const { config } = useAIManager();

// 设置配置
useAIManager.getState().updateConfig({
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  temperature: 0.7
});

// 执行 AI 任务
const result = await useAIManager.getState().executeAI('chat', {
  prompt: '解释这个命令: ls -la'
});

if (result.success) {
  console.log(result.content);
} else {
  toastManager.error(result.error);
}

// 获取可用模型
const models = await useAIManager.getState().getModels();
```

#### 可用功能类型

```typescript
type AIFunctionType = 
  | 'chat'              // 聊天对话
  | 'explain'           // 命令解释
  | 'analyze'           // 错误分析
  | 'generate'          // 文本生成
  | 'code'              // 代码生成/重构
  | 'git-commit'        // Git 提交信息生成
  | 'image'             // 图像生成
  | 'video'             // 视频生成
  | 'ppt'               // PPT 生成
  | 'natural-language'  // 自然语言转命令
  | 'classify'          // 分类
  | 'summarize'         // 摘要生成
  | 'health-check'      // 健康检查
  | 'auto-fix';         // 自动修复
```

### 2. 主题系统

统一的主题管理，支持多种预设主题和自定义主题。

#### 主题列表

- dark (深色)
- light (浅色)
- dracula (Dracula)
- solarized (Solarized)
- tokyo-night (东京夜景)
- nord (北欧)
- one-dark (One Dark)
- monokai (Monokai)
- ayu (Ayu)
- gruvbox (Gruvbox)

#### 使用示例

```typescript
import { ThemeProvider, useTheme, ThemeStyles } from 'z-biz-tool-shared/theme';

// 在应用根组件使用
const App = () => (
  <ThemeProvider>
    <ThemeStyles />
    <AppContent />
  </ThemeProvider>
);

// 在子组件中使用主题
const ThemedComponent = () => {
  const { currentTheme, themeColors, setTheme } = useTheme();
  
  return (
    <div style={{ backgroundColor: themeColors.background }}>
      <h1 style={{ color: themeColors.primary }}>标题</h1>
      <button style={{ backgroundColor: themeColors.primary }}>
        按钮
      </button>
    </div>
  );
};
```

### 3. 快捷键系统

统一的快捷键管理，支持冲突检测和快捷键显示。

#### 使用示例

```typescript
import { shortcutManager } from 'z-biz-tool-shared/shortcuts';

// 注册快捷键
shortcutManager.register('ai', 'assistant', {
  description: '打开 AI 助理',
  category: 'AI功能',
  action: () => {
    console.log('打开 AI 助理');
  }
});

// 注销快捷键
shortcutManager.unregister('ai', 'assistant');

// 显示快捷键
<ShortcutDisplay keys={['Ctrl+Shift+A', 'Cmd+K']} />
```

### 4. 通知系统

统一的通知系统，支持多种类型的通知。

#### 使用示例

```typescript
import { toastManager } from 'z-biz-tool-shared/notifications';

// 显示不同类型的通知
toastManager.success('操作成功');
toastManager.error('操作失败');
toastManager.warning('警告');
toastManager.info('信息');

// 自定义时长
toastManager.success('消息', 5000); // 5秒后消失

// 在应用根组件添加 ToastContainer
<ToastContainer />
```

## 集成指南

### 在新项目中集成

1. **安装依赖**

```bash
npm install z-biz-tool-shared
```

2. **导入模块**

```typescript
// AI 中台
import { useAIManager } from 'z-biz-tool-shared/ai';

// 主题系统
import { ThemeProvider, useTheme, ThemeStyles } from 'z-biz-tool-shared/theme';

// 快捷键系统
import { shortcutManager, useShortcutStore } from 'z-biz-tool-shared/shortcuts';

// 通知系统
import { toastManager, ToastContainer } from 'z-biz-tool-shared/notifications';
```

3. **在应用中使用**

```typescript
import React from 'react';
import { ThemeProvider, ThemeStyles } from 'z-biz-tool-shared/theme';

const App = () => (
  <ThemeProvider>
    <ThemeStyles />
    <AppContent />
  </ThemeProvider>
);

export default App;
```

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 使用 ESLint + Prettier
- 遵循 React 最佳实践

### 目录结构

```
src/
├── [module]/
│   ├── types.ts          # 类型定义
│   ├── [Module].ts(x)    # 主要实现
│   └── [sub-module].ts(x) # 子模块
├── components/
│   └── [Component].tsx   # 共享组件
└── index.ts              # 统一导出
```

### 命名规范

- 类型定义: `PascalCase` (如 `AIFunctionType`)
- 接口: `PascalCase` + `I` 前缀 (如 `IAIConfig`)
- 组件: `PascalCase` (如 `ToastContainer`)
- Hook: `use[Name]` (如 `useAIManager`)
- 常量: `UPPER_SNAKE_CASE` (如 `MAX_HISTORY_SIZE`)

## 贡献指南

欢迎提交 Issue 和 PR！

### 开发流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

MIT
