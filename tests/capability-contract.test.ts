// 能力层跨语言命令契约的回归（无 React、无 DOM）。
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 为什么这个文件优先：src/capability/ 里声明的命令名，是前端
// 透过 Tauri #[tauri::command] 薄壳调 Rust `cap_xxx::*` 的**唯一约定**。
// 两边任何一边改名/增删都不会编译报错 —— 前端调过去拿到的是运行时报错，
// 或是静默走错分支。契约漂移是这类分层里最难发现的一类 bug。
//
// src/capability/types.ts 的注释里留过一条待办：
//   "audit 加『声明 ↔ 注册』检查项"
// 这份测试就是那个检查项。2026-10-31 起从「只管 cap-img」扩到全部 crate：
// cap-audio / cap-video / cap-doc / cap-llm / cap-hub / cap-meeting /
// cap-hash / cap-sso 都有了 TS 契约，也就都要被这份检查盯着。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * capability 仓的位置；不在盘上时下面那几条交叉校验会跳过而不是假装通过。
 *
 * **为什么 CI 不用 `../../` 去猜同级**（2026-10-04 实测踩过）：
 * `actions/checkout` 只要有任何一个 step 带 `path:`，**第一个不带 path 的
 * checkout 也会被嵌进 `$GITHUB_WORKSPACE/<仓名>`**。于是本仓实际落在
 * `$GITHUB_WORKSPACE/z-biz-tool-shared/`，`resolve(HERE, "../../…")` 指向
 * `$GITHUB_WORKSPACE/..` —— **workspace 之外**，而 checkout 的 `path:`
 * 写不到那里。
 *
 * 后果很隐蔽：CI 日志里哨兵按 CWD 相对路径查「✅ 前提在」，
 * 而测试按 `../../` 查「仓不在盘上」，**同一个绝对路径，两个相反结论**。
 * 哨兵量的和测试量的不是同一个东西。
 *
 * 所以 CI 用 `ZBT_CAPABILITY_DIR` 显式指定，测试和哨兵读同一个变量 ——
 * 两者再也不可能对不上。本地不设该变量时仍走同级推导（本地是真同级）。
 */
const CAP_DIR = process.env.ZBT_CAPABILITY_DIR || resolve(HERE, "../../z-biz-tool-capability");
const CAP_SRC = resolve(HERE, "../src/capability");

/** 一个 crate 的契约登记：TS 命令名 ↔ Rust 函数名，以及不该进契约的内部函数 */
interface CrateSpec {
  /** crate 名（crates/<crate>） */
  crate: string;
  /** TS 契约文件（相对 src/capability/） */
  file: string;
  /** TS 里的 interface 名 */
  iface: string;
  /** TS 命令名 → Rust 侧函数名（或常量名） */
  map: Record<string, string>;
  /** Rust 侧有、但**不该**进 IPC 契约的内部函数 */
  internals: string[];
  /** Rust 源码文件（相对 crate 根）；只扫列出的文件 */
  rustFiles: string[];
}

/**
 * TS 命令名 → Rust 侧 `pub fn` 名。
 * 命名规则是 snake_case → camelCase，但命令名本身常带语义词
 * （getImageInfo ↔ info、saveImageData ↔ save_bytes），
 * 所以映射关系必须显式写死，不能靠"自动转驼峰"推导 —— 推导出来的等于没测。
 */
