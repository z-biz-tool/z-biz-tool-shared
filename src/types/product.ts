/**
 * zBiz 家族产品清单。
 *
 * ## 规范来源
 *
 * `z-biz-tool-lead/doc/矩阵规划/04_连接度：家族面板与统一协议.md` §3：
 * 「`shared/types/product.ts`：产品枚举 + 元数据（id、显示名、图标、是否支持深链）」。
 *
 * ## 谁维护什么
 *
 * **协议**（`src/protocol/`）是全家族共用的**格式**，改一次全家生效。
 *
 * **产品元数据**（本文件）是**会过期的数据** —— 显示名会改、支持深链的
 * 状态会变。因此它带着「每条记录都有主人」的约束：
 * 每个 app 在自己的仓里维护自己那一条（`acceptsDeepLink` 这类事实只有
 * 那个 app 知道），本文件提供**类型 + 校验 + 汇总**，不内置任何一条真值。
 *
 * ## 为什么 app id 不含 capability / shared / lead
 *
 * 那三个仓没有用户可见的窗口，无法被 deep-link 唤起。
 * 把它们列进产品清单会让 box 的家族面板显示出三个打不开的卡片。
 */

import type { DeepLinkResult } from "../protocol/deeplink";

/* ------------------------------------------------------------------ *
 * 产品 id
 * ------------------------------------------------------------------ */

/**
 * 家族产品 id。
 *
 * 与 bundle id / 数据目录命名保持一致（`z-biz-tool-db` → `db`），
 * 减少用户与开发者的心智负担。
 */
export type ProductId =
  | "aigen"
  | "box"
  | "cpu"
  | "db"
  | "file"
  | "kb"
  | "math"
  | "mind"
  | "music"
  | "note"
  | "pet"
  | "sys"
  | "terminal"
  | "worker";

/** 全部产品 id 的运行时列表。 */
export const PRODUCT_IDS: readonly ProductId[] = [
  "aigen",
  "box",
  "cpu",
  "db",
  "file",
  "kb",
  "math",
  "mind",
  "music",
  "note",
  "pet",
  "sys",
  "terminal",
  "worker",
] as const;

/** 判断一个字符串是不是合法的产品 id。 */
export function isProductId(value: string): value is ProductId {
  return (PRODUCT_IDS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ *
 * 产品元数据
 * ------------------------------------------------------------------ */

/**
 * 一个产品的元数据。
 *
 * `acceptsDeepLink` 是**唯一必须由该 app 自己维护的真值** ——
 * 只有那个 app 知道自己的 src-tauri 里有没有装 deep-link 插件、
 * 有没有注册 zbiz scheme。
 */
export interface ProductMeta {
  /** 产品 id。 */
  id: ProductId;
  /** 显示名（中文优先）。 */
  displayName: string;
  /** 一句话描述，给家族面板用。 */
  description: string;
  /**
   * 该产品是否接受 `zbiz://` 深链。
   *
   * false 表示「这个 app 还没接协议」—— box 仍可以启动它，
   * 但不该带参数（带了对方也不认）。
   */
  acceptsDeepLink: boolean;
  /** 该产品支持的动作。空数组 = 只能被唤起，不能接收参数。 */
  actions: readonly string[];
  /** 可选的搜索关键词，给 box 的 ⌘K 用。 */
  keywords?: readonly string[];
}

/**
 * 校验产品元数据是否自洽。
 *
 * 挡的是这条链：「清单写错 → box 家族面板显示出这个 app → 用户点下去
 * 发现参数被丢了」。清单错误不会有编译错误，只会在用户点下去之后才暴露，
 * 而那时用户看到的是「点了没反应」。
 */
export function validateProductMeta(meta: unknown): DeepLinkResult<ProductMeta> {
  if (typeof meta !== "object" || meta === null) {
    return { ok: false, reason: "产品元数据不是对象" };
  }
  const m = meta as Partial<ProductMeta>;
  if (typeof m.id !== "string" || !isProductId(m.id)) {
    return { ok: false, reason: `产品 id 非法：${String(m.id)}` };
  }
  if (typeof m.displayName !== "string" || m.displayName.length === 0) {
    return { ok: false, reason: `产品 ${m.id} 缺少 displayName` };
  }
  if (typeof m.description !== "string" || m.description.length === 0) {
    return { ok: false, reason: `产品 ${m.id} 缺少 description` };
  }
  if (typeof m.acceptsDeepLink !== "boolean") {
    return { ok: false, reason: `产品 ${m.id} 缺少 acceptsDeepLink 布尔值` };
  }
  if (!Array.isArray(m.actions)) {
    return { ok: false, reason: `产品 ${m.id} 缺少 actions 数组` };
  }
  // 关键自洽性：声明了动作却说自己不接深链，是自相矛盾的。
  if (m.actions.length > 0 && m.acceptsDeepLink === false) {
    return {
      ok: false,
      reason: `产品 ${m.id} 声明了 actions 却未开启 acceptsDeepLink`,
    };
  }
  return { ok: true, value: m as ProductMeta };
}

/**
 * 一组产品元数据。
 */
export interface ProductRegistry {
  readonly products: ReadonlyMap<ProductId, ProductMeta>;
}

/**
 * 把若干份元数据汇成 registry。
 *
 * **重复 id 直接抛错**，不静默取最后一份 —— 两个仓同时声明 `db`
 * 意味着有人改了协议却没同步，这在协议层必须炸出来。
 */
export function buildProductRegistry(
  metas: readonly ProductMeta[],
): ProductRegistry {
  const map = new Map<ProductId, ProductMeta>();
  for (const raw of metas) {
    const v = validateProductMeta(raw);
    if (!v.ok) {
      throw new Error(`产品元数据校验失败：${v.reason}`);
    }
    if (map.has(v.value.id)) {
      throw new Error(`产品元数据重复声明 id：${v.value.id}`);
    }
    map.set(v.value.id, v.value);
  }
  return { products: map };
}

/**
 * 列出「接受深链」的产品。
 *
 * box 的家族面板用它决定卡片上是否显示「可互传」的标记。
 */
export function listDeepLinkProducts(
  registry: ProductRegistry,
): ProductMeta[] {
  const out: ProductMeta[] = [];
  for (const id of PRODUCT_IDS) {
    const m = registry.products.get(id);
    if (m && m.acceptsDeepLink) out.push(m);
  }
  return out;
}

/**
 * 列出「接受深链且支持指定动作」的产品。
 */
export function listProductsByAction(
  registry: ProductRegistry,
  action: string,
): ProductMeta[] {
  return listDeepLinkProducts(registry).filter((m) => m.actions.includes(action));
}
