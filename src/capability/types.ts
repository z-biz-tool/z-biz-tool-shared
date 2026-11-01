// cap-img 命令契约（z-biz-tool-capability crates/cap-img 0.4.0）。
//
// 矩阵规划 03 §4.2：shared 只放契约，不放实现。本文件只描述 Rust 侧
// cap-img 的调用面；实现落在仓库 `z-biz-tool-capability`，消费方在 Tauri
// 后端的 `#[tauri::command]` 薄壳里调用 Rust 后再透传给前端。
//
// 文件命名约定：Rust 侧 snake_case，前端侧 camelCase（如 get_image_info → getImageInfo）。
//
// ⚠️ 其余 crate 的契约在同目录的 cap-audio.ts / cap-video.ts / cap-doc.ts /
// cap-llm.ts / cap-hub.ts / cap-meeting.ts / cap-hash.ts / cap-sso.ts，
// 统一由 index.ts 导出。

/**
 * EXIF 值的类型（对应 Rust `cap_img::ExifValueKind`）。
 *
 * 为什么保留类型：EXIF 的值有十来种类型（ASCII / Rational / Short / …），
 * 全部压成字符串就丢掉了「这是光圈还是焦距」的信息。
 */
export type ExifValueKind =
  | "ascii"
  | "rational"
  | "short"
  | "long"
  | "byte"
  | "sbyte"
  | "sshort"
  | "slong"
  | "float"
  | "double"
  | "srational"
  | "undefined";

/**
 * EXIF 的单个值（对应 Rust `cap_img::ExifValue`）。
 *
 * Rust 侧用 `#[serde(tag = "type", content = "value")]` 序列化，
 * 所以前端拿到的是 `{ type: "text", value: "Canon" }` 这样的形状。
 */
export type ExifValue =
  | { type: "text"; value: string }
  | { type: "int"; value: number }
  /** 有理数存成 `"num/den"` 字符串，避免 JSON 里出现浮点精度损失 */
  | { type: "rational"; value: string }
  | { type: "float"; value: number }
  /** 字节块，十六进制字符串 */
  | { type: "bytes"; value: string };

/** 单个 EXIF 字段（对应 Rust `cap_img::ExifField`） */
export interface ExifField {
  /** 标签名（如 `Make`、`FNumber`、`GPSLatitude`）；未知标签退化为 `Tag_0x1234` */
  name: string;
  /** 标签的十六进制值（如 `0x010f`）；名字可能重复，十六进制才唯一 */
  tag: number;
  /** 值类型 */
  kind: ExifValueKind;
  /** 人类可读的显示值（`"1/250"`、`"2.8"`、`"Canon"`） */
  display: string;
  /** 原始类型化值 */
  values: ExifValue[];
}

/** 一个 IFD 的内容（对应 Rust `cap_img::ExifIfd`） */
export interface ExifIfd {
  /** 该 IFD 下的字段（按标签十六进制升序，读取稳定） */
  fields: ExifField[];
}

/**
 * EXIF 的完整快照（对应 Rust `cap_img::ExifData`）。
 *
 * 按 IFD 分桶：主 IFD 是机型/方向/分辨率，`exif` 是曝光/光圈/ISO/镜头，
 * `gps` 是经纬度/海拔。分桶依据是 EXIF 规范里的 IFD 归属，
 * 不是「哪些字段看起来像」。
 */
export interface ExifData {
  /** 主 IFD（IFD0） */
  primary: ExifIfd;
  /** Exif SubIFD：曝光、光圈、ISO、焦距、镜头 */
  exif: ExifIfd;
  /** GPS IFD：经纬度、海拔、定位时间 */
  gps: ExifIfd;
  /** 缩略图 IFD（IFD1） */
  thumbnail: ExifIfd;
  /** 是否小端字节序 */
  littleEndian: boolean;
}

/**
 * 一次 EXIF 编辑（对应 Rust `cap_img::ExifEdit`）。
 *
 * 语义是「在原有基础上改」而不是「全量替换」：
 * `set` 覆盖同名标签，`remove` 剔除指定标签，**其余字段原样保留**
 * （包括 MakerNote 这类我们不认识的 tag）。
 */
export interface ExifEdit {
  /** 要写入/覆盖的字段 */
  set: ExifField[];
  /** 要删除的标签（名字或十六进制串，如 `"GPSLatitude"` 或 `"0x8825"`） */
  remove: string[];
}

