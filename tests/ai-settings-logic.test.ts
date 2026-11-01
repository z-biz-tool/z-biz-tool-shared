// 统一 AI 配置面板的**判据**单元测试（无 React、无 DOM、无网络）。
// 跑法：node --experimental-strip-types --test tests/*.test.ts
//
// ## 为什么判据要单独测
//
// 面板的 UI 出问题用户看得见；**判据出问题用户看不见** ——
// 只表现为「某台机器上密钥框该藏没藏」或「本地模型被判成没配好」。
// 后者会直接把用户挡在门外，而界面上没有任何提示说明原因。
//
// 所以每条判据都要有：**正例 + 反例 + 阴性对照**。
// 只测正例的判据等于没测 —— 判据写反时正例照样过。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPresetToDraft,
  draftIsConfigured,
  draftNeedsApiKey,
  emptyDraft,
  findPreset,
  groupPresets,
  presetMayBeStale,
  toDraft,
} from '../src/ai/settings/logic.ts';
import type { PresetView } from '../src/ai/settings/types.ts';

/** 构造一条预设视图。 */
function preset(over: Partial<PresetView> = {}): PresetView {
  return {
    id: 'openai',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    category: 'international',
    category_label: '国际厂商',
    requires_api_key: true,
    aliases: ['openai'],
    verified_on: '2026-10-28',
    ...over,
  };
}

const PRESETS: PresetView[] = [
  preset({ id: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1' }),
  preset({
    id: 'deepseek',
    label: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    category: 'domestic',
    category_label: '国内厂商',
  }),
  preset({
    id: 'ollama',
    label: 'Ollama（本地）',
    base_url: 'http://localhost:11434',
    category: 'self_hosted',
    category_label: '自建 / 本地',
    requires_api_key: false,
  }),
  preset({
    id: 'zbiz-local',
    label: 'zBiz 本地网关',
    base_url: 'http://127.0.0.1:8200/v1',
    category: 'self_hosted',
    category_label: '自建 / 本地',
    requires_api_key: false,
  }),
];

// ─────────────────────────────────────────────────────────────
// 分组
// ─────────────────────────────────────────────────────────────

test('预设按分类分组且保留后端顺序', () => {
  const groups = groupPresets(PRESETS);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].key, 'international');
  assert.equal(groups[0].items[0].id, 'openai');
  assert.equal(groups[1].key, 'domestic');
  assert.equal(groups[2].key, 'self_hosted');
  assert.equal(groups[2].items.length, 2);
});

test('空预设列表分出零组', () => {
  assert.deepEqual(groupPresets([]), []);
});

test('同一分类的预设归到同一组', () => {
  const groups = groupPresets([
    preset({ id: 'a', category: 'domestic' }),
    preset({ id: 'b', category: 'domestic' }),
    preset({ id: 'c', category: 'aggregator' }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].items.length, 1);
});

// ─────────────────────────────────────────────────────────────
// 预设识别：按 host，不按整串
// ─────────────────────────────────────────────────────────────

test('按 host 识别预设而不是整串地址', () => {
  // 同一个服务，尾斜杠与 /v1 后缀不该影响身份
  assert.equal(findPreset(PRESETS, '', 'http://localhost:11434/v1')?.id, 'ollama');
  assert.equal(findPreset(PRESETS, '', 'http://localhost:11434')?.id, 'ollama');
  assert.equal(findPreset(PRESETS, '', 'https://api.deepseek.com/v1/')?.id, 'deepseek');
});

test('预设 id 命中时优先于 host 推断', () => {
  // 用户显式选过 deepseek，但地址被改成了别的地址 —— 仍认 deepseek
  assert.equal(findPreset(PRESETS, 'deepseek', 'https://api.openai.com/v1')?.id, 'deepseek');
});

test('陌生地址不匹配任何预设', () => {
  // 阴性对照：不能瞎认一个
  assert.equal(findPreset(PRESETS, '', 'https://my-proxy.example.com/v1'), undefined);
  assert.equal(findPreset(PRESETS, '', ''), undefined);
});

// ─────────────────────────────────────────────────────────────
// 要不要密钥 —— 与 Rust needs_api_key() 同序
// ─────────────────────────────────────────────────────────────

test('公网厂商要密钥', () => {
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: 'openai', baseUrl: 'https://api.openai.com/v1' }),
    true,
  );
});

test('免密钥预设不要密钥', () => {
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: 'ollama', baseUrl: 'http://localhost:11434' }),
    false,
  );
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: 'zbiz-local', baseUrl: 'http://127.0.0.1:8200/v1' }),
    false,
  );
});

test('预设说要密钥时地址指向本机仍然要密钥', () => {
  // 这条最容易被写反：只判「预设说不免」而不判「预设要说」，
  // 会让「选了 DeepSeek 但把地址指向本机代理」被私网规则救掉，
  // 于是请求发出去、没带鉴权头、拿到 401，而用户完全不知道为什么。
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: 'deepseek', baseUrl: 'http://127.0.0.1:8200/v1' }),
    true,
  );
});

