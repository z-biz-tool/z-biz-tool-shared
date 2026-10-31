// cap-meeting 命令契约（z-biz-tool-capability crates/cap-meeting 0.1.0）。
//
// 能力边界：把会议原始文字整理成**结构化纪要**（议题 / 决策 / 行动项），
// 以及把纪要转成 Markdown。
// 提示词在 crate 里（`PROMPT_TEMPLATE`）—— 这是本 crate 与 cap-llm 的分工差异：
// cap-llm 管协议与传输，本 crate 管「纪要长什么样」这一层业务语义。

import type { LlmConfig } from "./cap-llm.ts";

/** 会议元信息（对应 Rust `cap_meeting::Meeting`） */
export interface MeetingInfo {
  title?: string;
  /** ISO 时间串 */
  startedAt?: string;
  participants: string[];
  source?: string;
}

/** 行动项（对应 Rust `cap_meeting::ActionItem`） */
export interface MeetingActionItem {
  task: string;
  owner?: string;
  due?: string;
}

/** 议题（对应 Rust `cap_meeting::Topic`） */
export interface MeetingTopic {
  title: string;
  summary: string;
}

/** 决策（对应 Rust `cap_meeting::Decision`） */
export interface MeetingDecision {
  content: string;
  rationale?: string;
}

/** 结构化纪要（对应 Rust `cap_meeting::Minutes`） */
export interface MeetingMinutes {
  title: string;
  summary: string;
  topics: MeetingTopic[];
  decisions: MeetingDecision[];
  actions: MeetingActionItem[];
  openQuestions: string[];
  meeting?: MeetingInfo;
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * 这几个命令要真的调模型（cap-llm 在底层），所以是**联网原语**：
 * 密钥只在本进程内存里过一遍。
 */
export interface CapMeetingCommands {
  /** 从会议原始文字整理纪要 */
  meetingMinutesFromText: { args: { config: LlmConfig; text: string }; returns: MeetingMinutes };
  /** 带会议元信息整理纪要 */
  meetingMinutesFromTextWithMeeting: {
    args: { config: LlmConfig; meeting: MeetingInfo; text: string };
    returns: MeetingMinutes;
  };
  /** 从转写文本整理纪要 */
  meetingMinutesFromTranscript: {
    args: { config: LlmConfig; meeting: MeetingInfo; transcriptText: string };
    returns: MeetingMinutes;
  };
  /** 纪要转 Markdown */
  meetingMinutesToMarkdown: { args: { minutes: MeetingMinutes }; returns: string };
}

/** 错误文案稳定值（Rust 侧错误串，按 startsWith 匹配） */
export const CapMeetingErrors = {
  /** 模型回复为空 */
  EmptyReply: "回复为空",
  /** 无法解析成纪要 JSON */
  NotJson: "无法从模型回复中提取合法的纪要 JSON",
} as const;
