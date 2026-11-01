/**
 * 统一 AI 配置面板的公开入口。
 *
 * ## 为什么要单独一个子路径
 *
 * `z-biz-tool-shared` 的 exports 里已有 `./ai` 与 `./ai/endpoint`。
 * 面板单独走 `./ai/settings` 的原因：它带 React 与 antd，
 * 而 `./ai/endpoint` 是**纯函数、零依赖**的判据 —— 有些仓（比如做 CLI 的）
 * 只想引判据，不想背 React 与 antd。
 *
 * 拆开之后，纯判据的引入路径依然是 `z-biz-tool-shared/ai/endpoint`，
 * 不会因为面板变重而拖慢。
 */

export { AiSettingsPanel, AiProviderBadge, AiProviderCard } from "./AiSettingsPanel";
export {
  applyPresetToDraft,
  draftIsConfigured,
  draftNeedsApiKey,
  emptyDraft,
  findPreset,
  groupPresets,
  presetMayBeStale,
  toDraft,
} from "./logic";
export type { PresetGroup } from "./logic";
export type {
  AiConfigDraft,
  AiSettingsActions,
  AiSettingsLabels,
  AiSettingsPanelProps,
  LlmFailure,
  PresetView,
} from "./types";
