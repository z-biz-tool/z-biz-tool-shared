// AI 客户端与 provider 工厂的单元测试（无 React、无 DOM、无真实网络）
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// 对应 06 验收矩阵：UT-AI-01 / UT-AI-02 / UT-AI-03。
//
// **不发真实请求**：所有 fetch 都被替换成注入的桩（06 §1.1 的
// 「无真实网络」铁律）。桩同时记录收到的 URL / headers / body，
// 这样断言的是"这个 provider 真的按自己的协议发了请求"，
// 而不是只看返回结果 —— 后者分不出「走了真分支」和「静默落进 OpenAI」。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createClient,
  DEFAULT_TIMEOUT_MS,
  PROVIDER_DEFAULT_BASE_URL,
  type AIClientResponse,
  type FetchLike,
} from '../src/ai/clients.ts';
import { useAIManager, setFetchImplementation } from '../src/ai/AIManager.ts';

/** 记录一次请求的桩 fetch */
interface Recorded {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

function stubFetch(
  payload: unknown,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): { fetch: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const response: AIClientResponse = {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      statusText: options.statusText ?? 'OK',
      json: async () => payload,
    };
    return response;
  };
  return { fetch: fetchImpl, calls };
}

const OPENAI_OK = {
  choices: [{ message: { content: 'hello from openai' } }],
  usage: { total_tokens: 42 },
};

// ---------------------------------------------------------------- UT-AI-03
// provider 工厂：此前 claude/gemini/ollama/local 全部落进 default 分支
// 拿 OpenAIClient（01 A-11）。这一组用例钉住"每个 provider 走自己的协议"。

test("UT-AI-03 provider=openai 走 OpenAI 协议", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient(
    { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'sk-test' },
    fetch
  );

  const result = await client.chat('hi');

  assert.equal(result.success, true);
  assert.equal(result.content, 'hello from openai');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(calls[0].init?.headers?.['Authorization'], 'Bearer sk-test');
  const body = JSON.parse(calls[0].init?.body ?? '{}');
  assert.equal(body.model, 'gpt-4o-mini');
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[0].role, 'system');
});

test("UT-AI-03 provider=claude 走 Anthropic 协议（不是 OpenAI）", async () => {
  const { fetch, calls } = stubFetch({
    content: [{ type: 'text', text: 'hello from claude' }],
    usage: { input_tokens: 10, output_tokens: 5 },
  });

  const client = createClient(
    { provider: 'claude', modelName: 'claude-sonnet-4', apiKey: 'ant-test' },
    fetch
  );
  const result = await client.chat('hi');

  assert.equal(result.success, true);
  assert.equal(result.content, 'hello from claude');
  // 端点必须是 Anthropic 的
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  // 鉴权头不是 Bearer
  assert.equal(calls[0].init?.headers?.['x-api-key'], 'ant-test');
  assert.equal(calls[0].init?.headers?.['Authorization'], undefined);
  // system 提示词是独立字段，不混在 messages 里
  const body = JSON.parse(calls[0].init?.body ?? '{}');
  assert.equal(body.system, 'You are a helpful assistant.');
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, 'user');
  // max_tokens 是 Anthropic 的必填项
  assert.equal(typeof body.max_tokens, 'number');
  // token 计数是两个字段相加
  assert.equal(result.metadata?.tokensUsed, 15);
});

test("UT-AI-03 provider=gemini 走 Gemini 协议（不是 OpenAI）", async () => {
  const { fetch, calls } = stubFetch({
    candidates: [{ content: { parts: [{ text: 'hello from gemini' }] } }],
    usageMetadata: { totalTokenCount: 7 },
  });

  const client = createClient(
    { provider: 'gemini', modelName: 'gemini-2.0-flash', apiKey: 'gm-test' },
    fetch
  );
  const result = await client.chat('hi');

  assert.equal(result.success, true);
  assert.equal(result.content, 'hello from gemini');
  assert.equal(
    calls[0].url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
  );
  const body = JSON.parse(calls[0].init?.body ?? '{}');
  // Gemini 用 contents/parts，不是 messages
  assert.equal(body.contents.length, 1);
  assert.equal(body.contents[0].parts[0].text, 'hi');
  assert.equal(body.systemInstruction.parts[0].text, 'You are a helpful assistant.');
  assert.equal(result.metadata?.tokensUsed, 7);
});

