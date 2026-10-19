# z-biz-tool 核心库集成指南

> **本指南的每条 API 都对着源码核过。**
>
> 2026-10-20 重写：上一版宣称的 `AIManager` class、`AIManagerProvider`、
> `useAIContext()`、`generateText`/`generateCode`/`translate` 等 API
> **在 `src/` 里根本不存在**（01 A-6）。下游照着写必然踩空。
> 现在本指南里的每个符号都能在对应子路径的 `index.ts` 里找到。

## 📦 包结构

`z-biz-tool-shared` 是 z-biz-tool 系列应用的跨项目共享库。按**子路径**导出，
按需引入，避免把整个库（含 antd）打进不需要它的包里：

| 子路径 | 内容 | 主要导出 |
|---|---|---|
| `z-biz-tool-shared` | 根入口 | 各子路径的聚合（`export *` + 少量显式白名单） |
| `z-biz-tool-shared/ai` | AI 中台 | `useAIManager`、`contextManager`、`AIConfig` 等类型 |
| `z-biz-tool-shared/agent` | Agent 组件 | `AgentPanel`、`useAgentStore`、`SQLEditor` 等 |
| `z-biz-tool-shared/theme` | 主题系统 | `useThemeStore`、`useTheme`、`initTheme` |
| `z-biz-tool-shared/shortcuts` | 快捷键 | `shortcutManager`、`useShortcutStore` |
| `z-biz-tool-shared/notifications` | 通知 | `toastManager`、`useNotificationStore`、`ToastContainer` |
| `z-biz-tool-shared/components` | UI 组件 | `Spotlight`、`useSpotlight`、`Navbar`、`UIDesignSystem` 等 |
| `z-biz-tool-shared/interactions` | 交互模式 | `interactionPatterns` |
| `z-biz-tool-shared/styles` | 设计令牌 | `designTokens` 相关导出 |
| `z-biz-tool-shared/shared` | 布局/工具组件 | `AppShell`、`Omnibar`、`ThemeToggle`、`ThemeSelector` 等 |
| `z-biz-tool-shared/capability` | 跨端命令契约 | `ImageInfo`、`CapImgCommands` 等类型 |

> `react` / `antd` / `zustand` / `@ant-design/icons` 是 **peerDependencies** ——
> 由宿主应用提供，避免下游打进两份 React 实例。

## 🚀 快速开始

### 1. 安装

```bash
npm install z-biz-tool-shared
```

### 2. 按需导入

```typescript
// 推荐：走子路径，只引入用得上的部分
import { useAIManager } from 'z-biz-tool-shared/ai';
import { toastManager } from 'z-biz-tool-shared/notifications';
import { useTheme } from 'z-biz-tool-shared/theme';
```

也可以从根入口导入，但根入口是聚合面，**打包体积不会因此变小**。

## 📚 使用示例

### AI 中台

`useAIManager` 是一个 zustand store。**没有 class、没有 Provider、没有 Context hook** ——
上一版文档里的 `new AIManager(...)` / `<AIManagerProvider>` / `useAIContext()` 都不存在。

```typescript
import { useAIManager } from 'z-biz-tool-shared/ai';

function AIButton() {
  // 配置。apiKey 只在运行时注入，不要硬编码进代码
  useAIManager.getState().updateConfig({
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    apiKey: '<YOUR_API_KEY>',   // 从 Tauri keychain / 环境变量取
    timeout: 30000,             // 毫秒；<= 0 表示不设上限
  });

  const handleClick = async () => {
    const result = await useAIManager.getState().executeAI('chat', {
      prompt: '帮我写一个 hello world 程序',
    });

    if (result.success) {
      console.log(result.content);
    } else {
      console.error(result.error);   // 失败是返回值，不是抛异常
    }
  };

  return <button onClick={handleClick}>生成</button>;
}
```

#### provider 支持情况

