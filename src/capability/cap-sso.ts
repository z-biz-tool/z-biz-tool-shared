// cap-sso 命令契约（z-biz-tool-capability crates/cap-sso 0.1.0）。
//
// 能力边界：OAuth 回调的本地监听、密钥保管、外部浏览器打开。
// 纯 Rust，不依赖 Tauri（`open_url_with_tauri` 是可选胶水层）。

/** 回调服务启动结果 */
export interface CallbackServerInfo {
  /** 实际监听的端口 */
  port: number;
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * ⚠️ `waitForCallback` 是**阻塞**的：薄壳里应放进 blocking 线程，
 * 别让 IPC 线程整条往返堵住（file 仓的 `calculate_file_hash` 就是这个坑的先例）。
 */
export interface CapSsoCommands {
  /** 启动本地回调监听（等待浏览器跳回来） */
  ssoStartCallbackServer: {
    args: { path?: string; timeoutSecs?: number; port?: number };
    returns: CallbackServerInfo;
  };
  /** 等待回调返回（阻塞） */
  ssoWaitForCallback: { args: Record<string, never>; returns: string };
  /** 校验 URL 可用于打开（拒绝非 http/https） */
  ssoValidateUrl: { args: { url: string }; returns: void };
  /** 用系统默认浏览器打开 URL */
  ssoOpenUrl: { args: { url: string }; returns: void };
  /** 写密钥（进系统钥匙串 / 凭据存储） */
  ssoSetSecret: { args: { account: string; value: string }; returns: void };
  /** 读密钥 */
  ssoGetSecret: { args: { account: string }; returns: string };
  /** 删密钥 */
  ssoDeleteSecret: { args: { account: string }; returns: void };
  /** 密钥后端是否可用（无钥匙串环境返回错误） */
  ssoCheckKeychain: { args: Record<string, never>; returns: void };
}

/** 错误文案稳定值（Rust 侧错误串的前缀，按 startsWith 匹配） */
export const CapSsoErrors = {
  /** 回调等待超时 */
  CallbackTimeout: "超时",
  /** URL 协议不允许 */
  UrlNotAllowed: "不允许的 URL",
  /** 密钥后端不可用 */
  SecretStoreUnavailable: "密钥存储不可用",
} as const;
