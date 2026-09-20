# 迁移指南

## 从旧版 AI 系统迁移到统一 AI 中台

### 1. terminal 迁移

#### 旧版代码

```typescript
// src/services/aiClient.ts
import type { AIMessage, AIClient, AIConfig } from "../types/ai";

export class OpenAIClient implements AIClient {
  constructor(private config: AIConfig) {}

  async chat(messages: AIMessage[]): Promise<string> {
    // ...
  }

  async explainCommand(command: string): Promise<CommandExplanation> {
    // ...
  }

  async analyzeError(error: string): Promise<ErrorAnalysis> {
    // ...
  }

  async commandFromNaturalLanguage(text: string): Promise<string> {
    // ...
  }
}

// src/stores/aiStore.ts
export const useAIStore = create((set, get) => ({
  config: { provider: 'openai', apiKey: '', model: 'gpt-4o-mini' },
  setConfig: (config) => set({ config }),
  // ...
}));
```

#### 新版代码

```typescript
// 新版 - 使用统一 AI 中台
import { useAIManager } from 'z-biz-tool-shared/ai';

// 替换 useAIStore 为 useAIManager
const { config, updateConfig, executeAI } = useAIManager();

// 旧的 API 方法调用
// await client.chat(messages);
// await client.explainCommand(command);
// await client.analyzeError(error);

// 新的 API 方法调用
const result = await useAIManager.getState().executeAI('chat', { messages });
const result = await useAIManager.getState().executeAI('explain', { text: command });
const result = await useAIManager.getState().executeAI('analyze', { text: error });
```

### 2. aigen 迁移

#### 旧版代码

```typescript
// src/stores/aiStore.ts
export const useAiStore = create((set, get) => ({
  generateImage: async (prompt) => {
    const urls = await invoke<string[]>("generate_image", { prompt });
    return urls;
  },
  // ...
}));
```

#### 新版代码

```typescript
// 新版 - 使用统一 AI 中台
import { useAIGenStore } from './aiStore'; // 使用新的 aigen store
import { useAIManager } from 'z-biz-tool-shared/ai';

// 替换 generateImage 方法
const { generateImage } = useAIGenStore();

// 内部实现已切换到统一 AI 中台
// generateImage 内部调用 useAIManager.getState().executeAI('image', { prompt })
```

## 类型迁移

### 旧版类型

```typescript
// src/types/ai.ts
export type AIProvider = "openai" | "claude" | "gemini" | "ollama" | "custom";
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
}
```

### 新版类型

```typescript
// 新版类型保持兼容
import { 
  AIProvider as CoreAIProvider, 
  AIConfig as CoreAIConfig 
} from 'z-biz-tool-shared/ai/types';

// 保持向后兼容
export type AIProvider = CoreAIProvider;
export type AIConfig = CoreAIConfig;
```

## 配置迁移

### 旧版配置

```typescript
// 本地存储: z-terminal:ai-config
{
  "provider": "openai",
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 2048
}
```

### 新版配置

```typescript
// 配置自动同步到统一 AI 中台
useAIManager.getState().updateConfig({
  provider: 'openai',
  apiKey: 'sk-...',
  baseUrl: 'https://api.openai.com/v1',
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2048
});

// 本地存储保持不变，确保向后兼容
```

## API 变更

### 删除的 API

以下 API 已删除，请使用新的统一 API：

| 旧 API | 新 API |
|--------|--------|
| `useAIStore` | `useAIManager` |
| `client.chat()` | `executeAI('chat', { prompt })` |
| `client.explainCommand()` | `executeAI('explain', { text })` |
| `client.analyzeError()` | `executeAI('analyze', { text })` |
| `client.commandFromNaturalLanguage()` | `executeAI('natural-language', { text })` |

### 新增的 API

#### AI 管理器

```typescript
// 执行 AI 任务
useAIManager.getState().executeAI(
  functionType: AIFunctionType,
  params?: Record<string, unknown>,
  context?: AIContext
): Promise<AIResult>

// 获取可用模型
useAIManager.getState().getModels(): Promise<string[]>

// 更新配置
useAIManager.getState().updateConfig(partial: Partial<AIConfig>)

// 设置上下文
useAIManager.getState().setContext(context: AIContext)

// Agent 管理
useAIManager.getState().addAgent(agent: Agent)
useAIManager.getState().removeAgent(agentId: string)
```

#### 通知管理器

```typescript
// 显示通知
toastManager.success(message: string, duration?: number): string
toastManager.error(message: string, duration?: number): string
toastManager.warning(message: string, duration?: number): string
toastManager.info(message: string, duration?: number): string

// 移除通知
toastManager.remove(id: string): void
toastManager.clear(): void
```

#### 快捷键管理器

```typescript
// 注册快捷键
shortcutManager.register(category: string, key: string, config: ShortcutConfig): boolean

// 注销快捷键
shortcutManager.unregister(category: string, key: string): void

// 获取快捷键
shortcutManager.get(category: string, key: string): ShortcutConfig | undefined

// 获取所有快捷键
shortcutManager.getAll(): Record<string, ShortcutConfig>
```

## 迁移检查清单

- [ ] 替换 `useAIStore` 为 `useAIManager`
- [ ] 更新所有 AI 功能调用为新的 `executeAI` API
- [ ] 更新配置保存逻辑以同步到统一 AI 中台
- [ ] 更新类型导入为新的统一类型
- [ ] 测试所有 AI 功能是否正常工作
- [ ] 更新 UI 以使用新的通知系统
- [ ] 添加快捷键注册和冲突检测
- [ ] 测试主题切换是否正常工作

## 故障排除

### 问题: API Key 丢失

**解决方案**: 确保配置保存逻辑已更新，将 API Key 同步到统一 AI 中台。

### 问题: 快捷键冲突

**解决方案**: 使用 `shortcutManager.register()` 自动检测冲突。

### 问题: 主题样式不应用

**解决方案**: 确保在应用根组件使用 `<ThemeProvider>` 和 `<ThemeStyles>`。

## 支持

如有问题，请查看:
- [开发文档](./DEV_GUIDE.md)
- [使用示例](./examples/)
- [类型定义](./src/ai/types.ts)
