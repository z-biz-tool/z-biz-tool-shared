/**
 * 统一 AI 配置面板的类型契约。
 *
 * ## 为什么单独一个文件
 *
 * 面板要被十��仓共用，而十仓的前端框架不同（9 仓 antd、note 纯 CSS）。
 * 类型是**唯一两边都能消费**的东西 —— 把它们定死在这里，
 * 各仓的适配层就只剩「渲染」，不含任何判据。
 *
 * 判据全部走纯函数（见 ./logic.ts），判据与 UI 分离 ⇒ 判据可单测，
 * 且**判据只有一份**。这正是家族记忆里那条铁律的延续：
 * 「前后端判据同源，Rust 是金标」。
 */

/** 供应商预设的界面视图（由 Rust `list_llm_presets` 提供）。 */
export interface PresetView {
  id: string;
  label: string;
  /** 服务地址。 */
  base_url: string;
  /** 归类：international / domestic / aggregator / self_hosted。 */
  category: string;
  /** 分类的中文展示名（Rust 侧提供，避免前端再造一张映射表）。 */
  category_label: string;
  /** 该预设是否需要 API Key。 */
  requires_api_key: boolean;
  /** 供搜索的其他写法。 */
  aliases: string[];
  /** 地址核对日期（YYYY-MM-DD）。 */
  verified_on: string;
}

/** 结构化失败的界面视图（由 Rust `LlmFailure` 提供）。 */
export interface LlmFailure {
  /** 错误分类。 */
  kind: string;
  /** HTTP 状态码（仅 Http 类有）。 */
  status?: number | null;
  /** 给人看的那句。 */
  message: string;
  /** 该怎么做的提示。 */
  hint: string;
  /** 该把光标送进哪一栏 —— 必须与 hint 的文案一致。 */
  focus: "apiKey" | "baseUrl" | "model" | "none";
}

/** 面板里编辑的配置草稿。 */
export interface AiConfigDraft {
  /** 预设 id；空串表示自定义服务。 */
  preset: string;
  /** 服务地址。 */
  baseUrl: string;
  /** 模型名。 */
  model: string;
  /**
   * 密钥的**占位**。
   *
   * 面板**不回显**已保存的密钥（后端只给「有没有」的布尔）。
   * 所以这个字段的语义是「用户本次新输入的密钥」：
   * 留空 = 不修改已保存的密钥；清空并显式点「删除」= 删掉它。
   */
  apiKey: string;
  /** 温度。 */
  temperature?: number;
  /** 单次回复上限。 */
  maxTokens?: number;
  /** 超时（毫秒）。 */
  timeoutMs?: number;
}

/** 面板需要外部提供的动作（各仓用自己的 IPC 实现）。 */
export interface AiSettingsActions {
  /** 拉供应商预设。 */
  listPresets: () => Promise<PresetView[]>;
  /** 拉模型列表。会用当前的草稿去请求。 */
  listModels: (draft: AiConfigDraft) => Promise<string[]>;
  /** 测试连接。会用当前的草稿去请求。 */
  testConnection: (draft: AiConfigDraft) => Promise<{ ok: boolean; detail?: string; failure?: LlmFailure }>;
  /** 保存。`apiKey` 为空串表示「不修改已保存的密钥」。 */
  save: (draft: AiConfigDraft) => Promise<boolean>;
}

/** 面板的受控 / 非受控 props。 */
export interface AiSettingsPanelProps {
  /** 初始草稿（通常是后端读回来的配置）。 */
  value?: Partial<AiConfigDraft>;
  /** 当前是否已保存过密钥（后端给的布尔）。 */
  hasApiKey?: boolean;
  /** 动作实现。 */
  actions: AiSettingsActions;
  /** 保存成功后的回调。 */
  onSaved?: () => void;
  /** 文案覆盖。缺省用内置中文。 */
  labels?: Partial<AiSettingsLabels>;
}

/** 面板里所有可替换的文案。 */
export interface AiSettingsLabels {
  title: string;
  provider: string;
  providerPlaceholder: string;
  custom: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  apiKeySaved: string;
  apiKeyMissing: string;
  model: string;
  modelPlaceholder: string;
  fetchModels: string;
  fetching: string;
  test: string;
  testing: string;
  save: string;
  saving: string;
  saved: string;
  advanced: string;
  baseUrl: string;
  temperature: string;
  maxTokens: string;
  timeout: string;
  noKeyNeeded: string;
  verifiedOn: string;
  keyOnlyLocal: string;
  deleteKey: string;
  reload: string;
}
