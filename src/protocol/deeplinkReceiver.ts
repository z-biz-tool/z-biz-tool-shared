/**
 * zbiz:// 深链接的**收侧**通用件。
 *
 * ## 为什么单独一个模块
 *
 * `deeplink.ts` 只管「一串字节 ↔ 一个 Handoff」，是纯协议。
 * 但收侧还得做三件**跟协议无关**的事，各仓若各写一遍，必然各写错一遍：
 *
 *   1. **冷启动不漏**：深链可能在监听挂上之前就到了（Rust 侧
 *      `seed_cold_start` 先入队再 emit）。所以 mount 时必须先取一次队列。
 *   2. **二次唤起不重**：已运行的实例被再次唤起时，靠 `zbiz-open` 事件再取一次。
 *   3. **不静默吞掉**：不认识的产品/动作必须给出可见提示，
 *      否则用户看到的就是「点了没反应」，无从判断是路径错了还是不支持。
 *
 * 而**语义**（收到 `prompt` 该写进哪个草稿、收到 `file` 该打开哪个面板）
 * 是每个应用自己的事 —— aigen 落进生成草稿，note 落进编辑器。
 * 这部分留在各仓，本模块只提供机制 + 一个可注入的翻译函数。
 *
 * ## 用法
 *
 * ```ts
 * const stop = startDeepLinkReceiver({
 *   productId: "note",
 *   invoke,                        // 注入 invoke，便于测试与多环境适配
 *   listen,                       // 注入 listen
 *   translate: (item) => ({...}), // 本仓语义：纯函数，可单测
 *   onProblem: (msg) => message.warning(msg),
 * });
 * // 组件卸载时：stop();
 * ```
 *
 * 所有依赖都靠注入 —— 因为本模块要能在 vitest（无 Tauri）与浏览器预览里跑，
 * 直接 import `@tauri-apps/api` 会让非 Tauri 环境一进来就炸。
 */

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

import { DEEPLINK_EVENT, type Handoff } from "./deeplink";

/** 取队列的命令名。家族统一，各仓同名（Rust 侧 wrapper 在各仓自己的 commands.rs）。 */
export const ZBIZ_TAKE_PENDING = "zbiz_take_pending";

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/**
 * 深链在**本应用**里的落地结果。
 *
 * 字段刻意做得通用（不预设「草稿」「面板」这类应用概念）——
 * 各仓的 `translate` 负责把自己的概念映射进来。
 */
export interface DeepLinkEffect {
  /** 本应用是否接得住这条深链。false 时 `problem` 必非空。 */
  ok: boolean;
  /** 接不住时的原因（给用户看的一句话）。 */
  problem?: string;
  /**
   * 本应用要执行的动作描述。
   *
   * 用 `Record<string, unknown>` 而不是联合类型，是因为各仓的动作形状完全不同
   * （aigen 是 `{mode, prompt}`，note 是 `{file, line}`）。
   * 各仓在自己的 `translate` 里把它收敛成具体类型再消费。
   */
  effect?: Record<string, unknown>;
}

/**
 * 深链收侧的配置。
 */
export interface DeepLinkReceiverOptions {
  /** 本应用的产品 id。收到的深链 product 与之不符会被判为「不是发给本应用的」。 */
  productId: string;

  /**
   * 取队列。签名与 Tauri 的 `invoke` 兼容。
   *
   * **刻意不接受命令名参数** —— 命令名是共享层的事（`ZBIZ_TAKE_PENDING`），
   * 消费方不该重复它：重复就有两份要同步的地方，一份改了另一份没改，
   * 结果是「点了没反应」且没有任何报错。
   *
   * 注入而不是直接 import：非 Tauri 环境（vitest / 浏览器预览）没有这个命令。
   */
  invoke: () => Promise<Handoff[]>;

  /**
   * 订阅事件。签名与 Tauri 的 `listen` 兼容。
   */
  listen: (event: string, handler: () => void) => Promise<() => void>;

