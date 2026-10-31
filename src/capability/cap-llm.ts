// cap-llm 命令契约（z-biz-tool-capability crates/cap-llm 0.1.0）。
//
// cap-llm 是**联网原语**，约束与离线原语不同：
//   · 无状态：不持密钥、不落盘、不缓存；
//   · 不决定提示词、不做业务编排 —— 提示词是产品差异，属于消费方；
//   · 不静默回落：provider 不认识就报错，不偷偷按 OpenAI 发。
//
// 错误不是字符串而是结构（对应 Rust `cap_llm::LlmError`）：
// `kind` 是分类，`message` 是给人看的那句。

/** 协议族（对应 Rust `cap_llm::Protocol`） */
export type LlmProtocol = "OpenAiCompat" | "Anthropic" | "Gemini" | "Ollama";

/** 供应商类型（对应 Rust `cap_llm::ProviderKind`） */
export type ProviderKind = "OpenAi" | "Anthropic" | "Gemini" | "Ollama" | "Custom" | "MiniMax";

/** 错误分类（对应 Rust `cap_llm::ErrorKind`） */
export type LlmErrorKind =
  | "NotConfigured"
  | "Network"
  | "Timeout"
  | "Http"
  | "Parse"
  | "Unsupported"
  | "Io";

/** 错误（对应 Rust `cap_llm::LlmError`） */
export interface LlmError {
  kind: LlmErrorKind;
  /** HTTP 状态码（仅 Http 类有） */
  status?: number;
  /** 给人看的说明；已过脱敏与截断，不会带出密钥 */
  message: string;
}

/** 连接配置（对应 Rust `cap_llm::LlmConfig`） */
export interface LlmConfig {
  kind: ProviderKind;
  /** 接口地址；留空且 preset 有值时用预设地址兜底，用户填的永远优先 */
  baseUrl: string;
  /** 密钥：只在本进程内存里过一遍，不落盘 */
  apiKey: string;
  model: string;
  /** 超时（毫秒） */
  timeoutMs: number;
  temperature?: number;
  maxTokens?: number;
  /** 供应商预设 id（见 `listLlmPresets`） */
  preset?: string;
}

/** 消息角色（对应 Rust `cap_llm::Role`，serde 小写） */
export type LlmRole = "system" | "user" | "assistant" | "tool";

/** 一条消息（对应 Rust `cap_llm::Message`） */
export interface LlmMessage {
  role: LlmRole;
  content: string;
  /** 图片（data URL 或 URL） */
  images?: string[];
  toolCallId?: string;
  toolName?: string;
  toolCalls?: unknown[];
}

/** 工具定义（对应 Rust `cap_llm::ToolDef`） */
export interface LlmToolDef {
  name: string;
  description: string;
  /** JSON Schema */
  parameters: unknown;
}

/** 用量（对应 Rust `cap_llm::Usage`） */
export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

/** 一次对话的回复（对应 Rust `cap_llm::ChatReply`） */
export interface LlmChatReply {
  content: string;
  toolCalls?: unknown[];
  usage?: LlmUsage;
  /** 实际使用的模型（服务端可能与请求的不同） */
  model?: string;
}

/** 转写片段（对应 Rust `cap_llm::Segment`） */
export interface LlmSegment {
  start: number;
  end: number;
  text: string;
}

/** 转写结果（对应 Rust `cap_llm::Transcript`） */
export interface LlmTranscript {
  text: string;
  language?: string;
  durationSecs?: number;
  segments: LlmSegment[];
  model?: string;
}

/** 转写请求（对应 Rust `cap_llm::TranscriptionRequest`） */
export interface LlmTranscriptionRequest {
  model: string;
  language?: string;
  prompt?: string;
  temperature?: number;
  verbose: boolean;
}

/** 供应商预设（对应 Rust `cap_llm::preset::ProviderPreset`） */
export interface LlmProviderPreset {
  id: string;
  label: string;
  protocol: LlmProtocol;
  baseUrl: string;
  /** 匹配用的别名 */
  aliases: string[];
  /** 分类：international / domestic / aggregator / self_hosted */
  category: string;
  /** 核对日期（超过半年没复核的预设应在 UI 上标「可能已过期」） */
  verifiedOn: string;
  requiresApiKey: boolean;
  kind: ProviderKind;
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * 流式命令的增量回调由薄壳负责（Rust 侧 `chat_stream` 带 `on_delta` 闭包），
 * 前端拿到的是聚合后的最终回复；需要逐字渲染的调用方走事件通道。
 */
export interface CapLlmCommands {
  /** 一次对话 */
  llmChat: { args: { config: LlmConfig; messages: LlmMessage[] }; returns: LlmChatReply };
  /** 带工具定义的一次对话 */
  llmChatWithTools: {
    args: { config: LlmConfig; messages: LlmMessage[]; tools: LlmToolDef[] };
    returns: LlmChatReply;
  };
  /** 流式对话（返回聚合后的最终回复） */
  llmChatStream: { args: { config: LlmConfig; messages: LlmMessage[] }; returns: LlmChatReply };
  /** 列模型 */
  llmListModels: { args: { config: LlmConfig }; returns: string[] };
  /** 连通性探测（返回耗时毫秒） */
  llmPing: { args: { config: LlmConfig }; returns: number };
  /** 音频转写（音频字节进） */
  llmTranscribe: {
    args: { config: LlmConfig; audio: number[]; filename: string; request: LlmTranscriptionRequest };
    returns: LlmTranscript;
  };
  /** 音频转写（文件路径进，薄壳负责读文件） */
  llmTranscribeFile: {
    args: { config: LlmConfig; path: string; request: LlmTranscriptionRequest };
    returns: LlmTranscript;
  };
  /** 供应商预设目录 */
  listLlmPresets: { args: Record<string, never>; returns: LlmProviderPreset[] };
}

/** 错误分类的稳定值（对应 Rust `ErrorKind`） */
export const CapLlmErrorKinds = {
  NotConfigured: "NotConfigured",
  Network: "Network",
  Timeout: "Timeout",
  Http: "Http",
  Parse: "Parse",
  Unsupported: "Unsupported",
  Io: "Io",
} as const;