test('自定义服务按地址判定私网免密钥', () => {
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: '', baseUrl: 'http://192.168.1.10:8200/v1' }),
    false,
  );
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: '', baseUrl: 'https://my-proxy.example.com/v1' }),
    true,
  );
});

test('自定义服务填了本机地址时不要密钥', () => {
  // 用户直接粘 mini 的地址（预设表覆盖不到）也要免密钥
  assert.equal(
    draftNeedsApiKey(PRESETS, { preset: '', baseUrl: 'http://127.0.0.1:8200/v1' }),
    false,
  );
});

// ─────────────────────────────────────────────────────────────
// 切换厂商的地址联动
// ─────────────────────────────────────────────────────────────

test('选厂商时地址跟着换成预设地址', () => {
  const draft = { ...emptyDraft(), baseUrl: 'https://my-old-proxy/v1' };
  const next = applyPresetToDraft(draft, PRESETS, 'deepseek');
  assert.equal(next.preset, 'deepseek');
  assert.equal(next.baseUrl, 'https://api.deepseek.com/v1');
});

test('选自定义时保留用户已填的地址', () => {
  const draft = { ...emptyDraft(), baseUrl: 'http://192.168.1.10:8200/v1' };
  const next = applyPresetToDraft(draft, PRESETS, '');
  assert.equal(next.preset, '');
  assert.equal(next.baseUrl, 'http://192.168.1.10:8200/v1');
});

test('切换厂商不动模型名', () => {
  // 模型名不在预设里（半年一换代），切厂商时不该动它
  const draft = { ...emptyDraft(), model: 'my-model' };
  const next = applyPresetToDraft(draft, PRESETS, 'deepseek');
  assert.equal(next.model, 'my-model');
});

test('选了不存在的预设退回自定义', () => {
  const draft = { ...emptyDraft(), baseUrl: 'http://x/v1' };
  const next = applyPresetToDraft(draft, PRESETS, 'no-such-preset');
  assert.equal(next.preset, '');
  assert.equal(next.baseUrl, 'http://x/v1');
});

// ─────────────────────────────────────────────────────────────
// 是不是配好了
// ─────────────────────────────────────────────────────────────

test('没填模型名不算配置好', () => {
  const d = { ...emptyDraft(), preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x' };
  assert.equal(draftIsConfigured(PRESETS, d), false);
});

test('要密钥的服务填了密钥就算配置好', () => {
  const d = {
    ...emptyDraft(),
    preset: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5',
    apiKey: 'sk-x',
  };
  assert.equal(draftIsConfigured(PRESETS, d), true);
});

test('要密钥的服务后端说已存过密钥也算配置好', () => {
  const d = {
    ...emptyDraft(),
    preset: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5',
    apiKey: '',
  };
  assert.equal(draftIsConfigured(PRESETS, d, true), true);
  assert.equal(draftIsConfigured(PRESETS, d, false), false);
});

test('免密钥服务不用填密钥就算配置好', () => {
  const d = {
    ...emptyDraft(),
    preset: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen3',
    apiKey: '',
  };
  assert.equal(draftIsConfigured(PRESETS, d, false), true);
});

// ─────────────────────────────────────────────────────────────
// 后端配置 → 草稿
// ─────────────────────────────────────────────────────────────

test('后端配置转草稿时密钥恒为空串', () => {
  // 安全约束：面板永远不显示已保存的密钥
  const d = toDraft({ preset: 'openai', baseUrl: 'https://x/v1', model: 'm' });
  assert.equal(d.apiKey, '');
});

test('后端配置的两种命名都能读', () => {
  const camel = toDraft({ baseUrl: 'https://x/v1', maxTokens: 100, timeoutMs: 2000 });
  assert.equal(camel.baseUrl, 'https://x/v1');
  assert.equal(camel.maxTokens, 100);
  assert.equal(camel.timeoutMs, 2000);

  const snake = toDraft({ base_url: 'https://y/v1', max_tokens: 200, timeout_ms: 3000 });
  assert.equal(snake.baseUrl, 'https://y/v1');
  assert.equal(snake.maxTokens, 200);
  assert.equal(snake.timeoutMs, 3000);
});

test('preset 缺省时退回 provider', () => {
  const d = toDraft({ provider: 'deepseek' });
  assert.equal(d.preset, 'deepseek');
});

// ─────────────────────────────────────────────────────────────
// 过期判定
// ─────────────────────────────────────────────────────────────

test('半年前的预设标为可能已过期', () => {
  const now = new Date('2026-11-01');
  assert.equal(presetMayBeStale('2026-04-01', now), true);
});

test('近期的预设不算过期', () => {
  const now = new Date('2026-11-01');
  assert.equal(presetMayBeStale('2026-10-28', now), false);
});

test('没有核对日期的预设不算过期', () => {
  // 没核对过 ≠ 过期 —— 缺字段只是信息缺失，不该报警
  const now = new Date('2026-11-01');
  assert.equal(presetMayBeStale('', now), false);
  assert.equal(presetMayBeStale('bad-date', now), false);
});
