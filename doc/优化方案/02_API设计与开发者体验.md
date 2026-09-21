# z-biz-tool-shared 优化方案 · 02 API 设计与开发者体验

> 状态：设计方案，未实现；基线 `fbda8d6`；当前事实 = 静态代码证据，指标 = 拟定验收目标。
> 本篇是"库项目"的产品能力篇——把"产品体验"落到**公共 API 面、类型契约、易用性、文档与 examples 质量**四个维度。所有 API 建议均为规划新增，非既有实现；引用既有源码时给出 `../../src/...` 证据。

---

## 一、API 设计第一性原则

一个被 10 个下游依赖的共享库，其"产品"就是**公共 API 面（public API surface）**。评价标准只有三条：

1. **可发现（Discoverable）**：下游打开 IDE，输入 `import { } from 'z-biz-tool-shared'` 能被自动补全引导到正确符号，而不是面对 `export *` 汇聚的重名迷雾。
2. **可预期（Predictable）**：同名符号只有一个来源；一个 API 的行为与其类型签名、文档描述三者一致。
3. **可依赖（Dependable）**：真实能力与占位 stub 泾渭分明；破坏性变更有版本号与迁移路径兜底（见 [04](./04_稳定性兼容与发布安全.md)）。

当前库三条都不达标（证据见 [01 A-3/A-6/A-9](./01_现状审计与问题清单.md)）。下面给出收敛方案。

## 二、公共 API 面收敛方案

### 2.1 分层导出：单一根入口 + 稳定子路径

推荐采用 zod / tsup 维护的现代 TS 库通行的"根入口 + 显式子路径"双层结构（对标其**理念**，非复制代码）：

```
z-biz-tool-shared            → 精选根入口，只放最常用、跨模块无歧义的符号
z-biz-tool-shared/ai         → AI 中台全部导出
z-biz-tool-shared/agent      → Agent 套件全部导出
z-biz-tool-shared/theme      → 主题（归一后单一来源）
z-biz-tool-shared/shortcuts  → 快捷键
z-biz-tool-shared/notifications → 通知
z-biz-tool-shared/components → 无 antd 依赖的轻量 UI 组件
z-biz-tool-shared/tokens     → 归一后的设计令牌（唯一）
```

子路径映射由 `package.json` 的 `exports` 字段声明（构建落地见 [03 §4](./03_架构与工程化优化.md)）。**关键约束**：子路径导入不再依赖 `src` 直连（现状 file 项目用的 `z-biz-tool-shared/src/agent/AgentManager` 属反模式，必须在迁移中改为 `z-biz-tool-shared/agent`）。

### 2.2 根入口去 `export *`，改显式重导出

现状 [`../../src/index.ts:2-9`](../../src/index.ts) 对 8 模块 `export *`，靠 L11-12 注释与 L13-36 手工白名单规避重名。推荐改为：**根入口只显式 re-export 每个模块的"门面符号"**，其余走子路径。示例（规划新增，非现状）：

```ts
// src/index.ts —— 规划目标形态
export { useAIManager, type AIConfig, type AIResult } from './ai';
export { useAgentStore, AgentPanel, type AgentMessage } from './agent';
export { ThemeProvider, useTheme, type ThemeName } from './theme';   // 归一后唯一来源
export { shortcutManager, useShortcutStore } from './shortcuts';
export { toastManager, ToastContainer } from './notifications';
export { DESIGN_TOKENS } from './tokens';                            // 归一后唯一令牌
export { AppShell, Omnibar, TabsBar } from './shared';
```

好处：① 根入口导出面 = 一份可读清单，无需注释解释"为什么这个不导出"；② 重名符号（ThemeProvider/useTheme/EmptyState）在源头消除，不再由书写顺序决定归属。

### 2.3 重名符号归一决策表（P0）

| 重名符号 | 现有来源 | 决策（唯一出口） | 迁移 |
|----------|----------|------------------|------|
| `useTheme` / `ThemeProvider` | `src/theme/ThemeContext.tsx`（10 主题）与 `src/shared/ThemeContext.tsx`（明暗两态，依赖 antd） | **保留 `src/theme` 版为唯一 `useTheme`**；shared 版重命名为 `useThemeMode`/`ThemeProviderMode`（表达"仅明暗"语义）或并入 theme 模块作为 `mode` 子能力 | shared 版标 `@deprecated`，一个 minor 后移除 |
| `EmptyState` | `src/components/UIDesignSystem.tsx:141` 与 `src/shared/States.tsx` | 保留 `components` 版（轻量无 antd）为根入口导出；shared 版经 `z-biz-tool-shared/components` 子路径按需 | 二者 Props 对齐或明确分工 |
| `DESIGN_TOKENS` vs `radius/shadow` vs `COLORS/SPACING` | 三套令牌（见 [01 A-5](./01_现状审计与问题清单.md)） | **收敛为一套**，命名与值类型统一（见 §4） | 旧令牌名保留 re-export + `@deprecated` |

