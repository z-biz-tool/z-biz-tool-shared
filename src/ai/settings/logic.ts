/**
 * 统一 AI 配置面板的**纯逻辑**。
 *
 * ## 这里的每一条判据都有出处
 *
 * 这个文件不做任何渲染，只有纯函数。理由有三：
 *
 * 1. **判据必须只有一份**。十仓共用一个面板，如果判据散在各自的渲染代码里，
 *    改一处就要改十处，而漏改的那一处不会报错 —— 只表现为「某台机器上
 *    本地模型的密钥框还显示着」，极难归因。
 * 2. **判据可单测**。纯函数能被 node --test 直接跑，
 *    而渲染组件的测试要拖上 jsdom + antd，慢且脆。
 * 3. **判据同源 Rust**。`needsApiKey` 直接复用 `z-biz-tool-shared/ai/endpoint`
 *    的 `needsApiKey()` —— 那是 Rust `LlmConfig::needs_api_key()` 的逐条镜像。
 *    这里**不重写**私网判定：重写即漂移，而漂移的代价是
 *    「后端放行、前端拦住」，用户看到的是「本地模型配了却用不了」。
 */

import { needsApiKey } from "../privateEndpoint";
import type { AiConfigDraft, PresetView } from "./types";

/** 预设分组（界面按组折叠，避免 18 家厂商糊成一片）。 */
export interface PresetGroup {
  key: string;
  label: string;
  items: PresetView[];
}

/**
 * 按分类把预设分组。
 *
 * 顺序**保留后端给的顺序** —— 后端已按组排列（国际 → 国内 → 聚合 → 自托管），
 * 前端再排一次就会打乱「本地服务在最后」这个直觉顺序。
 */
export function groupPresets(presets: PresetView[]): PresetGroup[] {
  const out: PresetGroup[] = [];
  for (const p of presets) {
    let g = out.find((x) => x.key === p.category);
    if (!g) {
      g = { key: p.category, label: p.category_label || p.category, items: [] };
      out.push(g);
    }
    g.items.push(p);
  }
  return out;
}

/**
 * 找出当前草稿对应的预设。
 *
 * 匹配依据是 **host**，不是整串地址 ——
 * `http://localhost:11434/v1` 与 `http://localhost:11434` 是同一个服务，
 * 尾斜杠和 `/v1` 后缀不该影响身份。Rust 侧 `detect_preset()` 也是按 host 反查的，
 * 前端若按整串比较 ⇒ 同一个服务前后端得出不同结论（判据分裂）。
 */
export function findPreset(
  presets: PresetView[],
  presetId: string,
  baseUrl: string,
): PresetView | undefined {
  if (presetId) {
    const byId = presets.find((p) => p.id === presetId);
    if (byId) return byId;
  }
  const host = hostOf(baseUrl);
  if (!host) return undefined;
  return presets.find((p) => hostOf(p.base_url) === host);
}

/**
 * 从 URL 里取 host（去掉 scheme、userinfo、端口、路径）。
 *
 * 与 `privateEndpoint.ts` 的 `hostOf` 同源实现。
 * 这里**不重新发明**：直接用它，避免两份 host 解析在边界上分叉。
 */
function hostOf(url: string): string {
  if (!url) return "";
  const rest = url.includes("://") ? url.slice(url.indexOf("://") + 3) : url;
  const hostPort = rest.split("/")[0] ?? "";
  const afterUser = hostPort.includes("@")
    ? hostPort.slice(hostPort.lastIndexOf("@") + 1)
    : hostPort;
  if (afterUser.startsWith("[")) {
    const end = afterUser.indexOf("]");
    return end === -1 ? afterUser : afterUser.slice(0, end + 1);
  }
  return afterUser.split(":")[0] ?? "";
}

/**
 * 这份配置要不要 API Key。
 *
 * 判据顺序与 Rust `LlmConfig::needs_api_key()` **严格一致**：
 *
 * ① 预设登记为免 Key → 免（显式声明优先）；
 * ② 预设登记为要 Key → **要**（哪怕地址被改成本机代理，也按预设走）；
 * ③ 没匹配到预设（自定义服务）→ 看地址：私网免、公网要。
 *
 * 第②条最容易写反：只判「预设说不免」而不判「预设说要」，
 * 会让「选了 DeepSeek 但把地址指向本机代理」被私网规则救掉，
 * 于是请求发出去了、没带鉴权头、拿到 401 —— 而用户完全不知道为什么。
 */