test("UT-AI-03 provider=ollama 用本地默认地址，且不强制要 apiKey", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient(
    { provider: 'ollama', modelName: 'llama3' },
    fetch
  );

  const result = await client.chat('hi');

  assert.equal(result.success, true);
  // 期望值写**字面量**，不引用 PROVIDER_DEFAULT_BASE_URL.ollama ——
  // 引用被测常量本身的话，常量一改期望值跟着改，判据恒绿
  // （第一版就是这么写的，被「ollama 默认地址改错」的变异当场放跑）。
  assert.equal(calls[0].url, 'http://localhost:11434/v1/chat/completions');
  // 本地服务不校验 key，不该发空的 Bearer 头
  assert.equal(calls[0].init?.headers?.['Authorization'], undefined);
  assert.equal(client.validateConfig(), true);
});

// ------------------------------------------------------------ UT-AI-04
// provider=minimax（2026-10-20 新增）
//
// MiniMax 开放平台是 **OpenAI 兼容**的：请求形态与 openai 同构，
// 差别在默认 baseUrl（api.minimaxi.com/v1）。
// 这一组用例钉两件事：
//   ① 写 minimax 就真的打 minimax 端点（不是静默落进 api.openai.com）；
//   ② 协议形态确实与 OpenAI 同构（messages/model/Bearer 三件套）。

test("UT-AI-04 provider=minimax 打 MiniMax 端点，不落进 api.openai.com", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient(
    { provider: 'minimax', modelName: 'MiniMax-M3.1-Flash', apiKey: 'sk-cp-test' },
    fetch
  );

  const result = await client.chat('hi');

  assert.equal(result.success, true);
  assert.equal(result.content, 'hello from openai');
  assert.equal(calls.length, 1);
  // 字面量，不用 PROVIDER_DEFAULT_BASE_URL.minimax —— 同上，常量自引用会恒绿
  assert.equal(calls[0].url, 'https://api.minimaxi.com/v1/chat/completions');
  assert.equal(calls[0].init?.headers?.['Authorization'], 'Bearer sk-cp-test');
  const body = JSON.parse(calls[0].init?.body ?? '{}');
  assert.equal(body.model, 'MiniMax-M3.1-Flash');
  // 协议形态与 OpenAI 同构：system 独立一条 + messages 数组
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].role, 'user');
});

test("UT-AI-04 provider=minimax 支持自定义 baseUrl 覆盖（代理/私有化部署）", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient(
    {
      provider: 'minimax',
      modelName: 'MiniMax-M3',
      apiKey: 'k',
      baseUrl: 'https://gateway.internal/v1/',
    },
    fetch
  );
  await client.chat('hi');
  // 结尾斜杠要被去掉，否则拼出 //chat/completions
  assert.equal(calls[0].url, 'https://gateway.internal/v1/chat/completions');
});

test("UT-AI-04 provider=minimax 的 getModels 走 /models 端点", async () => {
  const { fetch, calls } = stubFetch({
    data: [{ id: 'MiniMax-M3.1-Flash' }, { id: 'MiniMax-M3' }],
  });
  const client = createClient(
    { provider: 'minimax', modelName: 'MiniMax-M3.1-Flash', apiKey: 'k' },
    fetch
  );

  const models = await client.getModels();

  assert.deepEqual(models, ['MiniMax-M3.1-Flash', 'MiniMax-M3']);
  assert.equal(calls[0].url, 'https://api.minimaxi.com/v1/models');
});

test("UT-AI-03 provider=local 没给 baseUrl 时明确报错，不静默打 localhost", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient({ provider: 'local', modelName: 'my-model' }, fetch);

  const result = await client.chat('hi');

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /baseUrl/);
  // 关键：没有发任何请求
  assert.equal(calls.length, 0);
  assert.equal(client.validateConfig(), false);
});