const CRATES: CrateSpec[] = [
  {
    crate: "cap-img",
    file: "types.ts",
    iface: "CapImgCommands",
    map: {
      getImageInfo: "info",
      getImageThumbnail: "thumbnail",
      saveImageData: "save_bytes",
      exportImage: "export",
      resizeImage: "resize",
      rotateImage: "rotate",
      flipImage: "flip",
      cropImage: "crop",
      applyFilter: "apply_filter",
      // EXIF 全量读写（cap-img 0.4.0 起）
      readExif: "read",
      writeExif: "write",
      stripExif: "strip",
    },
    internals: [
      "decode_data_url",
      "encode_data_url",
      "encode_frame_jpeg",
      "detect_format",
      "sniff_format",
      "parse_format",
      "mime_for_ext",
      "ext_for_mime",
      // --- cap-img 0.4.0 的 EXIF 模块 ---
      // 这几个是 read/write/strip 的**内部变体**或**纯查询**，
      // 前端要的能力已经被 readExif / writeExif / stripExif 覆盖：
      //   read_container  —— 读原始 Exif 对象（Rust 侧组合用）
      //   read_or_empty   —— 没有 EXIF 时返回空快照而不是 None
      //   read_json       —— 直接吐 JSON 字符串（薄壳自用）
      //   normalize       —— 把 kamadak-exif 的 Exif 转成我们的结构（纯转换）
      // 以下是 ExifData 的**查询方法**，不是独立命令：
      //   display / value / find / field_count / is_empty / gps_coordinates
      "read_container",
      "read_or_empty",
      "read_json",
      "normalize",
      "display",
      "value",
      "find",
      "field_count",
      "is_empty",
      "gps_coordinates",
    ],
    // src/exif.rs 是 0.4.0 新增的 EXIF 模块 —— 不登记它，
    // 门禁就看不见 exif.rs 里的 pub fn，EXIF 契约会失去交叉校验。
    rustFiles: ["src/lib.rs", "src/exif.rs"],
  },
  {
    crate: "cap-audio",
    file: "cap-audio.ts",
    iface: "CapAudioCommands",
    map: {
      getAudioInfo: "info",
      detectAudioFormat: "detect_format",
      readAudioPcm: "read_pcm",
      writeAudioPcm: "write_pcm",
      convertAudio: "convert",
      resampleAudio: "resample",
      trimAudio: "trim",
      applyAudioGain: "apply_gain_file",
      fadeAudio: "fade",
      normalizeAudio: "normalize",
      toMonoAudio: "to_mono",
      reverseAudio: "reverse",
      concatAudio: "concat",
      mixAudio: "mix",
    },
    internals: [
      // WAV 容器级原语（字节进字节出，薄壳用不上）
      "probe_wav",
      "decode_wav",
      "encode_wav",
      "sniff_format",
      // 纯 DSP 函数（作用在 Pcm 上，前端不直接调）
      "gain",
      "fade_in",
      "fade_out",
      "interleave",
      "is_silent",
      "normalize_peak",
      "peak",
      "rms",
      "rms_dbfs",
      "split_channels",
      // Pcm 的构造与只读方法
      "new",
      "validate",
      "frames",
      "duration_secs",
      "is_empty",
      "frame",
      "bytes",
      "frame_bytes",
      "bits",
      "from_bits",
      "is_float",
    ],
    rustFiles: ["src/lib.rs", "src/pcm.rs", "src/dsp.rs"],
  },
  {
    crate: "cap-video",
    file: "cap-video.ts",
    iface: "CapVideoCommands",
    map: {
      getVideoInfo: "info",
      detectVideoContainer: "detect_container",
      ffmpegAvailable: "available",
      probeFfmpeg: "probe",
      extractVideoFrame: "extract_frame",
      videoThumbnail: "thumbnail",
    },
    internals: [
      // ffmpeg 定位（薄壳自己找 PATH 就行，不必过 IPC）
      "locate",
      // 容器字节级探测（Rust 内部自用）
      "sniff_container",
      "is_native_container",
      // VideoInfo 的派生属性
      "fps",
    ],
    rustFiles: ["src/lib.rs", "src/ffmpeg.rs", "src/mp4.rs", "src/matroska.rs"],
  },
  {
    crate: "cap-doc",
    file: "cap-doc.ts",
    iface: "CapDocCommands",
    map: {
      parseEpub: "parse_epub",
      parseMobi: "parse_mobi",
      getEpubCover: "get_epub_cover",
      getPdfPages: "get_pdf_pages",
      extractPdfText: "extract_pdf_text",
      getPdfMetadata: "get_pdf_metadata",
      mergePdfs: "merge_pdfs",
      splitPdf: "split_pdf",
      compressPdf: "compress_pdf_blocking",
      extractPdfImages: "extract_pdf_images_blocking",
      watermarkPdf: "watermark_pdf_blocking",
    },
    internals: [
      // 扩展名支持判定（调用方自己判，或薄壳里判）
      "supports",
      "SUPPORTED_EXTENSIONS",
      // 测试脚手架 TempDir
      "new",
    ],
    rustFiles: [
      "src/lib.rs",
      "src/ebook.rs",
      "src/pdf/mod.rs",
      "src/pdf/ops.rs",
      "src/pdf/text.rs",
      "src/pdf/compress.rs",
      "src/pdf/watermark.rs",
      "src/pdf/image.rs",
      "src/pdf/font.rs",
      "src/test_support.rs",
    ],
  },
  {
    crate: "cap-llm",
    file: "cap-llm.ts",
    iface: "CapLlmCommands",
    map: {
      llmChat: "chat",
      llmChatWithTools: "chat_with_tools",
      llmChatStream: "chat_stream",
      llmListModels: "list_models",
      llmPing: "ping",
      llmTranscribe: "transcribe",
      llmTranscribeFile: "transcribe_file",
      listLlmPresets: "PRESETS",
    },
    internals: [
      // Message 的构造器
      "system",
      "user",
      "assistant",
      "assistant_with_tools",
      "tool",
      "with_images",
      "push",
      // ProviderKind 的解析与元信息
      "parse",
      "parse_with_preset",
      "protocol",
      "default_base_url",
      "requires_api_key",
      "label",
      // LlmConfig 的派生与校验
      "needs_api_key",
      "validate",
      "endpoint",
      "stream_endpoint",
      // LlmError 的构造器与分类
      "new",
      "http",
      "not_configured",
      "parse",
      "is_retryable",
      // 协议层（报文构造/解析/鉴权），薄壳不暴露
      "auth_headers",
      "build_body",
      "needs_query_key",
      "parse_reply",
      "parse_delta",
      "parse_models",
      "parse_data",
      // 预设目录的按需查找
      "find",
      "find_by_name",
      "by_category",
      "config_for",
      // 工具函数
      "is_private_endpoint",
      "redact",
      "truncate_chars",
      // 带停止条件的流式变体
      "chat_stream_if",
      // 常量与消息构造器
      "VERSION",
      "DEFAULT_MAX_TOKENS",
      "as_str",
      "finish",
      "to_config",
    ],
    rustFiles: ["src/lib.rs", "src/chat.rs", "src/sse.rs", "src/message.rs", "src/wire.rs", "src/config.rs", "src/presets.rs", "src/asr.rs", "src/error.rs"],
  },
  {
    crate: "cap-hub",
    file: "cap-hub.ts",
    iface: "CapHubCommands",
    map: {
      takePending: "take_pending_from",
      buildDeepLink: "build",
      parseDeepLink: "parse",
      listDeepLinkProducts: "deep_link_products",
      isKnownProduct: "is_product_id",
    },
    internals: [
      // 参数编解码（薄壳内部用）
      "encode",
      "decode",
      "from_args",
      // 构造带来源的深链（Tauri 胶水层用）
      "build_for",
      // Tauri 事件推送与冷启动播种
      "push_all_and_notify",
      "seed_cold_start",
      "handle_second_instance",
      // 队列与 Handoff 的方法
      "push",
      "take",
      "param",
      "file",
      // 产品清单查询
      "find",
      "products_by_action",
      "validate",
      // 家族约定的事件名与产品 id 清单
      "EVENT",
      "PRODUCT_IDS",
    ],
    rustFiles: ["src/lib.rs", "src/manifest.rs", "src/receiver.rs"],
  },
  {
    crate: "cap-meeting",
    file: "cap-meeting.ts",
    iface: "CapMeetingCommands",
    map: {
      meetingMinutesFromText: "from_text",
      meetingMinutesFromTextWithMeeting: "from_text_with_meeting",
      meetingMinutesFromTranscript: "from_transcript",
      meetingMinutesToMarkdown: "to_markdown",
    },
    internals: [
      // 模型回复的 JSON 解析（薄壳内部步骤）
      "parse_json_reply",
      // 提示词模板（crate 内部常量，不经 IPC 下发）
      "PROMPT_TEMPLATE",
      "SYSTEM_PROMPT",
    ],
    rustFiles: ["src/lib.rs", "src/prompt.rs"],
  },
  {
    crate: "cap-hash",
    file: "cap-hash.ts",
    iface: "CapHashCommands",
    map: {
      computeFnv1a32: "fnv1a32",
      computeFnv1a32OfText: "fnv1a32_str",
      computeCrc32: "crc32_ieee",
    },
    internals: [
      // 十六进制包装（薄壳自己 format 也行，不必过 IPC）
      "fnv1a32_hex",
      "crc32_ieee_hex",
      // 流式 CRC 的方法
      "new",
      "update",
      "finalize",
      // 算法常量（口径的一部分，写在 TS 侧孪生里）
      "FNV1A_32_OFFSET",
      "FNV1A_32_PRIME",
      "CRC32_IEEE_POLY",
    ],
    rustFiles: ["src/lib.rs"],
  },
  {
    crate: "cap-sso",
    file: "cap-sso.ts",
    iface: "CapSsoCommands",
    map: {
      ssoStartCallbackServer: "start",
      ssoWaitForCallback: "wait_for_callback",
      ssoValidateUrl: "validate_url",
      ssoOpenUrl: "open_url",
      ssoSetSecret: "set",
      ssoGetSecret: "get",
      ssoDeleteSecret: "delete",
      ssoCheckKeychain: "check_available",
    },
    internals: [
      // 密钥后端名（诊断用）
      "backend_name",
      // 回调服务的生命周期方法
      "new",
      "port",
      "close",
      "start_on_port",
      // Tauri 胶水层
      "open_url_with_tauri",
      // 回环地址判定
      "is_loopback",
      // 回调服务的默认参数
      "DEFAULT_CALLBACK_PATH",
      "DEFAULT_CALLBACK_TIMEOUT_SECS",
    ],
    rustFiles: ["src/lib.rs", "src/callback.rs", "src/opener.rs", "src/secrets.rs"],
  },
];