每个 provider 走**自己的协议**（不再是"除 openai 外全部落进 OpenAI"）：

| provider | 协议 | 默认 baseUrl | apiKey |
|---|---|---|---|
| `openai` | OpenAI `/chat/completions` | `https://api.openai.com/v1` | 必填 |
| `claude` | Anthropic Messages API | `https://api.anthropic.com/v1` | 必填 |
| `gemini` | Google `generateContent` | `https://generativelanguage.googleapis.com/v1beta` | 必填 |
| `ollama` | OpenAI 兼容 | `http://localhost:11434/v1` | 可选 |
| `local` | OpenAI 兼容 | **无默认** —— 必须显式给 `baseUrl` | 可选 |

- 传了 `baseUrl` 就覆盖默认值。
- `provider: 'local'` 不猜本地服务地址：没给 `baseUrl` 时会**明确报错**而不是打到一个不存在的端口。
- 未知的 provider 值**明确报错**，不静默回落成 OpenAI。

#### 超时

`AIConfig.timeout` 真的会生效（毫秒，默认 30000）。超时会被转成
`AIResult.success === false`，`error` 形如 `请求超时（30000ms）`。

#### 在 Node 侧换掉 fetch

```typescript
import { setFetchImplementation } from 'z-biz-tool-shared/ai';

const restore = setFetchImplementation(myProxyFetch);   // 返回还原函数
```

这是给测试与 Tauri 后端准备的注入口 —— 测试因此不必去猴补 `globalThis.fetch`。

### 主题系统

库里有**两套主题**，各有各的用途，按需选：

**① 十主题预设**（`src/theme/themeManager.ts`）—— 适合需要具体配色表的场合：

```typescript
import { useThemeStore, initTheme } from 'z-biz-tool-shared/theme';

initTheme();   // 应用启动时调一次：读存储 → 校验 → 应用

const { currentTheme, themeConfig, setTheme, getThemeColors } = useThemeStore();
setTheme('dracula');
```

**② 明暗两态 + 跟随系统**（`src/shared/ThemeContext.tsx`）—— 适合常规应用：

```typescript
import { ThemeProvider, useTheme } from 'z-biz-tool-shared/shared';

<ThemeProvider>
  <YourApp />
</ThemeProvider>;

// 组件内
const { mode, preference, toggle, setPreference } = useTheme();
// mode: 'light' | 'dark'    —— 实际生效的模式
// preference: 'system' | 'light' | 'dark' —— 用户的偏好
setPreference('system');   // 回到跟随系统
```

> ⚠️ `useTheme` 在 `theme` 与 `shared` 两个子路径下**都存在**，但语义不同
> （前者是十主题 store，后者是明暗 context）。**从根入口导入时拿到的是
> `theme` 那一个** —— 需要明暗两态时请从 `z-biz-tool-shared/shared` 显式导入。

### 快捷键

```typescript
import { shortcutManager } from 'z-biz-tool-shared/shortcuts';

shortcutManager.register('editor', 'save', {
  description: '保存当前文件',
  category: '编辑器',
  action: () => console.log('保存'),
  enabled: true
});

shortcutManager.unregister('editor', 'save');
```

同一组合键被注册两次时，`register` 返回 `false` 并在控制台报冲突。
匹配时**修饰键会做归一化**（Ctrl ≡ ⌘），所以 `Cmd+S` 与 `Ctrl+S` 视为同一个键。

### 通知

```typescript
import { toastManager } from 'z-biz-tool-shared/notifications';

toastManager.success('操作成功！');
toastManager.error('操作失败！');
toastManager.warning('警告信息');
toastManager.info('提示信息');

// 自定义时长
toastManager.info('会显示 5 秒', 5000);

const id = toastManager.info('手动关闭');
toastManager.remove(id);
toastManager.clear();
```

