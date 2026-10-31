// cap-hub 命令契约（z-biz-tool-capability crates/cap-hub 0.1.0）。
//
// cap-hub 是家族握手层：zbiz:// 深链的构造 / 解析 / 待处理队列 / 产品清单。
// 它的 TS 孪生已经落在 `z-biz-tool-shared/src/protocol/deeplink.ts`
// （字节级编解码必须两边一致），本文件描述的是 **IPC 面**：
// 各 app 的 Tauri 薄壳统一暴露 `zbiz_take_pending`，命令名由家族约定而非 crate 决定。

/** 深链交接内容（对应 Rust `cap_hub::Handoff`） */
export interface Handoff {
  /** 目标产品 id，如 `"note"` */
  product: string;
  /** 动作名，如 `"open"` */
  action: string;
  /** 查询参数（已解码） */
  params: Record<string, string>;
}

/** 产品清单条目（对应 Rust `cap_hub::manifest::ProductMeta`，serde camelCase） */
export interface ProductMeta {
  id: string;
  displayName: string;
  description: string;
  acceptsDeepLink: boolean;
  actions: string[];
  keywords: string[];
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * ⚠️ `takePending` 的 Rust 实现在**各 app 的 Tauri 薄壳**里
 * （`#[tauri::command] fn zbiz_take_pending`），不在 crate 内 ——
 * crate 只提供队列与协议本身，命令名由家族统一约定。
 */
export interface CapHubCommands {
  /** 取走待处理的深链队列（冷启动补取 / 事件触发后各调一次） */
  takePending: { args: Record<string, never>; returns: Handoff[] };
  /** 构造一条 zbiz:// 深链 */
  buildDeepLink: {
    args: { product: string; action: string; params: Record<string, string> };
    returns: { uri: string };
  };
  /** 解析一条 zbiz:// 深链 */
  parseDeepLink: { args: { uri: string }; returns: { ok: boolean; handoff?: Handoff; error?: string } };
  /** 家族里接受深链的产品清单 */
  listDeepLinkProducts: { args: Record<string, never>; returns: ProductMeta[] };
  /** 某个 id 是不是家族产品 */
  isKnownProduct: { args: { product: string }; returns: boolean };
}
