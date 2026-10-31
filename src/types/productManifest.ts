/**
 * 产品自报文件的**读取与汇总** —— 「每条记录都有主人」的机器那一半。
 *
 * ## 为什么需要这一层
 *
 * `product.ts` 提供类型与校验，但真值分散在 16 个仓各自的 `product.json` 里。
 * 谁来读、读完怎么对账，是这一层的事：
 *
 * - **读取**：把一个仓根目录下的 `product.json` 读成 `ProductMeta`，
 *   并在读的时候就地校验（不合规的仓不该等到汇总时才被发现）。
 * - **汇总**：把 N 份自报汇成一份 registry，重复 id 直接炸。
 * - **对账**：把「自报的真值」与「协议层认识的产品集合」对齐 ——
 *   少一个仓自报、或某个仓声明了协议层不存在的 id，都属于**家族契约破损**，
 *   必须在 CI 里红，不能等用户在 box 面板上看到一张打不开的卡片才发现。
 *
 * ## 为什么不内置真值
 *
 * 见 `product.ts` 顶部：本模块只做**机制**，一条真值都不带。
 * 谁的产品叫什么、支持什么动作，只有那个仓知道。
 */

import {
  buildProductRegistry,
  isProductId,
  validateProductMeta,
  type DeepLinkResult,
  type ProductId,
  type ProductMeta,
  type ProductRegistry,
} from "./product";

/**
 * 自报文件在仓根的**相对路径**。
 *
 * 固定在仓根而不是 `src/` 里：这份文件是「这个仓向家族报什么」，
 * 属于仓级契约，不是前端代码的一部分 —— 放在 `src/` 下会被
 * 「前端源码」的构建/打包规则误伤。
 */
export const PRODUCT_MANIFEST_PATH = "product.json";

/**
 * 自报文件的磁盘形状（camelCase，与 `ProductMeta` 的 JSON 序列化一致）。
 *
 * 与 `ProductMeta` 分开声明，是因为磁盘上的字段是**外部输入**：
 * 多一个字段少一个字段都可能是别人的笔误，解析时要能指名报错，
 * 而不是被 TS 的类型断言悄悄放过。
 */
export interface ProductManifestFile {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly acceptsDeepLink: boolean;
  readonly actions: readonly string[];
  readonly keywords?: readonly string[];
}

/**
 * 解析一个自报文件的内容。
 *
 * 与 `validateProductMeta` 的区别：这里管**磁盘形状**（字段在不在、类型对不对），
 * 那里管**语义自洽**（id 合不合法、声明了动作却说自己不接深链这种矛盾）。
 * 两层都要过。
 */
export function parseProductManifest(
  raw: unknown,
): DeepLinkResult<ProductMeta> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "产品自报文件不是对象" };
  }
  const m = raw as Partial<ProductManifestFile>;

  const missing = (field: string): DeepLinkResult<ProductMeta> => ({
    ok: false,
    reason: `产品自报文件缺少字段 ${field}`,
  });

  if (typeof m.id !== "string" || m.id.length === 0) return missing("id");
  if (typeof m.displayName !== "string") return missing("displayName");
  if (typeof m.description !== "string") return missing("description");
  if (typeof m.acceptsDeepLink !== "boolean") return missing("acceptsDeepLink");
  if (!Array.isArray(m.actions)) return missing("actions");
  if (m.actions.some((a) => typeof a !== "string")) {
    return { ok: false, reason: "产品自报文件的 actions 里有非字符串" };
  }
  if (m.keywords !== undefined) {
    if (!Array.isArray(m.keywords)) return missing("keywords");
    if (m.keywords.some((k) => typeof k !== "string")) {
      return { ok: false, reason: "产品自报文件的 keywords 里有非字符串" };
    }
  }

  // 交给语义层校验（id 合法性、动作与 acceptsDeepLink 的自洽性）
  return validateProductMeta(m);
}

/**
 * 把若干份自报汇总成 registry。
 *
 * 重复 id 直接抛错 —— 两个仓声明同一个产品 id 意味着有人改了协议没同步，
 * 这在协议层必须炸出来，不能静默取最后一份。
 */
export function buildRegistryFromManifests(
  manifests: readonly ProductManifestFile[],
): ProductRegistry {
  return buildProductRegistry(
    manifests.map((m) => {
      const v = parseProductManifest(m);
      if (!v.ok) {
        throw new Error(`产品自报校验失败：${v.reason}`);
      }
      return v.value;
    }),
  );
}

/**
 * 对账结果。
 *
 * `missing` = 协议层认识、但没人生存自报的产品（**没人认领**）。
 * `unknown` = 自报了自己、但协议层不认这个 id（**协议没同步**）。
 */
export interface ManifestReconciliation {
  readonly ok: boolean;
  /** 协议层认识但无人自报的产品 id */
  readonly missing: readonly ProductId[];
  /** 自报了但协议层不认识的 id */
  readonly unknown: readonly string[];
  /** 重复声明的 id */
  readonly duplicated: readonly string[];
}

/**
 * 把「自报的真值」与「协议层认识的产品集合」对账。
 *
 * 两种破损都要报出来：
 * - **无人认领**（missing）：协议层说这个产品存在，但没有任何仓声明它 ——
 *   要么那个仓忘了加 `product.json`，要么它已经下线了。
 * - **协议没同步**（unknown）：某个仓声明了协议层不存在的 id ——
 *   多半是加了新产品但忘了同步 `cap-hub` / `shared` 的产品集合。
 *
 * @param declared 自报的产品 id 集合
 * @param known 协议层认识的产品 id 集合
 */
export function reconcileManifests(
  declared: readonly string[],
  known: readonly string[],
): ManifestReconciliation {
  const seen = new Set<string>();
  const duplicated: string[] = [];
  for (const id of declared) {
    if (seen.has(id)) duplicated.push(id);
    seen.add(id);
  }

  const knownSet = new Set(known);
  const missing = known.filter((id) => !seen.has(id));
  const unknown = [...seen].filter((id) => !knownSet.has(id));

  return {
    ok: missing.length === 0 && unknown.length === 0 && duplicated.length === 0,
    missing: missing as ProductId[],
    unknown,
    duplicated,
  };
}

/** 便捷判断：id 是否是协议层认识的产品 id（供各仓自检用）。 */
export { isProductId };