- 每次调用的 id **保证互不相同**（自增计数器）—— 不会出现一个 `remove` 干掉两条 toast。
- 不传 `duration` 时默认 3000ms；传 `0` 表示不自动消失。
- `toastManager` 只有 `success`/`error`/`warning`/`info`/`remove`/`clear`
  六个方法，**没有 `show()`**（上一版文档里的 `show` 不存在）。

### Spotlight 命令面板

```typescript
import { Spotlight, SpotlightProvider, useSpotlight } from 'z-biz-tool-shared/components';

const spotlight = useSpotlight();

<SpotlightProvider>
  <YourApp />
  <Spotlight
    isOpen={spotlight.isOpen}
    onClose={spotlight.closeSpotlight}
  />
</SpotlightProvider>
```

### UI 组件

`z-biz-tool-shared/components` 里的 `UIDesignSystem` 提供了一套**不依赖 antd** 的轻量组件：

```typescript
import {
  Button, Input, Textarea, Card, Badge, Divider,
  Modal, Icon, EmptyState, LoadingSpinner, Skeleton
} from 'z-biz-tool-shared/components';
```

`EmptyState` / `LoadingState` / `ErrorState` 另有 `shared` 子路径版本（`src/shared/States.tsx`），
两者**同名但不同源** —— 根入口只导出 `shared` 那一份（见 `src/index.ts` 的显式白名单）。

### 设计令牌

```typescript
import { radius, shadow, size, motion, gradient } from 'z-biz-tool-shared/shared';
```

> 库内目前仍有**三套**令牌（`src/styles/designTokens.ts` 的 `COLORS`/`SPACING` 大写风格、
> `src/shared/designTokens.ts` 的小写风格、`UIDesignSystem` 的 `DESIGN_TOKENS`），
> 归一工作尚未完成（05 台账 T3.2）。**新代码请用 `shared` 子路径的小写那套**，
> 它是根入口显式导出的那一份。

## 🎨 主题预设

`src/theme/themeManager.ts` 内置 10 个主题：

`dark`、`light`、`dracula`、`solarized`、`tokyoNight`、`nord`、`oneDark`、
`monokai`、`ayu`、`gruvbox`

> 上一版文档列的是 `drift`/`midnight`/`sunrise`/`forest`/`ocean`/`sunset` ——
> **这六个在源码里不存在**，用 `setTheme('drift')` 会得到一份 `undefined` 配色。

## 📖 API 速查

### useAIManager（`z-biz-tool-shared/ai`）

| 成员 | 说明 |
|---|---|
| `config: AIConfig` | 当前配置（`provider`/`modelName`/`apiKey`/`baseUrl`/`temperature`/`maxTokens`/`timeout`） |
| `context: AIContext` | 上下文（`files`/`knowledgeBase`/`history`/`currentLanguage` 等） |
| `agents: Agent[]` | 已注册的 Agent |
| `setConfig(config)` | **整体替换**配置 |
| `updateConfig(partial)` | 合并更新（只覆盖传入的字段） |
| `setContext(context)` | 整体替换上下文 |
| `addAgent(agent)` / `removeAgent(id)` | Agent 增删 |
| `executeAI(type, params?)` | 执行一次 AI 调用 → `Promise<AIResult>` |
| `executeWithAgent(agentId, type, params?)` | 用指定 Agent 的模型执行 |
| `getModels()` | 拉取可用模型列表 |

`AIFunctionType` 支持：`chat` / `explain` / `analyze` / `generate` / `code` /
`git-commit` / `image` / `video` / `ppt` / `natural-language` / `classify` /
`summarize` / `health-check` / `auto-fix`。

> 只有一部分类型会走内置 prompt 模板（`explain`/`analyze`/`code`/`summarize`/
> `classify`/`git-commit`），其余类型直接把 `params.prompt` 发出去。

### useThemeStore（`z-biz-tool-shared/theme`）