## 三、类型契约完整性

### 3.1 消除公共 API 上的 `any`（P1）

现状 8 处 any（[01 A-13](./01_现状审计与问题清单.md)），其中直接暴露在公共签名的：

| 位置 | 现状签名 | 建议契约 |
|------|----------|----------|
| [`../../src/agent/AgentManager.ts:12`](../../src/agent/AgentManager.ts) | `analyze(sql, results: any)` | `analyze(sql: string, results: AgentQueryResult)`，新增 `AgentQueryResult` 类型 |
| [`../../src/agent/SQLEditor.tsx:9`](../../src/agent/SQLEditor.tsx) | `onExecute?: (sql) => Promise<any>` | `onExecute?: (sql: string) => Promise<AgentResponse \| void>` |
| [`../../src/ai/AIManager.ts:86`](../../src/ai/AIManager.ts) | `data.data.map((m: any) => m.id)` | 定义内部 `OpenAIModelListResponse` 类型（不外泄，但消除 any） |

验收目标：**公共 API 面 0 个 `any`**（内部实现允许受控使用，但需 lint 白名单标注）。

### 3.2 关联类型必须一并导出

现状 `AgentStore`/`AIStore`/`ThemeStore`/`ShortcutStore`/`NotificationStore` 等 store 接口均为模块内 `interface`（如 [`../../src/ai/AIManager.ts:132-144`](../../src/ai/AIManager.ts) 的 `AIStore` 未 export），下游拿不到 store 的完整类型，无法安全地 `useAIManager.getState()` 做类型推导。建议：所有 store 接口 `export`，并在子路径与根入口按门面暴露。

### 3.3 配置类型补运行时校验

`AIConfig`（[`../../src/ai/types.ts:22-30`](../../src/ai/types.ts)）、`ThemeName`（[`../../src/theme/types.ts:3-13`](../../src/theme/types.ts)）目前是纯 TS 类型，运行时无校验。`initTheme` 从 localStorage 读出的字符串直接 `as ThemeName`（[`../../src/theme/themeManager.ts:166`](../../src/theme/themeManager.ts)）——若存了非法值不会报错。建议：为 ThemeName / AIProvider 增加类型守卫（`isThemeName(v): v is ThemeName`），入库前校验，非法值回退默认。

## 四、设计令牌 API 统一（P1）

三套令牌收敛为**一套、小写、`as const`、值类型一致**。推荐以 [`../../src/shared/designTokens.ts`](../../src/shared/designTokens.ts) 的 `radius/shadow/size/motion/gradient/colors` 命名为基准（它已用 `as const` 且语义清晰），补齐 styles 版缺失的 `spacing/fontSize/color` 语义色：

```ts
// src/tokens/index.ts —— 规划目标形态（唯一令牌源）
export const radius = { small: 4, medium: 8, large: 12, round: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;   // number，统一单位 px
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 } as const;
export const shadow = { floating: '...', card: '...', elevated: '...' } as const;
export const motion = { fast: '0.15s ...', normal: '0.2s ...', slow: '0.3s ...' } as const;
export const colors = { primary: '#667eea', secondary: '#764ba2', ... } as const;
export const DESIGN_TOKENS = { radius, spacing, fontSize, shadow, motion, colors } as const; // 聚合入口
```

约定：**尺寸类令牌统一为 number（px）**，字符串只用于无法数值化的（shadow/gradient/motion）。旧 `COLORS/SPACING/BORDER_RADIUS`（styles 版）与 `DESIGN_TOKENS.borderRadius`（UIDesignSystem 版）保留为 `@deprecated` re-export 一个 minor 周期。

## 五、mock / stub 的 API 显性化（P1）

现状 AgentManager 四方法、InteractionFeedback 全组、ContextManager.loadFromFile/loadFromKnowledgeBase、QueryHistoryViewer.loadHistory 均为 stub（[01 A-9](./01_现状审计与问题清单.md)）。API 层面处理原则：

