// **真实 API 实测**（live test）：用真的 MiniMax 端点跑一遍 shared 的 provider 工厂。
//
// 与 tests/ai-clients.test.ts 的分工：
//   - ai-clients.test.ts：桩 fetch，钉「请求形态对不对」，不碰网络（可进 CI）
//   - **本文件**：真发请求，钉「真连上去能不能跑通」——
//     桩测试恒绿也证明不了服务端认这个协议/这个 key/这个模型。
//
// 跑法：
//   MINIMAX_API_KEY=<key> npm test
//   # 或只跑这一个文件：
//   MINIMAX_API_KEY=<key> node --experimental-strip-types --import ./tests/register-ts-ext.mjs \
//     --test tests/live-minimax.test.ts
//
// **没设 MINIMAX_API_KEY 时整条显式 skip，不静默通过** ——
// 「跳过了」和「跑过了」在报告里必须长得不一样。
//
// 可选环境变量：
//   MINIMAX_BASE_URL —— 覆盖默认端点（自建网关/代理时用）
//   MINIMAX_MODEL    —— 覆盖默认模型
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type AIConfig } from '../src/ai/clients.ts';

const KEY = process.env.MINIMAX_API_KEY;
const BASE_URL = process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1';
const MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-M3.1-Flash';

const skipReason = KEY
  ? undefined
  : '未设置 MINIMAX_API_KEY —— 跳过真实 API 实测（这是「没跑」，不是「跑过了」）';

function liveConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    provider: 'minimax',
    modelName: MODEL,
    apiKey: KEY!,
    baseUrl: BASE_URL,
    ...overrides,
  };
}

test('LIVE-01 minimax 真实端点：对话返回非空内容', { skip: skipReason }, async () => {
  const client = createClient(liveConfig());

  const result = await client.chat('只回两个字：收到');

  assert.equal(
    result.success,
    true,
    `真实调用失败：${result.error ?? '(无 error 字段)'}`
  );
  assert.ok(
    typeof result.content === 'string' && result.content.length > 0,
    '返回内容为空'
  );
  // 钉住「真的走了网络」：延迟不可能是 0
  assert.ok(
    typeof result.metadata?.latency === 'number' && result.metadata.latency > 0,
    `latency 未记录或为 0：${String(result.metadata?.latency)}`
  );
  console.log(
    `  [LIVE-01] model=${MODEL} 内容=${JSON.stringify(result.content.slice(0, 40))} ` +
      `延迟=${result.metadata?.latency}ms tokens=${String(result.metadata?.tokensUsed)}`
  );
});

test('LIVE-02 minimax 真实端点：模型列表能拉到，且含配置里的模型', { skip: skipReason }, async () => {
  const client = createClient(liveConfig());

  const models = await client.getModels();

  assert.ok(models.length > 0, '模型列表为空');
  assert.ok(
    models.includes(MODEL),
    `模型列表里没有配置用的 ${MODEL}；实际拿到 ${models.join(', ')}`
  );
  console.log(`  [LIVE-02] 拉到 ${models.length} 个模型，含 ${MODEL}`);
});

test('LIVE-03 minimax 真实端点：错误的 key 会被服务端拒（不是本地假装成功）', { skip: skipReason }, async () => {
  const client = createClient(liveConfig({ apiKey: 'sk-cp-definitely-invalid-key-for-test' }));

  const result = await client.chat('hi');

  assert.equal(result.success, false, '用假 key 却成功了 —— 判据有问题');
  assert.ok(
    /HTTP\s*(401|403)/.test(result.error ?? ''),
    `期望 401/403，实际错误：${result.error ?? '(无)'}`
  );
  console.log(`  [LIVE-03] 假 key 被拒：${result.error?.slice(0, 80)}`);
});
