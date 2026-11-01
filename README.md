# z-biz-tool-shared

> z-biz-tool 家族共享层 —— AI 接入、主题、快捷键、通知、SSO、深链协议与公共组件，
> 被 17 个产品仓共同依赖的纯 TypeScript 库（非 Tauri 产品，不发 DMG）。

![tech](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![tech](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![tech](https://img.shields.io/badge/AntD-6-0170FE?logo=antdesign)
![license](https://img.shields.io/badge/license-MIT-green)

---

## 模块总览

| 模块 | 干什么 | 说明 |
|---|---|---|
| `shared/ai` | **AI 能力中台** | 家族统一 AI 配置面板（厂商卡片墙，一次配置全家通用）+ 上下文与私有端点管理；底层协议归一走 `cap-llm` |
| `shared/agent` | Agent 员工组件 | AgentManager / AgentPanel / SQL 编辑器 / 查询历史等可复用面板 |
| `shared/capability` | 能力层调用契约 | **只放契约，不放实现** —— 每个文件对应 `z-biz-tool-capability` 下的一个 crate |
| `shared/protocol` | 跨产品通信契约 | zBiz 家族统一协议（深链等），规范来源 lead 矩阵规划 04 |
| `shared/sso` | 统一 SSO（前端侧） | ctc 侧登录态；IO 胶水（回调服务器 / 密钥库）在 `cap-sso` |
| `shared/theme` | 主题系统 | 全家族统一的主题变量与切换 |
| `shared/shortcuts` | 快捷键系统 | 声明式注册 + `GlobalShortcutHandler` |
| `shared/notifications` | 通知系统 | 统一 toast / 通知通道 |
| `shared/components` | 共享组件 | Spotlight 命令面板、Navbar、ProgressIndicator、UIDesignSystem 等 |
| `shared/interactions` | 交互模式 | 跨仓统一的交互 pattern |
| `shared/styles` | 样式 | 公共样式变量 |
| `shared/hash` | 哈希 TS 孪生 | **金标是 Rust `cap-hash`**，此份用于前端一致性校验 |
| `shared/testkit` | 契约测试公共件 | 各仓「前端 invoke ⇄ Rust `#[tauri::command]`」门禁用 |
| `shared/types` | 公共类型 | 跨仓共享的 TS 类型 |

## 设计原则

- **契约与实现分离**：`capability` 目录只放调用契约，实现在 `z-biz-tool-capability`（Rust）
- **金标在 Rust 侧**：涉及双实现的逻辑（如哈希），Rust 是金标，TS 侧是孪生
- **库不是产品**：不打包、不发版 DMG，只随各产品仓的构建被依赖

## 使用

```ts
import { AIManager } from 'z-biz-tool-shared/ai';
import { theme } from 'z-biz-tool-shared/theme';
```

子路径导出见 `package.json` 的 `exports` 字段（`./ai`、`./agent`、`./theme`、`./shortcuts`、`./sso` 等 18 条）。

## 许可

MIT