  /**
   * 本仓语义：把一条深链翻译成本应用的动作。
   *
   * 必须是**纯函数** —— 它是各仓单测的主要着力点。
   * 「product 不是本应用」这类判断由本模块统一做，translate 只管应用内部语义。
   */
  translate: (item: Handoff) => DeepLinkEffect;

  /**
   * 接不住时的可见提示。
   *
   * **必须有**：不给用户任何反馈的话，未适配的深链就等于静默失败。
   */
  onProblem: (message: string, item: Handoff) => void;

  /**
   * 执行 translate 给出的动作。
   *
   * 各仓在这里把 `effect` 收敛成自己的具体动作并落地
   * （aigen：切 mode / 填 prompt；note：打开文件）。
   */
  onEffect: (effect: Record<string, unknown>, item: Handoff) => void;

  /** 调试日志。默认不打。 */
  log?: (message: string, item: Handoff) => void;
}

/**
 * 收侧停止函数。调用后取消事件订阅。
 */
export type DeepLinkReceiverStop = () => void;

/* ------------------------------------------------------------------ *
 * 主逻辑
 * ------------------------------------------------------------------ */

/**
 * 启动深链接收侧。
 *
 * 返回一个停止函数 —— 组件卸载时调用它，否则监听会泄漏
 * （React 严格模式会挂载两次，不清理就会处理两遍深链）。
 */
export function startDeepLinkReceiver(options: DeepLinkReceiverOptions): DeepLinkReceiverStop {
  const { productId, invoke, listen, translate, onProblem, onEffect, log } = options;

  let stopped = false;
  let unlisten: (() => void) | undefined;

  const drain = async () => {
    let items: Handoff[];
    try {
      items = await invoke();
    } catch (e) {
      // 非 Tauri 环境（vitest / 浏览器预览）属预期，不算错误。
      log?.(`取深链队列失败：${String(e)}`, { product: productId, action: "", params: {} });
      return;
    }
    if (stopped || items.length === 0) return;

    for (const item of items) {
      // 「这条深链不是发给本应用的」由收侧统一判断：
      // 13 个 app 装在同一台机器上，谁都可能收到别人的深链。
      if (item.product !== productId) {
        const msg = `这条深链发给 ${item.product}，不是本应用`;
        log?.(msg, item);
        onProblem(msg, item);
        continue;
      }

      let effect: DeepLinkEffect;
      try {
        effect = translate(item);
      } catch (e) {
        // translate 是本仓代码，出错不该让整批深链都丢掉。
        const msg = `深链处理出错：${String(e)}`;
        log?.(msg, item);
        onProblem(msg, item);
        continue;
      }

      if (!effect.ok) {
        const msg = effect.problem ?? "这条深链本应用接不住";
        log?.(msg, item);
        onProblem(msg, item);
        continue;
      }

      log?.(`已接收深链 ${item.action}`, item);
      if (!effect.effect) continue;
      try {
        onEffect(effect.effect, item);
      } catch (e) {
        // 执行出错不该让整批深链都丢掉。
        const msg = `深链执行出错：${String(e)}`;
        log?.(msg, item);
        onProblem(msg, item);
      }
    }
  };

  // ① mount 时先取一次：冷启动那条信号在监听挂上之前就发出去了。
  void drain();

  // ② 之后每次收到信号再取：处理「已运行的实例被二次唤起」。
  // take 是出队即清空，所以 ①② 同时发生也不会把同一条深链执行两遍。
  void listen(DEEPLINK_EVENT, () => void drain())
    .then((u) => {
      if (stopped) {
        u();
        return;
      }
      unlisten = u;
    })
    .catch((e) => {
      log?.(`订阅 ${DEEPLINK_EVENT} 失败：${String(e)}`, {
        product: productId,
        action: "",
        params: {},
      });
    });

  return () => {
    stopped = true;
    unlisten?.();
  };
}
