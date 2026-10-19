// AI 客户端与 provider 工厂
//
// 本文件从 AIManager.ts 里拆出来，原因是两个原因：
//
// 1. **要能测**：06 验收矩阵 UT-AI-03 要求「断言 createClient 的真实
//    provider 分支」。工厂和客户端原封不动埋在 AIManager.ts 里时，
//    测它就得把整个 zustand store 一起拉起来；拆出来后可直接单测。
//
// 2. **同一套规则不能写两遍**：原先 `AIManager.ts` 里只有一份
//    OpenAIClient，provider 工厂对 'claude'/'gemini'/'ollama'/'local'
//    全部落进 default 分支返回 OpenAIClient —— 配置写着 claude，
//    实际请求打向 api.openai.com（01 A-11）。这类"配置说一套、
//    实际做另一套"的问题，正是本轮要清掉的。
//
// 兼容性说明：这些类是**内部实现**，不从 src/ai/index.ts 导出，
// 因此不改变包的公共导出面（06 CT-EXPORT-01）。公共面只增不减。
import type {
  AIConfig,
  AIFunctionType,
  AIFunctionParams,
  AIResult,
  AIContext,
} from './types';

/** fetch 的最小结构（只声明本文件用得到的字段，便于测试注入桩） */
export interface AIClientRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** 响应结构的最小声明 */
export interface AIClientResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: AIClientRequestInit
) => Promise<AIClientResponse>;

/** AI 客户端接口 */
export interface AIClient {
  chat(prompt: string, context?: AIContext): Promise<AIResult>;
  execute(
    functionType: AIFunctionType,
    params: AIFunctionParams,
    context?: AIContext
  ): Promise<AIResult>;
  getModels(): Promise<string[]>;
  validateConfig(): boolean;
}

/** 未配置 timeout 时的默认上限（毫秒） */
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * 真实 fetch 的适配器。
 *
 * 单独包一层有两个用处：一是 fetch 缺失时给出可读报错，而不是
 * "fetch is not a function"；二是把 DOM 侧的 RequestInit 类型
 * 挡在这个文件之外，其余代码只认 AIClientRequestInit。
 */
const defaultFetch: FetchLike = (url, init) => {
  const g = globalThis as unknown as {
    fetch?: (input: string, init?: unknown) => Promise<AIClientResponse>;
  };
  if (typeof g.fetch !== 'function') {
    return Promise.reject(new Error('当前运行环境没有 fetch，无法调用 AI 服务'));
  }
  return g.fetch(url, init);
};

/**
 * 客户端基类：集中处理超时、prompt 构造、错误归一。
 *
 * **timeout 此前是死的**（01 A-10）：AIConfig.timeout 声明了、默认还给了
 * 30000，但 fetch 从来不带 AbortController —— 请求挂住就永远挂着。
 * 这里用 AbortController 把超时真正落地。
 */
abstract class BaseAIClient implements AIClient {
  protected readonly config: AIConfig;
  protected readonly fetchImpl: FetchLike;

  constructor(config: AIConfig, fetchImpl: FetchLike = defaultFetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /** 实际生效的超时上限；<= 0 表示不设上限（显式关闭） */
  protected get timeoutMs(): number {
    const raw = this.config.timeout;
    if (raw === undefined) return DEFAULT_TIMEOUT_MS;
    return raw > 0 ? raw : 0;
  }

  /**
   * 带超时的请求。
   *
   * 超时与其它错误要能区分开：超时时 fetch 会抛 AbortError，
   * 那是个含义模糊的报错，这里翻译成"请求超时（Nms）"。
   */
  protected async request(
    url: string,
    init: AIClientRequestInit
  ): Promise<AIClientResponse> {
    const timeout = this.timeoutMs;
    if (timeout === 0) {
      return this.fetchImpl(url, init);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`请求超时（${timeout}ms）`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  protected buildSystemPrompt(context?: AIContext): string {
    let prompt = 'You are a helpful assistant.';

    if (context?.knowledgeBase?.length) {
      prompt += '\n\nContext from knowledge base:\n' + context.knowledgeBase.join('\n');
    }

    if (context?.currentLanguage) {
      prompt += `\n\nCurrent programming language: ${context.currentLanguage}`;
    }

    return prompt;
  }

  protected buildPrompt(
    functionType: AIFunctionType,
    params: AIFunctionParams,
    _context?: AIContext
  ): string {
    switch (functionType) {
      case 'explain':
        return `Please explain this command or code:\n\n${params.text}`;
      case 'analyze':
        return `Please analyze this error and provide a solution:\n\n${params.text}`;
      case 'code':
        return `Please refactor or improve this code:\n\n${params.code}`;
      case 'summarize':
        return `Please summarize this content:\n\n${params.text}`;
      case 'classify':
        return `Please classify this content:\n\n${params.text}`;
      case 'git-commit':
        return `Please generate a git commit message for this diff:\n\n${params.diff}`;
      default:
        return `${params.prompt || ''}`;
    }
  }

  abstract chat(prompt: string, context?: AIContext): Promise<AIResult>;
  abstract getModels(): Promise<string[]>;
  abstract validateConfig(): boolean;

  async execute(
    functionType: AIFunctionType,
    params: AIFunctionParams,
    context?: AIContext
  ): Promise<AIResult> {
    const prompt = this.buildPrompt(functionType, params, context);
    return this.chat(prompt, context);
  }
}

/** 解析响应体里的错误信息；各家字段名不同 */
function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null) return fallback;
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  const message = record.message;
  if (typeof message === 'string') return message;
  return fallback;
}

/**
 * OpenAI 兼容协议客户端。
 *
 * 覆盖 openai / ollama / local 三个 provider —— 它们共用同一套
 * /chat/completions 协议，差别只在默认 baseUrl。
 */
class OpenAICompatibleClient extends BaseAIClient {
  protected readonly baseUrl: string;

