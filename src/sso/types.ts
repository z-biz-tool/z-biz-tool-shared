/**
 * zBiz 家族统一 SSO（ctc 侧）的**类型与配置**。
 *
 * ## 这一层解决什么
 *
 * 家族有 17 个仓，任何一个要接 ctc 统一登录，都得重复实现同一套东西：
 * 拼授权 URL → 跳浏览器 → 本地回环收 code → 换 token → 解析用户信息 → 存盘。
 *
 * 这套流程里有 **6 个容易各自写错**的点：
 *
 * 1. **PKCE**：桌面端是公开客户端，必须带 code_verifier/challenge，
 *    不带的话 ctc 侧按「可被冒充的客户端」处理，多半直接拒。
 * 2. **state**：防 CSRF。少写这一行意味着有人能构造一个链接把你的账号
 *    登进别人的身份里。**不能因为「本地应用没人攻击」就省**。
 * 3. **回环端口**：授权码模式下 redirect_uri 必须是本机端口，
 *    而且要先占端口再跳浏览器 —— 顺序反了会拿到「回调地址被占用」。
 * 4. **code 只能用一次**：重放第二次会被 ctc 拒绝，表现为「刚登录成功又报失败」。
 * 5. **token 落盘**：access_token 是敏感凭据，不能明文放 localStorage。
 * 6. **错误要说人话**：`redirect_uri_mismatch` 这类 code 直抛给用户等于没报错。
 *
 * 所以这里把**流程**定死，把 **ctc 的具体参数**（域名、client_id、scope）
 * 全部留成配置项。各仓只填配置，不写流程。
 *
 * ## 为什么是「可选的」
 *
 * SSO 是**可选登录方式**，不是必选门槛：
 * - 用户不登录 → 本地功能照常用（家族定位本来就是「用户自带 Key / 本地优先」）。
 * - 用户登录 → 拿到身份标识，用于云端同步等增值能力。
 *
 * 所以本模块的所有入口都返回「成功 / 未登录 / 出错」三态，
 * 绝不把「没登录」当成错误抛给用户。
 */

/* ------------------------------------------------------------------ *
 * 配置
 * ------------------------------------------------------------------ */

/**
 * ctc 统一 SSO 的接入配置。
 *
 * 由各仓在自己的配置层提供（可以是编译期常量，也可以是用户填的），
 * 本模块不内置任何 ctc 的真实值 —— 那是会过期且不该散落在 17 个仓里的数据。
 */
export interface SsoConfig {
  /** ctc 授权服务器的授权端点（不含 query）。 */
  authorizeUrl: string;

  /** ctc 授权服务器的 token 端点。 */
  tokenUrl: string;

  /** OIDC 用户信息端点。没有就不拉 userinfo，身份只用 id_token 里的声明。 */
  userInfoUrl?: string;

  /** 在 ctc 侧注册的应用 id。 */
  clientId: string;

  /** 申请的权限范围。空格分隔（如 `openid profile email`）。 */
  scope: string;

  /**
   * 本地回环重定向地址。
   *
   * **必须与 ctc 侧登记的一致**（通常登记 `http://127.0.0.1:<固定端口>/callback`）。
   * OAuth2 授权码模式下这个地址必须精确匹配，`redirect_uri_mismatch` 的头号成因
   * 就是「本地端口随机、登记的是固定端口」。
   */
  redirectUri: string;

  /** 是否强制 PKCE。默认 true —— 桌面端是公开客户端，不带会被拒。 */
  pkce?: boolean;

  /**
   * 是否要求 OIDC 的 id_token。
   *
   * 默认 true：只要了 `openid` scope，OIDC 规范要求 id_token 必须存在。
   * 关掉它只在 ctc 不是严格 OIDC 时才需要。
   */
  requireIdToken?: boolean;
}

/* ------------------------------------------------------------------ *
 * 身份
 * ------------------------------------------------------------------ */

/**
 * SSO 拿到的用户身份。
 *
 * 字段名取 OIDC UserInfo 的标准名（`sub` / `name` / `email` / `preferred_username`），
 * 这样 ctc 换成标准 OIDC Provider 时不需要改各仓。
 */
export interface SsoUser {
  /** 用户唯一标识（OIDC 的 `sub`）。跨应用识别同一个人靠它。 */
  subject: string;

  /** 显示名（OIDC 的 `name`）。可能为空。 */
  displayName: string | null;

  /** 邮箱（OIDC 的 `email`）。可能为空。 */
  email: string | null;

  /** 用户名（OIDC 的 `preferred_username`）。可能为空。 */
  username: string | null;

  /** ctc 侧的角色/租户信息，原样透传。 */
  raw: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * 会话
 * ------------------------------------------------------------------ */

/**
 * 一次成功的登录所产生的结果。
 */
export interface SsoSession {
  /** 访问令牌。给 ctc 的 API 带上它。 */
  accessToken: string;

  /** 刷新令牌。用于换新的 access token。 */
  refreshToken: string | null;

  /** access token 的过期时间（毫秒时间戳）。ctc 没给就为 null。 */
  expiresAt: number | null;

  /** token 类型，通常是 `Bearer`。 */
  tokenType: string;

  /** 用户身份。 */
  user: SsoUser;
}

/* ------------------------------------------------------------------ *
 * 结果类型
 * ------------------------------------------------------------------ */

/**
 * SSO 操作的结果。
 *
 * 三态而不是两态 —— 因为「用户没登录」和「登录出错」在界面上的处理完全不同：
 * 前者不该弹红字（那是正常状态），后者必须弹。
 */
export type SsoResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; code: SsoErrorCode };

/**
 * SSO 错误码。
 *
 * 分开的意义：界面可以对「用户取消」静默，对「配置错了」给出明确指引。
 */
export type SsoErrorCode =
  /** 用户主动取消/关闭浏览器。 */
  | "cancelled"
  /** 本地回环端口拿不到 / 起不来。 */
  | "local_server"
  /** 跳浏览器失败。 */
  | "browser"
  /** 授权服务器返回了错误（error/error_description）。 */
  | "authorization"
  /** 换 token 失败。 */
  | "token"
  /** 拉 userinfo 失败。 */
  | "userinfo"
  /** 拿到的响应不符合预期（缺字段、不是 JSON）。 */
  | "malformed"
  /** 配置不完整或非法。 */
  | "config"
  /** 网络错误。 */
  | "network"
  /** 不该发生的兜底。 */
  | "unknown";