/** 从 Rust 源码文件里解析公开的函数名与常量名 */
function publicNames(files: string[]): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/^\s*pub (?:async )?fn ([a-z_][a-z0-9_]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^\s*pub (?:const|static) ([A-Z_][A-Z0-9_]*)/gm)) names.add(m[1]);
  }
  return names;
}

/** 某个 crate 的源码文件绝对路径 */
function rustFilesOf(c: CrateSpec): string[] {
  return c.rustFiles.map((f) => resolve(CAP_DIR, "crates", c.crate, f));
}

/**
 * 从 TS 契约文件里解析某个 interface 实际声明的命令名。
 *
 * 不能直接 `Object.keys(commands)` —— `CapImgCommands` 是 **interface**，
 * 编译后根本不存在于运行时，只有类型。所以只能从源码里抠出来。
 * （第一版这里写成了 `declare const`，运行时会直接炸 —— 类型和值不是一回事。）
 */
function declaredCommandsFromSource(file: string, iface: string): string[] {
  const src = readFileSync(resolve(CAP_SRC, file), "utf8");
  const start = src.indexOf(`export interface ${iface}`);
  assert.notEqual(start, -1, `${file} 里找不到 ${iface} 接口，源码结构变了？`);
  const open = src.indexOf("{", start);
  const close = src.indexOf("\n}", open);
  assert.notEqual(close, -1, `${iface} 接口没有正常闭合`);
  const body = src.slice(open, close);
  return [...body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): \{/gm)].map((m) => m[1]);
}

