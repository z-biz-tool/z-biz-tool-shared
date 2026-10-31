// cap-audio 命令契约（z-biz-tool-capability crates/cap-audio 0.1.0）。
//
// 能力边界：**只支持 WAV 容器**（PCM 8/16/24/32 位、IEEE 浮点 32/64 位，
// 含 WAVE_FORMAT_EXTENSIBLE）。MP3 / AAC / FLAC 需要真正的解码器，不属于原语层，
// 需要时由调用方先解码成 WAV。

/** 采样格式（对应 Rust `cap_audio::SampleFormat`） */
export type SampleFormat = "U8" | "I16" | "I24" | "I32" | "F32";

/** 音频信息（对应 Rust `cap_audio::AudioInfo`） */
export interface AudioInfo {
  /** 采样率（Hz） */
  sampleRate: number;
  /** 声道数 */
  channels: number;
  /** 每样本位数 */
  bitsPerSample: number;
  /** 样本是否为 IEEE 浮点 */
  isFloat: boolean;
  /** 时长（秒） */
  durationSecs: number;
  /** 帧数（每声道一个采样点为一帧） */
  frames: number;
  /** 文件字节数 */
  size: number;
}

/** 一段 PCM（对应 Rust `cap_audio::Pcm`） */
export interface PcmData {
  /** 采样率（Hz） */
  sampleRate: number;
  /** 声道数，恒 >= 1 */
  channels: number;
  /** 交错样本，取值 [-1.0, 1.0] */
  samples: number[];
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * 所有文件级变换的命令返回**写入字节数**；输入输出路径都是调用方的路径，
 * 路径守卫（黑名单 / `..` 拒绝）属于调用方策略，不在本契约内。
 */
export interface CapAudioCommands {
  /** 读取音频基本信息 */
  getAudioInfo: { args: { path: string }; returns: AudioInfo };
  /** 探测容器格式（如 `"wav"`） */
  detectAudioFormat: { args: { path: string }; returns: string };
  /** 读出整段 PCM（样本以 f32 交错传输） */
  readAudioPcm: { args: { path: string }; returns: PcmData };
  /** 写入一段 PCM 到目标文件 */
  writeAudioPcm: { args: { path: string; pcm: PcmData; format: SampleFormat }; returns: number };
  /** 转换（重采样 / 单声道化 / 目标格式） */
  convertAudio: {
    args: { src: string; dest: string; targetRate?: number; mono: boolean; format: SampleFormat };
    returns: number;
  };
  /** 重采样 */
  resampleAudio: { args: { src: string; dest: string; newRate: number; format: SampleFormat }; returns: number };
  /** 截取时间区间 */
  trimAudio: {
    args: { src: string; dest: string; startSecs: number; endSecs: number; format: SampleFormat };
    returns: number;
  };
  /** 线性增益 */
  applyAudioGain: { args: { src: string; dest: string; linear: number; format: SampleFormat }; returns: number };
  /** 淡入淡出 */
  fadeAudio: {
    args: { src: string; dest: string; fadeInSecs: number; fadeOutSecs: number; format: SampleFormat };
    returns: number;
  };
  /** 峰值归一化（目标峰值必须落在 (0, 1]） */
  normalizeAudio: {
    args: { src: string; dest: string; targetPeak: number; format: SampleFormat };
    returns: number;
  };
  /** 转单声道 */
  toMonoAudio: { args: { src: string; dest: string; format: SampleFormat }; returns: number };
  /** 倒放 */
  reverseAudio: { args: { src: string; dest: string; format: SampleFormat }; returns: number };
  /** 拼接多段 */
  concatAudio: { args: { paths: string[]; dest: string; format: SampleFormat }; returns: number };
  /** 两段混合 */
  mixAudio: { args: { a: string; b: string; dest: string; format: SampleFormat }; returns: number };
}

/** 错误文案稳定值（Rust 侧错误串的前缀，按 startsWith 匹配） */
export const CapAudioErrors = {
  /** WAV 头不完整 */
  HeaderTruncated: "WAV 头不完整",
  /** 目标峰值越界 */
  TargetPeakOutOfRange: "目标峰值必须落在 (0, 1]",
  /** 采样率非法 */
  InvalidSampleRate: "采样率",
} as const;