| 成员 | 说明 |
|---|---|
| `currentTheme: ThemeName` | 当前主题名 |
| `themeConfig: ThemeConfig` | 当前主题的完整配置 |
| `setTheme(name)` | 切换主题并写入存储 |
| `updateTheme(partial)` | **深合并**更新配置（colors 是嵌套对象，逐字段合并） |
| `getThemeColors()` | 取当前配色 |

### shortcutManager（`z-biz-tool-shared/shortcuts`）

| 方法 | 说明 |
|---|---|
| `register(category, id, config)` | 注册；冲突时返回 `false` |
| `unregister(category, id)` | 注销 |
| `getAll()` | 全部已注册快捷键 |
| `hasConflict(key)` | 检查某组合键是否已被占用 |

### toastManager（`z-biz-tool-shared/notifications`）

| 方法 | 说明 |
|---|---|
| `success(message, duration?)` | 成功通知 |
| `error(message, duration?)` | 错误通知 |
| `warning(message, duration?)` | 警告通知 |
| `info(message, duration?)` | 信息通知 |
| `remove(id)` | 移除指定 toast |
| `clear()` | 清空全部 toast |

## 🔑 凭据与安全

- `apiKey` **只允许运行时注入**（`updateConfig`），来源应是 Tauri 侧的安全存储
  或环境变量。**不要写进代码、不要提交进仓库。**
- 库内没有任何一处 `console.*` 会打印 `config` 或 `apiKey`。
- 文档示例里的 `<YOUR_API_KEY>` 是占位符，不是可用凭据。

## 📦 源码结构

```
z-biz-tool-shared/
├── src/
│   ├── ai/                    # AI 中台
│   │   ├── AIManager.ts       # store（useAIManager）
│   │   ├── clients.ts         # provider 工厂与各协议客户端
│   │   ├── context.ts         # ContextManager
│   │   ├── types.ts
│   │   └── index.ts
│   ├── agent/                 # Agent 组件
│   ├── theme/                 # 主题系统
│   │   ├── ThemeContext.tsx   # 明暗 context（shared 那套）
│   │   ├── themeManager.ts    # 十主题 store
│   │   ├── themeMode.ts       # 主题偏好纯逻辑
│   │   └── types.ts
│   ├── shortcuts/             # 快捷键
│   ├── notifications/         # 通知
│   ├── components/            # UI 组件
│   ├── interactions/          # 交互模式
│   ├── styles/                # 设计令牌
│   ├── shared/                # 布局/工具组件
│   ├── capability/            # 跨端命令契约
│   └── index.ts               # 根导出（export * + 显式白名单）
├── tests/                     # 单元测试（node --test）
├── examples/                  # 示例
└── package.json
```

## ⚠️ 已知缺口

诚实起见，下列能力**当前不提供**，别照着想象用：

1. **Agent 相关方法是占位实现** —— `query`/`optimize`/`analyze`/`diagnoseError`
   返回的是模板文本，不连任何 Agent 服务（01 A-9）。
2. **两套主题 / 三套设计令牌并存** —— 归一尚未完成（05 台账 T3.1/T3.2）。
3. **`ContextManager.loadFromFile` / `loadFromKnowledgeBase` 是空实现** —— 只有 `console.log`。
4. **`InteractionFeedback.toast.*` 是空函数**。
5. **无鉴权/无 CSRF 保护** —— 这是前端库，鉴权由宿主应用负责。
6. **examples 尚未纳入 typecheck**（05 台账 T2.5 未落地）。

## 🎯 后续计划

1. **主题与令牌归一**（T3.1/T3.2）—— 合并两套主题、三套令牌。
2. **快捷键体系归一**（T3.3）—— `shortcutManager` 与 `useKeyboardShortcuts` 打通。
3. **Agent 服务注入**（T3.5）—— 引入 `AgentService` 接口，让占位实现可替换。
4. **API 报告锁定**（T3.8）—— 导出面进版本控制，变更走 diff 审查。