/** 图片信息（对应 Rust `cap_img::ImageInfo`） */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  /**
   * EXIF 快照（结构化，按 IFD 分桶）。
   *
   * **形状变更（cap-img 0.4.0）**：此前是 `Record<string, string> | null` ——
   * 只装五个 ASCII 标签的扁平表。现在的形状是 {@link ExifData}，
   * 覆盖全部标签与类型。旧的调用方需要改成读 `exif.primary.fields` 等。
   */
  exif: ExifData | null;
}

/** 缩略图结果（PNG 已 base64 编码，对应 `cap_img::ImageThumbnail`） */
export interface ImageThumbnail {
  data: string;
  width: number;
  height: number;
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * 任何想新增 cap-* crate（例如 cap-audio/cap-video）时，遵循：
 *   1. Rust crate 暴露 `pub fn xxx(...: impl AsRef<Path>) -> Result<..., String>`
 *   2. 在此处新增同名的命令条目，类型对应一致
 *   3. `tauri::command` 薄壳签名复用此处的入参出参
 *   4. audit 加"声明 ↔ 注册"检查项
 */
export interface CapImgCommands {
  /** 获取图片基本信息（含 EXIF，JPEG/TIFF 才填） */
  getImageInfo: { args: { path: string }; returns: ImageInfo };
  /** 生成 PNG 缩略图，返回 base64 编码；maxSize=0 视为 200 */
  getImageThumbnail: {
    args: { path: string; maxSize: number };
    returns: ImageThumbnail;
  };
  /** 导出为指定格式；JPEG 用 quality(1-100)，其它格式 quality 被 clamp 后忽略 */
  exportImage: {
    args: { path: string; destPath: string; format: string; quality: number };
    returns: void;
  };
  /** 缩放至 width×height（Lanczos3） */
  resizeImage: {
    args: { path: string; destPath: string; width: number; height: number };
    returns: void;
  };
  /** 旋转 90/180/270 度，其它角度报错 */
  rotateImage: {
    args: { path: string; destPath: string; degrees: number };
    returns: void;
  };
  /** 翻转（horizontal=true 水平，否则垂直） */
  flipImage: {
    args: { path: string; destPath: string; horizontal: boolean };
    returns: void;
  };
  /** 裁剪 [x,y,w,h]；越界报错 */
  cropImage: {
    args: { path: string; destPath: string; x: number; y: number; w: number; h: number };
    returns: void;
  };
  /** 滤镜：grayscale/sepia/invert/brightness/contrast/blur/sharpen；其它报错 */
  applyFilter: {
    args: { path: string; destPath: string; filterName: string };
    returns: void;
  };
  /**
   * 保存 base64 数据到文件；format 与目标扩展名必须匹配
   * （jpeg 别名 .jpg/.jpeg 均可），不匹配报错
   */
  saveImageData: {
    args: { data: string; destPath: string; format: string };
    returns: number; // 写入字节数
  };
  /**
   * 读取 EXIF 完整快照（按 IFD 分桶，含类型化值）。
   *
   * 文件里没有 EXIF ⇒ 返回 null（**不是错误**：一张普通图片就是这样）。
   * 有 EXIF 但数据损坏 ⇒ 报错。
   */
  readExif: {
    args: { path: string };
    returns: ExifData | null;
  };
  /**
   * 写入 EXIF：在原有基础上改，`set` 覆盖同名标签，`remove` 剔除指定标签，
   * **其余字段原样保留**（含 MakerNote 等未知 tag）。
   *
   * 像素**一个字节都不动** —— 只改容器里的 EXIF 段。
   */
  writeExif: {
    args: { path: string; destPath: string; edit: ExifEdit };
    returns: void;
  };
  /**
   * 清除全部 EXIF（隐私刚需：分享照片前抹掉 GPS 与机型）。
   *
   * 同样是字节级操作：只摘掉容器里的 EXIF 段，像素不动。
   */
  stripExif: {
    args: { path: string; destPath: string };
    returns: void;
  };
}

/** 错误文案稳定值（用于测试/对照前端契约） */
export const CapImgErrors = {
  /** 目标扩展名与所选格式不符 */
  FormatMismatch: '目标扩展名与所选格式不符',
  /** 旋转角度非 90/180/270 */
  InvalidAngle: '不支持的角度',
  /** 裁剪区域超出图片范围 */
  CropOutOfRange: '裁剪区域超出图片范围',
  /** 滤镜名未知 */
  UnknownFilter: '不支持的滤镜',
  /** 文件读取/打开失败 */
  OpenFailed: '打开图片失败',
  /** Base64 解码失败 */
  Base64DecodeFailed: 'Base64 解码失败',
} as const;