test("UT-AI-03 provider=local 给了 baseUrl 就按 OpenAI 兼容协议发", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient(
    { provider: 'local', modelName: 'my-model', baseUrl: 'http://127.0.0.1:8080/v1' },
    fetch
  );

  const result = await client.chat('hi');

  assert.equal(result.success, true);
  assert.equal(calls[0].url, 'http://127.0.0.1:8080/v1/chat/completions');
  assert.equal(client.validateConfig(), true);
});

test("UT-AI-03 未知 provider 明确报错，不静默回落成 OpenAI", () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  assert.throws(
    () =>
      createClient(
        { provider: 'not-a-provider' as never, modelName: 'x' },
        fetch
      ),
    /未知的 AI provider/
  );
  assert.equal(calls.length, 0);
});

test("UT-AI-03 自定义 baseUrl 覆盖各 provider 的默认地址", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const client = createClient(
    {
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'k',
      baseUrl: 'https://proxy.example.com/v1/',
    },
    fetch
  );
  await client.chat('hi');
  // 末尾斜杠被去掉，否则会拼出 //chat/completions
  assert.equal(calls[0].url, 'https://proxy.example.com/v1/chat/completions');
});

test("UT-AI-03 默认 baseUrl 常量表本身是对的（防止被测常量被悄悄改掉）", () => {
  // 上面的用例全部改用**字面量**断言 URL，正是因为引用
  // PROVIDER_DEFAULT_BASE_URL.xxx 的话，常量一改期望值跟着改 ⇒ 判据恒绿。
  // 这条用例把常量表本身钉死，让「改常量」这件事必须被显式地改在这里。
  assert.deepEqual(PROVIDER_DEFAULT_BASE_URL, {
    openai: 'https://api.openai.com/v1',
    ollama: 'http://localhost:11434/v1',
    claude: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    // 2026-10-20 新增 MiniMax（OpenAI 兼容）。加 provider 时**必须同步改这一条** ——
    // 这条用例的作用就是「改常量表必须显式地改在这里」，漏改就会红。
    minimax: 'https://api.minimaxi.com/v1',
  });
});

// ---------------------------------------------------------------- UT-AI-01
// executeAI：成功 → success=true；失败 → error 有值、不抛异常。

test("UT-AI-01 executeAI 成功时返回内容", async () => {
  const { fetch } = stubFetch(OPENAI_OK);
  // 用注入点而不是猴补 globalThis.fetch：不碰全局状态，别的测试文件不受影响
  const restore = setFetchImplementation(fetch);
  try {
    useAIManager.setState({
      config: { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'sk-test' },
      context: {},
    });

    const result = await useAIManager.getState().executeAI('chat', { prompt: 'hi' });

    assert.equal(result.success, true);
    assert.equal(result.content, 'hello from openai');
    assert.equal(result.metadata?.tokensUsed, 42);
  } finally {
    restore();
  }
});

test("UT-AI-01 executeAI 遇到 HTTP 错误时返回 error 而不是抛出", async () => {
  const { fetch } = stubFetch(
    { error: { message: 'quota exceeded' } },
    { ok: false, status: 429, statusText: 'Too Many Requests' }
  );
  const restore = setFetchImplementation(fetch);
  try {
    useAIManager.setState({
      config: { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'sk-test' },
      context: {},
    });

    const result = await useAIManager.getState().executeAI('chat', { prompt: 'hi' });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /429/);
    assert.match(result.error ?? '', /quota exceeded/);
  } finally {
    restore();
  }
});

