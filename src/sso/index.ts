/**
 * zBiz 家族统一 SSO（ctc 侧）。
 *
 * ## 分层
 *
 * | 层 | 在哪 | 管什么 |
 * |----|----|--------|
 * | 类型与配置 | `types.ts` | SsoConfig / SsoUser / SsoSession / 错误码 |
 * | 协议流程 | `oauth.ts` | 授权码流程（纯逻辑，依赖全注入） |
 * | **环境适配** | **各仓自己** | 回环服务器 / 开浏览器 / HTTP / SHA-256 |
 *
 * ## 为什么环境适配不进共享层
 *
 * 回环服务器要占端口、开浏览器要走 Tauri 的 opener 插件、SHA-256 要走 WebCrypto ——
 * 这些在 node、浏览器、Tauri 三种环境里实现方式完全不同。
 *
 * 硬塞进共享层会带来两个后果：共享层要么依赖 Tauri（那它就不能被 node 测试和
 * web 版复用），要么塞进一堆 `if (isTauri)` 分支（那它就不是「一份实现」了）。
 *
 * 所以共享层只留**流程**，把三件事留成注入的依赖。各仓写一份几十行的适配器，
 * 但**流程本身只有一份** —— 这才是要消除的重复。
 */

export * from './types';
export * from './oauth';
export * from './session';