const capRepoPresent = existsSync(resolve(CAP_DIR, "crates"));

test("契约表与映射表一一对应，不多不少", () => {
  for (const c of CRATES) {
    const fromContract = declaredCommandsFromSource(c.file, c.iface);
    const fromMap = Object.keys(c.map);
    assert.deepEqual(
      [...fromMap].sort(),
      [...fromContract].sort(),
      `${c.crate}：TS 契约的命令与映射表不一致 —— 新增命令时两处都要改`,
    );
  }
});

test("每个映射的 Rust 名字都是合法的 snake_case 标识符", () => {
  for (const c of CRATES) {
    for (const [ts, rust] of Object.entries(c.map)) {
      const ok = /^[a-z][a-z0-9_]*$/.test(rust) || /^[A-Z_][A-Z0-9_]*$/.test(rust);
      assert.ok(ok, `${c.crate}：${ts} → "${rust}" 不是合法的 snake_case 函数名或常量名`);
    }
  }
});

test("与 Rust 源码交叉校验：声明的每个命令在 crate 里都有对应实现", (t) => {
  if (!capRepoPresent) {
    t.skip(`capability 仓不在盘上（${CAP_DIR}），跳过交叉校验`);
    return;
  }
  for (const c of CRATES) {
    const pubNames = publicNames(rustFilesOf(c));
    assert.ok(pubNames.size > 0, `${c.crate}：没从 Rust 源码里解析出任何 pub fn，正则可能已失效`);
    for (const [ts, rustName] of Object.entries(c.map)) {
      assert.ok(
        pubNames.has(rustName),
        `${c.crate}：TS 契约声明了 "${ts}" → Rust "${rustName}"，但 crate 里没有这个实现。\n` +
          `Rust 现有: ${[...pubNames].sort().join(", ")}`,
      );
    }
  }
});

test("与 Rust 源码交叉校验：内部工具函数没有被误登记进前端契约", (t) => {
  if (!capRepoPresent) {
    t.skip(`capability 仓不在盘上（${CAP_DIR}），跳过交叉校验`);
    return;
  }
  for (const c of CRATES) {
    const declared = new Set(Object.values(c.map));
    for (const helper of c.internals) {
      assert.ok(
        !declared.has(helper),
        `${c.crate}："${helper}" 是 crate 内部实现，不该出现在前端 IPC 契约里`,
      );
    }
  }
});

test("与 Rust 源码交叉校验：契约没有漏掉 Rust 的公开能力", (t) => {
  if (!capRepoPresent) {
    t.skip(`capability 仓不在盘上（${CAP_DIR}），跳过交叉校验`);
    return;
  }
  for (const c of CRATES) {
    const pubNames = publicNames(rustFilesOf(c));
    const declared = new Set(Object.values(c.map));
    const internals = new Set(c.internals);
    // Rust 里新增了公开函数却没在前端契约登记 ⇒ 前端调不到它。
    // 这条报错不代表一定是 bug（可能有意只在 Rust 侧提供），
    // 但必须被人看一眼，不该静默通过。
    const undeclared = [...pubNames]
      .filter((f) => !declared.has(f) && !internals.has(f))
      .sort();
    assert.deepEqual(
      undeclared,
      [],
      `${c.crate}：Rust 新增了公开实现但前端契约没登记: ${undeclared.join(", ")}\n` +
        `若是有意只在 Rust 侧提供，请把名字补进 internals 并注明原因。`,
    );
  }
});