1. **能力分级标注**：JSDoc 加 `@experimental`（未稳定，可能破坏性变更）/ `@mock`（当前为占位实现，需下游注入真实服务）标签；
2. **依赖注入而非硬编码 mock**：AgentManager 的 `query/optimize/analyze/diagnoseError` 应接受一个 `AgentService` 接口注入（现状 [01 A-9] 的 TODO 正是缺注入点）。规划契约：

```ts
// 规划新增 —— 让下游注入真实 Agent 后端，库不再内置假实现
export interface AgentService {
  query(nl: string, ctx: AgentContext): Promise<AgentResponse>;
  optimize(sql: string, ctx: AgentContext): Promise<AgentResponse>;
  analyze(sql: string, results: AgentQueryResult, ctx: AgentContext): Promise<AgentResponse>;
  diagnoseError(error: string, sql: string, ctx: AgentContext): Promise<AgentResponse>;
}
export function configureAgentService(service: AgentService): void;
```

3. **从根入口移除纯占位导出**：`InteractionFeedback`（空函数体）不应出现在根入口 API 面；移至子路径并标 `@experimental`，或直接从公共 API 剔除直至有真实实现。

## 六、开发者体验：文档与 examples 质量重建（P0）

### 6.1 文档"声明 vs 实现"对齐

四份 GUIDE 的问题在 [01 A-6](./01_现状审计与问题清单.md) 已列证。重建原则：

| 文档 | 重建动作 |
|------|----------|
| `README.md` | 保持极简，加"快速开始 3 行 + 子路径导入表 + 指向 doc/优化方案" |
| `INTEGRATION_GUIDE.md` | **删除全部不存在 API**（AIManager class/Provider/useAIContext/generateText…），改为与源码一致的 `useAIManager` 用法；每个 import 示例必须能被 `tsc` 解析 |
| `DEV_GUIDE.md` | 移除"npm run dev 运行示例"（无此脚本），改为真实的 `npm run typecheck` / examples 编译流程 |
| `MIGRATION_GUIDE.md` | 保留，作为破坏性变更迁移模板（见 [04 §3](./04_稳定性兼容与发布安全.md)），但需修正 `useAIStore→useAIManager` 的"已完成"表述为"待下游执行" |
| `IMPLEMENTATION_SUMMARY.md` | 修正虚假 ✅：terminal/aigen 集成、功能/兼容测试实际未完成，改为诚实状态或转为历史归档并标注 |

### 6.2 examples 可编译、可运行

现状 5 个 example 均无法编译（[01 A-7](./01_现状审计与问题清单.md)）。重建目标：

1. examples 改用**子路径导入**（`z-biz-tool-shared/ai` 等）并与 `exports` 对齐；
2. examples 纳入独立 tsconfig（`tsconfig.examples.json`）参与 typecheck，但不进 `dist`；
3. 提供最小 vite playground（规划新增 `playground/`）承载 examples 真实运行，DEV_GUIDE 的"运行示例"指向它；
4. 每个 example 顶部注释标注"演示哪个子路径 API + 预期输出"。

验收目标：**examples 目录 typecheck 0 error，且至少 1 个 example 在 playground 真实渲染**。

### 6.3 IDE 体验

- 所有公共符号补 JSDoc（含 `@param`/`@returns`/`@example`/`@experimental`/`@deprecated`）；
- 令牌与配置类型用 `as const` + 字面量联合，保证下游自动补全得到具体值而非 `string`；
- 根入口导出面控制在**常用门面符号**（建议 ≤ 40 个），冷门符号走子路径，降低补全噪声。

## 七、本篇验收指标（量化，见 [06](./06_测试验收与风险清单.md) 汇总）

| 指标 | 现状 | 目标（拟定） |
|------|------|--------------|
| 根入口显式导出（非 `export *`） | 8×`export *`+白名单 | 100% 显式 re-export |
| 重名符号（同名多来源） | ≥3 组（useTheme/ThemeProvider/EmptyState/令牌） | 0 组 |
| 公共 API 面 `any` 数量 | 8 | 0 |
| store 接口导出率 | 0/5 | 5/5 |
| examples typecheck error | 全部无法编译 | 0 |
| 文档 import 示例可解析率 | 未验证（多处不存在） | 100% |
| 令牌系统数量 | 3 套 | 1 套（旧的 @deprecated 过渡） |

> 以上目标均为**拟定验收线**，未实现、未测量；落地排期见 [05](./05_实施路线与任务拆解.md)，测量方法见 [06](./06_测试验收与风险清单.md)。