export function draftNeedsApiKey(
  presets: PresetView[],
  draft: Pick<AiConfigDraft, "preset" | "baseUrl">,
): boolean {
  const preset = findPreset(presets, draft.preset, draft.baseUrl);
  if (preset) return needsApiKey(preset.requires_api_key, draft.baseUrl);
  return needsApiKey(undefined, draft.baseUrl);
}

/**
 * 切换服务商时，地址该怎么跟着变。
 *
 * - 选某家厂商预设：地址 = 预设的标准地址。
 *   用户手改过的代理地址会被覆盖 —— 那个代理对新厂商毫无意义，
 *   留着它只会静默把请求打向一个不知道自己被用来问新厂商的代理。
 *   （静默错路由比丢失输入严重得多。）
 * - 选「自定义」：保留现有地址作为起点，只换身份。
 *
 * 模型名**不在这里动**：模型名不在预设里（预设只管「哪一家 + 什么地址」，
 * 因为模型半年换代，写死必过期），由用户自己选或现取。
 */
export function applyPresetToDraft(
  draft: AiConfigDraft,
  presets: PresetView[],
  presetId: string,
): AiConfigDraft {
  if (!presetId) {
    return { ...draft, preset: "" };
  }
  const p = presets.find((x) => x.id === presetId);
  if (!p) return { ...draft, preset: "" };
  return { ...draft, preset: p.id, baseUrl: p.base_url };
}

/**
 * 空草稿。
 */
export function emptyDraft(): AiConfigDraft {
  return {
    preset: "",
    baseUrl: "",
    model: "",
    apiKey: "",
    temperature: 0.7,
    maxTokens: 2048,
    timeoutMs: 30000,
  };
}

/**
 * 把后端读回来的配置转成草稿。
 *
 * 注意 `apiKey` 恒为空串 —— 后端只回「有没有密钥」，不回明文。
 * 面板**永远不显示**已保存的密钥，这是安全约束，不是待办。
 */
export function toDraft(saved: {
  preset?: string;
  provider?: string;
  baseUrl?: string;
  base_url?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  max_tokens?: number;
  timeoutMs?: number;
  timeout_ms?: number;
}): AiConfigDraft {
  return {
    preset: saved.preset ?? saved.provider ?? "",
    baseUrl: saved.baseUrl ?? saved.base_url ?? "",
    model: saved.model ?? "",
    apiKey: "",
    temperature: saved.temperature,
    maxTokens: saved.maxTokens ?? saved.max_tokens,
    timeoutMs: saved.timeoutMs ?? saved.timeout_ms,
  };
}

/**
 * 这份配置是不是「已经能用了」。
 *
 * 语义方向要小心：`needsApiKey` 回答的是「**要不要** Key」，
 * 这里问的是「**是不是**配好了」—— 两者相反，不能直接 return。
 *
 * @param hasApiKey 后端给的「是否已保存密钥」布尔；`undefined` 表示后端没给。
 */
export function draftIsConfigured(
  presets: PresetView[],
  draft: Pick<AiConfigDraft, "preset" | "baseUrl" | "model" | "apiKey">,
  hasApiKey?: boolean,
): boolean {
  if (!draft.model.trim()) return false;
  if (!draftNeedsApiKey(presets, draft)) return true;
  // 要 Key：本次输入了算配好，或者后端说已存过密钥
  if (draft.apiKey.trim()) return true;
  if (hasApiKey !== undefined) return hasApiKey;
  return false;
}

/**
 * 预设的核对日期是否「可能已过期」。
 *
 * 厂商会改地址（MiniMax 就从 api.minimaxi.com 与 api.minimax.io 双域名），
 * `verified_on` 是**可审计字段** —— 超过半年没复核就该在界面上标出来，
 * 而不是让用户对着 404 猜。
 */
export function presetMayBeStale(verifiedOn: string, now: Date = new Date()): boolean {
  if (!verifiedOn || verifiedOn.length !== 10) return false;
  const verified = new Date(verifiedOn);
  if (Number.isNaN(verified.getTime())) return false;
  const halfYearMs = 182.5 * 24 * 60 * 60 * 1000;
  return now.getTime() - verified.getTime() > halfYearMs;
}