test("UT-AI-01 executeAI 遇到未知 provider 时不抛出，error 有值", async () => {
  // 必须注入 fetch 桩：**基线下**这条用例靠工厂 throw 提前退出，走不到网络；
  // 但一旦「未知 provider 静默回落成 OpenAI」的变异发生，它就会真的去请求
  // api.openai.com —— 变异跑批时这条用例因此挂了 10 秒才超时。
  // 注入桩让变异下的行为也保持确定（立刻拿到响应，而不是等网络超时）。
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const restore = setFetchImplementation(fetch);
  try {
    useAIManager.setState({
      config: { provider: 'nope' as never, modelName: 'x' },
      context: {},
    });

    const result = await useAIManager.getState().executeAI('chat', { prompt: 'hi' });

    assert.equal(result.success, false);
    assert.match(result.error ?? '', /未知的 AI provider/);
    // 未知 provider 不该发出任何请求
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------- UT-AI-02
// updateConfig / setContext。

test("UT-AI-02 updateConfig 只覆盖传入的字段，其余保留", () => {
  useAIManager.setState({
    config: { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'sk-test' },
    context: {},
  });

  useAIManager.getState().updateConfig({ modelName: 'gpt-4o' });

  const config = useAIManager.getState().config;
  assert.equal(config.modelName, 'gpt-4o');
  assert.equal(config.provider, 'openai');
  assert.equal(config.apiKey, 'sk-test');
});

test("UT-AI-02 setContext 整体覆盖 context", () => {
  useAIManager.setState({ context: { currentLanguage: 'rust' } });
  useAIManager.getState().setContext({ files: ['a.ts'] });

  const context = useAIManager.getState().context;
  assert.deepEqual(context, { files: ['a.ts'] });
  assert.equal(context.currentLanguage, undefined);
});

// ------------------------------------------------- A-10：timeout 真正生效
// AIConfig.timeout 此前声明了却从不生效（01 A-10）。

test("A-10 timeout 会真的中断挂住的请求", async () => {
  // 一个永远不 resolve 的 fetch，只有 AbortController 能把它打断
  const fetchImpl: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const client = createClient(
    {
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-test',
      timeout: 30,
    },
    fetchImpl
  );

  const result = await client.chat('hi');

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /超时/);
  assert.match(result.error ?? '', /30ms/);
});

test("A-10 timeout 未配置时用默认上限", async () => {
  let seenSignal: AbortSignal | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    seenSignal = init?.signal;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => OPENAI_OK,
    };
  };

  const client = createClient(
    { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'sk-test' },
    fetchImpl
  );
  await client.chat('hi');

  // 请求确实带上了 AbortSignal —— 此前根本没有
  assert.ok(seenSignal, 'fetch 必须收到 AbortSignal');
  assert.equal(DEFAULT_TIMEOUT_MS, 30000);
});

test("A-10 timeout <= 0 表示不设上限（不注入 signal）", async () => {
  let seenSignal: AbortSignal | undefined | 'none' = 'none';
  const fetchImpl: FetchLike = async (_url, init) => {
    seenSignal = init?.signal;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => OPENAI_OK,
    };
  };

  const client = createClient(
    { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'k', timeout: 0 },
    fetchImpl
  );
  await client.chat('hi');

  assert.equal(seenSignal, undefined);
});

// ------------------------------------------------- executeWithAgent 语义
// 此前这里把 provider 硬编码成 'local'，而工厂对 'local' 也落进 default
// 分支返回 OpenAIClient —— "用 Agent 自己的模型"实际是"用 OpenAI 的端点
// + Agent 的模型名"，模型多半对不上，必然失败。

test("executeWithAgent 用 Agent 的模型名，但沿用全局 provider", async () => {
  const { fetch, calls } = stubFetch(OPENAI_OK);
  const restore = setFetchImplementation(fetch);
  try {
    useAIManager.setState({
      config: { provider: 'openai', modelName: 'gpt-4o-mini', apiKey: 'sk-test' },
      context: {},
      agents: [
        {
          id: 'a1',
          name: 'SQL Agent',
          role: '分析',
          systemPrompt: '',
          model: 'gpt-4o',
          status: 'idle',
        },
      ],
    });

    const result = await useAIManager.getState().executeWithAgent('a1', 'chat', {
      prompt: 'hi',
    });

    assert.equal(result.success, true);
    const body = JSON.parse(calls[0].init?.body ?? '{}');
    assert.equal(body.model, 'gpt-4o');
    // provider 没被改写成 'local'：打的是 OpenAI 端点
    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
  } finally {
    restore();
  }
});

test("executeWithAgent 找不到 agent 时返回错误而不是抛异常", async () => {
  useAIManager.setState({ agents: [] });
  const result = await useAIManager.getState().executeWithAgent('nope', 'chat', {
    prompt: 'hi',
  });
  assert.equal(result.success, false);
  assert.match(result.error ?? '', /not found/);
});
