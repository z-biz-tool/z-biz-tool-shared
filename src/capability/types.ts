// cap-img 命令契约（z-biz-tool-capability v0.1.1）
//
// 矩阵规划 03 §4.2：shared 只放契约，不放实现。本文件只描述 Rust 侧
// cap-img 的调用面；实现落在仓库 `z-biz-tool-capability`，消费方在 Tauri
// 后端的 `#[tauri::command]` 薄壳里调用 Rust 后再透传给前端。
//
// 文件命名约定：Rust 侧 snake_case，前端侧 camelCase（如 get_image_info → getImageInfo）。

/** 图片信息（对应 Rust `cap_img::ImageInfo`） */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  exif: Record<string, string> | null;
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