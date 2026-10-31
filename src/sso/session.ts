/**
 * zBiz 家族统一 SSO 的**会话存储**。
 *
 * ## 为什么这一层单独存在
 *
 * SSO 拿到的 access_token 是** bearer 凭据** —— 谁拿着它就能以用户的身份
 * 调 ctc 的接口。放在 `localStorage` 里有三个具体问题：
 *
 * 1. **同源的任何脚本都能读**。我们的应用是 Tauri WebView，
 *    `localStorage` 对应用内的所有页面（包括任何被注入的第三方内容）都是可读的。
 * 2. **明文落盘**。`~/.z-biz-tool-remote/state.json` 里如果是明文 token，
 *    任何能读用户家目录的进程都能拿到。
 * 3. **卸载残留**。localStorage 在应用退出后还在，用户重装应用后旧 token 仍然有效。
 *
 * ## 这里的策略
 *
 * - **access_token / refresh_token 不进 localStorage**。它们只放内存 +
 *   由各仓注入的**安全存储**（OS Keychain / credential store）。
 * - **localStorage 只放非敏感的展示信息**（用户 id、显示名、邮箱、过期时间），
 *   用途只有一个：让应用启动时能立刻显示「上次是谁登录的」，
 *   而不用等 Keychain 读取完成。
 * - 真正能用的登录态以安全存储里的 token 为准。展示信息与 token 不一致时，
 *   **以 token 为准**（token 过期了就当没登录，而不是显示一个假的登录态）。
 *
 * ## 依赖注入
 *
 * `SecureStore` 是注入的 —— 共享层不碰 Tauri 的 keyring 插件，
 * 各仓自己接（db/note 已经有 `SecretStore` trait，可以直接复用）。
 */

/* ------------------------------------------------------------------ *
 * 安全存储
 * ------------------------------------------------------------------ */

/**
 * 安全存储的抽象。
 *
 * 各仓已有类似实现（db/note 的 `SecretStore` trait、pet 的 `secret.rs`），
 * 照着实现一份就能接上。
 */
export interface SecureStore {
  /** 读一个值；没有则返回 null。 */
  get: (key: string) => Promise<string | null>;
  /** 写一个值。 */
  set: (key: string, value: string) => Promise<void>;
  /** 删一个值。 */
  delete: (key: string) => Promise<void>;
}

/* ------------------------------------------------------------------ *
 * 展示信息
 * ------------------------------------------------------------------ */

/**
 * 可以安全落盘的展示信息。
 *
 * **不含任何 token**。它的唯一用途是「启动时先给用户看一句『你好，某某』」。
 */
export interface SsoProfile {
  /** 用户唯一标识。 */
  subject: string;
  /** 显示名。 */
  displayName: string | null;
  /** 邮箱。 */
  email: string | null;
  /** 用户名。 */
  username: string | null;
  /** access token 的过期时间（毫秒时间戳）。 */
  expiresAt: number | null;
}

/* ------------------------------------------------------------------ *
 * 存储实现
 * ------------------------------------------------------------------ */

/** 安全存储里放 token 的键名。 */
const TOKEN_KEY = "z-biz-tool.sso.tokens";

/** localStorage 里放展示信息的键名。 */
const PROFILE_KEY = "z-biz-tool.sso.profile";

/**
 * token 的落盘形态。
 *
 * refresh_token 存在时一并无存 —— 否则每次会话过期都要重新走一遍浏览器授权，
 * 那对用户是灾难性的体验（每 1 小时弹一次浏览器）。
 */
interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  tokenType: string;
}

/**
 * SSO 会话存储。
 *
 * @param secureStore 安全存储（Keychain 等）
 * @param profileStore 展示信息的存储。默认用 localStorage。
 */
export class SsoSessionStore {
  private readonly secure: SecureStore;
  private readonly profile: Pick<Storage, "getItem" | "setItem" | "removeItem">;

  constructor(
    secure: SecureStore,
    profile?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  ) {
    this.secure = secure;
    this.profile =
      profile ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          });
  }

  /**
   * 存一次登录。
   *
   * token 进安全存储，展示信息进 localStorage。
   */
  async save(session: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number | null;
    tokenType: string;
    user: { subject: string; displayName: string | null; email: string | null; username: string | null };
  }): Promise<void> {
    const tokens: StoredTokens = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      tokenType: session.tokenType,
    };
    await this.secure.set(TOKEN_KEY, JSON.stringify(tokens));

    const p: SsoProfile = {
      subject: session.user.subject,
      displayName: session.user.displayName,
      email: session.user.email,
      username: session.user.username,
      expiresAt: session.expiresAt,
    };
    try {
      this.profile.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* 展示信息存不下不影响登录态 —— token 在安全存储里 */
    }
  }

  /**
   * 读当前登录态。
   *
   * **以安全存储为准**：localStorage 的展示信息只是缓存。
   * 安全存储里没有 → 就是没登录（哪怕 localStorage 里还留着上次的展示信息）。
   */
  async load(): Promise<{ tokens: StoredTokens; profile: SsoProfile | null } | null> {
    let raw: string | null;
    try {
      raw = await this.secure.get(TOKEN_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;

    let tokens: StoredTokens;
    try {
      tokens = JSON.parse(raw) as StoredTokens;
    } catch {
      // 存坏了就当没登录，但要把坏数据清掉 —— 否则每次启动都读一次坏数据。
      await this.secure.delete(TOKEN_KEY).catch(() => undefined);
      return null;
    }
    if (!tokens || typeof tokens.accessToken !== "string" || !tokens.accessToken) {
      return null;
    }

    let profile: SsoProfile | null = null;
    try {
      const rawProfile = this.profile.getItem(PROFILE_KEY);
      if (rawProfile) profile = JSON.parse(rawProfile) as SsoProfile;
    } catch {
      /* 展示信息坏了不影响登录态 */
    }

    return { tokens, profile };
  }

  /**
   * 当前 access token 是否已过期。
   *
   * 提前 60 秒判过期 —— 网络往返 + 服务端时钟偏差都可能吃掉最后几十秒，
   * 到点才发现过期的话，用户会看到一次本不该出现的「登录已失效」。
   */
  static isExpired(tokens: StoredTokens, skewMs = 60_000, now = Date.now()): boolean {
    if (tokens.expiresAt === null) return false; // ctc 没给过期时间 = 长期有效
    return tokens.expiresAt - skewMs <= now;
  }

  /** 清除登录态（退出登录）。 */
  async clear(): Promise<void> {
    await this.secure.delete(TOKEN_KEY).catch(() => undefined);
    try {
      this.profile.removeItem(PROFILE_KEY);
    } catch {
      /* 清不掉展示信息不影响正确性 */
    }
  }
}
