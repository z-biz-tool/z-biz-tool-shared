// cap-doc 命令契约（z-biz-tool-capability crates/cap-doc 0.1.0）。
//
// 能力边界：在能力层里的是**纯计算**——PDF 列页 / 文本抽取 / 元数据 / 合并 / 拆分 /
// 压缩 / 水印 / 内嵌图提取 + EPUB / MOBI 章节解析与封面。
// 不在的（刻意留在 file）：调 LibreOffice 的导出、调 tesseract 的 OCR ——
// 那是外部工具编排，进能力层会把工具依赖传染给所有下游。

/** 章节（对应 Rust `cap_doc::Chapter`） */
export interface DocChapter {
  title: string;
  /** 章节正文（纯文本） */
  content: string;
  /** 章节序号 */
  index: number;
}

/** 电子书（对应 Rust `cap_doc::EpubBook`） */
export interface EpubBook {
  title: string;
  author: string;
  chapters: DocChapter[];
  /** 封面图片路径（无封面时为空串） */
  coverPath: string;
}

/** PDF 页信息（对应 Rust `cap_doc::PdfPageInfo`） */
export interface PdfPageInfo {
  /** 页码，从 1 起 */
  pageNumber: number;
  width: number;
  height: number;
  sizeBytes: number;
}

/** PDF 元数据（对应 Rust `cap_doc::PdfMeta`） */
export interface PdfMeta {
  title: string;
  author: string;
  pageCount: number;
  creator: string;
}

/** 压缩报告（对应 Rust `cap_doc::CompressReport`） */
export interface CompressReport {
  originalSize: number;
  newSize: number;
  /** 重写（图片重编码）成功的条数 */
  rewritten: number;
  /** 走 flate 重压缩成功的条数 */
  flated: number;
  /** 整份退回原样输出的说明（常量 "已按原样输出副本"） */
  skipped: string[];
}

/** 内嵌图提取报告（对应 Rust `cap_doc::ExtractReport`） */
export interface ExtractReport {
  /** 抽出的图片文件路径 */
  images: string[];
  /** 跳过的条目说明 */
  skipped: string[];
}

/**
 * 命令名 → 参数/返回形状的注册表。
 *
 * ⚠️ 路径守卫（黑名单源/黑名单目标、`..` 拒绝）**不在本层**：
 * `paths::input` 只查「文件存在」，读/写黑名单属于调用方策略，
 * 由 file 仓的 `path_guard` 在薄壳里前置执行。
 */
export interface CapDocCommands {
  /** 解析 EPUB 章节 */
  parseEpub: { args: { path: string }; returns: EpubBook };
  /** 解析 MOBI 章节 */
  parseMobi: { args: { path: string }; returns: EpubBook };
  /**
   * 按扩展名分派到具体解析器（epub / mobi / txt / fb2）。
   *
   * 前端只需要记一个命令：这本书是什么格式，由能力层判断。
   * 让每个调用点各抄一份扩展名表，那份表早晚会和实际实现长歪。
   */
  parseEbook: { args: { path: string }; returns: EpubBook };
  /** 解析 TXT 小说（章节按标题行切分，编码自动兜底 GB18030） */
  parseTxt: { args: { path: string }; returns: EpubBook };
  /** 解析 FB2（俄文 XML 电子书） */
  parseFb2: { args: { path: string }; returns: EpubBook };
  /** 解析 CBZ 漫画（返回图片路径列表） */
  extractComic: { args: { path: string; cacheRoot: string }; returns: string[] };
  /** 取 EPUB 封面（返回图片路径） */
  getEpubCover: { args: { path: string }; returns: string };
  /** 列出 PDF 页面信息 */
  getPdfPages: { args: { path: string }; returns: PdfPageInfo[] };
  /** 抽取 PDF 文本 */
  extractPdfText: { args: { path: string }; returns: string };
  /** 读取 PDF 元数据 */
  getPdfMetadata: { args: { path: string }; returns: PdfMeta };
  /** 合并多个 PDF（返回页数） */
  mergePdfs: { args: { inputPaths: string[]; outputPath: string }; returns: number };
  /** 按页区间拆分 PDF（返回产出文件路径） */
  splitPdf: {
    args: { inputPath: string; outputDir: string; pageRanges: [number, number][] };
    returns: string[];
  };
  /** 压缩 PDF（返回压缩报告） */
  compressPdf: {
    args: { inputPath: string; outputPath: string; quality?: number; maxDimension?: number };
    returns: CompressReport;
  };
  /** 提取 PDF 内嵌图（返回提取报告） */
  extractPdfImages: { args: { inputPath: string; outputDir: string }; returns: ExtractReport };
  /** 给 PDF 打水印（返回页数） */
  watermarkPdf: {
    args: { inputPath: string; outputPath: string; text: string; opacity: number };
    returns: number;
  };
}

/** 错误文案稳定值（Rust 侧错误串的前缀，按 startsWith 匹配） */
export const CapDocErrors = {
  /** 文件不存在 */
  FileNotFound: "文件不存在",
  /** 合并至少要两个 */
  MergeNeedsTwo: "合并至少需要两个 PDF",
  /** PDF 没有页面 */
  NoPages: "PDF 没有任何页面",
} as const;
