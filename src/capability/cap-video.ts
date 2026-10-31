// cap-video 命令契约（z-biz-tool-capability crates/cap-video 0.1.0）。
//
// 能力边界：**容器元数据自己探**（MP4/MOV 的 ISO BMFF、Matroska/WebM 的 EBML，
// 零依赖零解码）；**解码与抽帧必须借 ffmpeg** —— 纯 Rust 没有可用的全格式解码器，
// 所以本层只把 ffmpeg 的「可用性检测」与「失败原因」做扎实。

/** 视频信息（对应 Rust `cap_video::VideoInfo`） */
export interface VideoInfo {
  /** 时长（秒） */
  durationSecs: number;
  /** 宽（像素） */
  width: number;
  /** 高（像素） */
  height: number;
  /** 平均码率（bps），由文件大小与时长推出 */
  bitrate: number;
  /** 文件字节数 */
  size: number;
  /** 容器类型："mp4" / "mov" / "webm" / "mkv" */
  container: string;
  /** 视频编码标识（MP4 是 fourcc，WebM 是 V_*） */
  videoCodec?: string;
  /** 音频编码标识 */
  audioCodec?: string;
  /** 帧数（容器里能读到才有） */
  frameCount?: number;
  /** 轨道数 */
  trackCount: number;
  /** 是否有音频轨 */
  hasAudio: boolean;
}

/** ffmpeg 探测结果（对应 Rust `cap_video::FfmpegInfo`） */
export interface FfmpegInfo {
  /** 可执行文件路径 */
  path: string;
  /** `ffmpeg -version` 首行 */
  versionLine: string;
}

/** 抽帧结果：写入字节数与图片尺寸 */
export interface ExtractedFrame {
  /** 写入的字节数 */
  bytes: number;
  width: number;
  height: number;
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * ⚠️ `ffmpegAvailable` 的语义是「**真的跑得起来**」而不是「文件存在」：
 * 有安装目录齐全但缺动态库、spawn 就 dyld 报错的情况。
 */
export interface CapVideoCommands {
  /** 读取视频元数据（不解码） */
  getVideoInfo: { args: { path: string }; returns: VideoInfo };
  /** 探测容器类型（如 `"mp4"`） */
  detectVideoContainer: { args: { path: string }; returns: string };
  /** ffmpeg 是否真的可用 */
  ffmpegAvailable: { args: Record<string, never>; returns: boolean };
  /** 探测 ffmpeg 路径与版本 */
  probeFfmpeg: { args: Record<string, never>; returns: FfmpegInfo };
  /** 抽一帧存成图片（需要 ffmpeg） */
  extractVideoFrame: {
    args: { src: string; timeSecs: number; dest: string; timeoutMs: number };
    returns: ExtractedFrame;
  };
  /** 生成缩略图（需要 ffmpeg） */
  videoThumbnail: { args: { src: string; dest: string; maxSize: number }; returns: ExtractedFrame };
}

/** 错误文案稳定值（Rust 侧错误串的前缀，按 startsWith 匹配） */
export const CapVideoErrors = {
  /** ffmpeg 不可用 */
  FfmpegUnavailable: "ffmpeg",
  /** 容器无法识别 */
  UnsupportedContainer: "不支持的容器",
  /** 抽帧超时 */
  ExtractTimeout: "超时",
} as const;
