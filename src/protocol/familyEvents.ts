/**
 * zBiz 家族级事件定义。
 *
 * ## 规范来源
 *
 * `z-biz-tool-lead/doc/矩阵规划/04_连接度：家族面板与统一协议.md` §3：
 * 「`shared/protocol/family-events.ts`：家族级事件定义（如
 * `FamilyEvent.OpenProduct`、`FamilyEvent.ShareAsset`），用 Tauri event 通道
 * 跨进程广播。」
 *
 * ## 事件名的约定
 *
 * 所有事件名统一走 `zbiz:<domain>:<verb>` 三段式。这样在日志里 grep
 * `zbiz:` 就能捞出全部家族事件，不用知道具体事件名。
 *
 * 与 deep-link 的分工：
 * - **deep-link（`zbiz://`）** 是**跨进程、跨 app**的请求，带完整上下文。
 * - **family event** 是**同一 app 内**或**已知对方在场**时的轻量广播，
 *   只带「发生了什么」，不带大块数据。
 *
 * ## 为什么事件名在这里而不是各仓自己写
 *
 * 事件名是**跨 app 的契约**：box 发 `zbiz:family:product-opened`，
 * note 得监听同一个名字才能收到。名字散落在各仓，就等于又造一份私有副本
 * —— 那是 family 要消除的东西，不是要新增的。
 */

/**
 * 家族事件名。
 *
 * 用 `as const` 保留字面量类型，这样消费方能拿到自动补全，
 * 拼错名字会被 TS 直接拦下（而不是运行时静默收不到）。
 */
export const FAMILY_EVENTS = {
  /** 某个产品被唤起（box 家族面板点击、deep-link 落地都会发）。 */
  productOpened: "zbiz:family:product-opened",

  /** 某个产品发起了深链请求。 */
  deepLinkRequested: "zbiz:family:deep-link-requested",

  /** 深链被目标产品接收并开始处理。 */
  deepLinkReceived: "zbiz:family:deep-link-received",

  /** 一次唤起链路完成（payload 里带 traceId）。 */
  deepLinkCompleted: "zbiz:family:deep-link-completed",

  /** 深链被拒绝（payload 里带可读原因）。 */
  deepLinkRejected: "zbiz:family:deep-link-rejected",

  /** 产物在家族内被分享（从一个产品推给另一个产品）。 */
  assetShared: "zbiz:family:asset-shared",
} as const;

/** 全部家族事件名的联合类型。 */
export type FamilyEventName = (typeof FAMILY_EVENTS)[keyof typeof FAMILY_EVENTS];

/**
 * 深链事件携带的载荷。
 *
 * 用一个联合类型而不是散落的多个 interface —— 因为每个事件的载荷字段
 * 不一样，但**字段名要稳定**：跨 app 通信时，字段名对不上是最难查的一类 bug。
 */
export type FamilyEventPayload =
  /** 某个产品被唤起。 */
  | { product: string; via: "deep-link" | "panel" | "argv" }
  /** 深链被请求。 */
  | { product: string; action: string; traceId: string | null }
  /** 深链被接收。 */
  | { product: string; action: string; traceId: string | null }
  /** 深链完成。 */
  | { product: string; action: string; traceId: string | null }
  /** 深链被拒。 */
  | { product: string; reason: string }
  /** 产物分享。 */
  | {
      from: string;
      to: string;
      assetPath: string;
      traceId: string | null;
    };

/**
 * 判断一个字符串是不是已知的家族事件名。
 */
export function isFamilyEventName(value: string): value is FamilyEventName {
  return (Object.values(FAMILY_EVENTS) as readonly string[]).includes(value);
}