  constructor(config: AIConfig, fetchImpl: FetchLike, defaultBaseUrl: string) {
    super(config, fetchImpl);
    this.baseUrl = (config.baseUrl ?? defaultBaseUrl).replace(/\/+$/, '');
  }

  protected headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // 本地服务（ollama / local）通常不校验 key，这时不该发一个空的
    // "Bearer " 头过去。
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  async chat(prompt: string, context?: AIContext): Promise<AIResult> {
    const startTime = Date.now();
    try {
      const response = await this.request(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.config.modelName,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(context) },
            { role: 'user', content: prompt },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `AI 服务返回错误（HTTP ${response.status}）：${extractErrorMessage(
            payload,
            response.statusText || '未知错误'
          )}`
        );
      }

      const choices = (payload as { choices?: Array<{ message?: { content?: string } }> })
        .choices;
      const content = choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('AI 服务返回体里没有 choices[0].message.content');
      }

      const usage = (payload as { usage?: { total_tokens?: number } }).usage;
      return {
        success: true,
        content,
        metadata: {
          model: this.config.modelName,
          tokensUsed: usage?.total_tokens,
          latency: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.request(`${this.baseUrl}/models`, {
        headers: this.headers(),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `拉取模型列表失败（HTTP ${response.status}）：${extractErrorMessage(
            payload,
            response.statusText || '未知错误'
          )}`
        );
      }
      const data = (payload as { data?: Array<{ id?: unknown }> }).data;
      if (!Array.isArray(data)) return [];
      return data
        .map((item) => (typeof item?.id === 'string' ? item.id : ''))
        .filter((id) => id.length > 0);
    } catch (error) {
      // 不打印 config —— 里面可能有 apiKey（04 §5.2）。
      console.error(
        'Failed to fetch models:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  validateConfig(): boolean {
    // 本地服务（ollama / local）可以不带 apiKey。
    const needsKey = this.config.provider === 'openai';
    return (
      !!this.config.modelName &&
      (needsKey ? !!this.config.apiKey : true)
    );
  }
}

/** Anthropic Messages API 客户端（provider: 'claude'） */
class AnthropicClient extends BaseAIClient {
  protected readonly baseUrl: string;

  constructor(config: AIConfig, fetchImpl: FetchLike) {
    super(config, fetchImpl);
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  }

  async chat(prompt: string, context?: AIContext): Promise<AIResult> {
    const startTime = Date.now();
    try {
      const system = this.buildSystemPrompt(context);
      // Anthropic 的 system 提示词是独立字段，不放在 messages 里；
      // 且 max_tokens 是必填项，不给会被服务端拒。
      const response = await this.request(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.modelName,
          max_tokens: this.config.maxTokens ?? 1024,
          temperature: this.config.temperature,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `Anthropic API 返回错误（HTTP ${response.status}）：${extractErrorMessage(
            payload,
            response.statusText || '未知错误'
          )}`
        );
      }

      const blocks = (payload as { content?: Array<{ type?: string; text?: string }> })
        .content;
      const content = Array.isArray(blocks)
        ? blocks
            .filter((block) => block?.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text as string)
            .join('')
        : '';
      if (!content) {
        throw new Error('Anthropic API 返回体里没有 content 文本块');
      }

      const usage = (
        payload as { usage?: { input_tokens?: number; output_tokens?: number } }
      ).usage;
      const tokensUsed =
        usage?.input_tokens !== undefined || usage?.output_tokens !== undefined
          ? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)
          : undefined;

      return {
        success: true,
        content,
        metadata: {
          model: this.config.modelName,
          tokensUsed,
          latency: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.request(`${this.baseUrl}/models`, {
        headers: {
          'x-api-key': this.config.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `拉取模型列表失败（HTTP ${response.status}）：${extractErrorMessage(
            payload,
            response.statusText || '未知错误'
          )}`
        );
      }
      const data = (payload as { data?: Array<{ id?: unknown }> }).data;
      if (!Array.isArray(data)) return [];
      return data
        .map((item) => (typeof item?.id === 'string' ? item.id : ''))
        .filter((id) => id.length > 0);
    } catch (error) {
      console.error(
        'Failed to fetch models:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  validateConfig(): boolean {
    return !!this.config.apiKey && !!this.config.modelName;
  }
}

/** Google Gemini 客户端（provider: 'gemini'） */
class GeminiClient extends BaseAIClient {
  protected readonly baseUrl: string;

  constructor(config: AIConfig, fetchImpl: FetchLike) {
    super(config, fetchImpl);
    this.baseUrl = (
      config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');
  }

  async chat(prompt: string, context?: AIContext): Promise<AIResult> {
    const startTime = Date.now();
    try {
      const system = this.buildSystemPrompt(context);
      const response = await this.request(
        `${this.baseUrl}/models/${encodeURIComponent(
          this.config.modelName
        )}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: system }] },
            generationConfig: {
              temperature: this.config.temperature,
              maxOutputTokens: this.config.maxTokens,
            },
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `Gemini API 返回错误（HTTP ${response.status}）：${extractErrorMessage(
            payload,
            response.statusText || '未知错误'
          )}`
        );
      }

      const candidates = (
        payload as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        }
      ).candidates;
      const parts = candidates?.[0]?.content?.parts;
      const content = Array.isArray(parts)
        ? parts
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
        : '';
      if (!content) {
        throw new Error('Gemini API 返回体里没有 candidates[0].content.parts 文本');
      }

      const usage = (
        payload as { usageMetadata?: { totalTokenCount?: number } }
      ).usageMetadata;

      return {
        success: true,
        content,
        metadata: {
          model: this.config.modelName,
          tokensUsed: usage?.totalTokenCount,
          latency: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.request(`${this.baseUrl}/models`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          `拉取模型列表失败（HTTP ${response.status}）：${extractErrorMessage(
            payload,
            response.statusText || '未知错误'
          )}`
        );
      }
      const models = (payload as { models?: Array<{ name?: unknown }> }).models;
      if (!Array.isArray(models)) return [];
      return models
        .map((item) =>
          typeof item?.name === 'string' ? item.name.replace(/^models\//, '') : ''
        )
        .filter((name) => name.length > 0);
    } catch (error) {
      console.error(
        'Failed to fetch models:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  validateConfig(): boolean {
    return !!this.config.apiKey && !!this.config.modelName;
  }
}

/**
 * provider: 'local' 的客户端。
 *
 * 'local' 的含义在仓里从来没被定义过（既可能是 ollama，也可能是
 * LM Studio / vLLM 之类）。这里**不猜默认地址** —— 猜错的话，
 * 请求会打到一个不存在的端口，报出来的错比"没配 baseUrl"难懂得多。
 * 明确要求下游给 baseUrl，是把不确定性摆在明面上。
 */
class LocalClient extends BaseAIClient {
  private readonly delegate: OpenAICompatibleClient | null;

  constructor(config: AIConfig, fetchImpl: FetchLike) {
    super(config, fetchImpl);
    this.delegate = config.baseUrl
      ? new OpenAICompatibleClient(config, fetchImpl, '')
      : null;
  }

  async chat(prompt: string, context?: AIContext): Promise<AIResult> {
    if (!this.delegate) {
      return {
        success: false,
        content: '',
        error:
          "provider 'local' 需要显式配置 baseUrl（例如 http://localhost:11434/v1），" +
          '库不猜测本地服务地址',
      };
    }
    return this.delegate.chat(prompt, context);
  }

  async getModels(): Promise<string[]> {
    if (!this.delegate) return [];
    return this.delegate.getModels();
  }

  validateConfig(): boolean {
    if (!this.config.baseUrl) return false;
    return !!this.config.modelName;
  }
}
/** 各 provider 的默认 baseUrl（公开，便于文档与测试引用） */
export const PROVIDER_DEFAULT_BASE_URL = {
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
  claude: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
} as const;

/**
 * 创建 AI 客户端工厂。
 *
 * 改动要点（01 A-11 / 05 T5.6）：原来除 'openai' 外全部落进 default
 * 分支拿 OpenAIClient；现在每个 provider 有自己的协议实现。
 * `fetchImpl` 只供测试注入，生产走真实 fetch。
 */
export function createClient(config: AIConfig, fetchImpl?: FetchLike): AIClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAICompatibleClient(
        config,
        fetchImpl ?? defaultFetch,
        PROVIDER_DEFAULT_BASE_URL.openai
      );
    case 'ollama':
      return new OpenAICompatibleClient(
        config,
        fetchImpl ?? defaultFetch,
        PROVIDER_DEFAULT_BASE_URL.ollama
      );
    case 'claude':
      return new AnthropicClient(config, fetchImpl ?? defaultFetch);
    case 'gemini':
      return new GeminiClient(config, fetchImpl ?? defaultFetch);
    case 'local':
      return new LocalClient(config, fetchImpl ?? defaultFetch);
    default: {
      // 类型上不该走到这里，但运行时配置可能来自 JSON/环境变量。
      //
      // 明确报错，而不是静默回落成 OpenAI —— 静默回落正是本文件要治的病：
      // 配置写着 A、实际打向 B，调用方永远不知道自己连错了服务。
      throw new Error(
        `未知的 AI provider：${String(config.provider)}。` +
          `支持的取值：${Object.keys(PROVIDER_DEFAULT_BASE_URL).join(' / ')} / local`
      );
    }
  }
}
