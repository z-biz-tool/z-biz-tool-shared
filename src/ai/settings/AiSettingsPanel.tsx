/**
 * 家族统一的 AI 配置面板。
 *
 * ## 交互模型抄的是 CC Switch
 *
 * 原来十个仓各画各的面板，用户的体验是：
 * 打开设置 → 找「服务商」下拉 → 在 18 个选项里翻 → 填地址 → 填模型 → 填 Key。
 * 每一步都要用户自己判断该填什么。
 *
 * CC Switch 的做法反过来了：**卡片墙 + 选完只填 Key**。
 *
 * ```text
 * ┌─ 三条路 ─────────────────────────────────────────┐
 * │  ① 官方账号    │  ② 第三方 API Key  │  ③ 本地免费  │
 * └──────────────────────────────────────────────────┘
 * ┌─ 厂商卡片墙（分组折叠，18 家一眼可见）───────────┐
 * │  国际厂商   [OpenAI] [Anthropic] [Google Gemini] │
 * │  国内厂商   [DeepSeek] [通义千问] [Kimi] [智谱]…  │
 * │  聚合平台   [SiliconFlow] [OpenRouter] [Groq]     │
 * │  自建/本地  [Ollama] [zBiz 本地网关]              │
 * └──────────────────────────────────────────────────┘
 * ┌─ 选中后只需填两样 ────────────────────────────────┐
 * │  API Key（免密钥的厂商这一栏整个消失）            │
 * │  模型（可一键从服务端拉取）                        │
 * └──────────────────────────────────────────────────┘
 * ```
 *
 * 三个关键取舍：
 *
 * 1. **卡片墙而不是下拉**。18 家的下拉要滚动两屏；而卡片墙能一眼扫完，
 *    而且能顺带显示「免密钥」「可能已过期」这类徽标。
 * 2. **免密钥的厂商不显示密钥框**。判据走 `draftNeedsApiKey()`，
 *    它是 Rust `needs_api_key()` 的镜像 —— 本地模型用户不该被问「请填 API Key」。
 * 3. **地址默认折叠**。选了厂商就不用管地址；要改自建代理才展开。
 *    地址只存在于「高级」里，就不会有人手抄错一个字符。
 *
 * ## 不回显已保存的密钥
 *
 * 后端只回「有没有密钥」这个布尔，面板**永远不显示**密钥明文。
 * 留空 = 不修改；想删就点「删除已保存的密钥」。
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ApiOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  GlobalOutlined,
  KeyOutlined,
  LaptopOutlined,
  ReloadOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  applyPresetToDraft,
  draftIsConfigured,
  draftNeedsApiKey,
  emptyDraft,
  findPreset,
  groupPresets,
  presetMayBeStale,
  toDraft,
} from "./logic";
import type {
  AiConfigDraft,
  AiSettingsActions,
  AiSettingsLabels,
  AiSettingsPanelProps,
  LlmFailure,
  PresetView,
} from "./types";

const { Text, Paragraph } = Typography;

const DEFAULT_LABELS: AiSettingsLabels = {
  title: "AI 配置",
  provider: "选择服务商",
  providerPlaceholder: "选择一家服务商",
  custom: "自定义（OpenAI 兼容 / 自建代理）",
  apiKey: "API Key",
  apiKeyPlaceholder: "粘贴服务商后台生成的 API Key",
  apiKeySaved: "已保存密钥（不回显）",
  apiKeyMissing: "尚未填写密钥",
  model: "模型",
  modelPlaceholder: "选择或直接输入模型名",
  fetchModels: "获取模型列表",
  fetching: "获取中…",
  test: "测试连接",
  testing: "测试中…",
  save: "保存",
  saving: "保存中…",
  saved: "已保存。所有兄弟应用立即生效。",
  advanced: "高级设置",
  baseUrl: "Base URL",
  temperature: "温度",
  maxTokens: "最大 Token",
  timeout: "超时（毫秒）",
  noKeyNeeded: "该服务无需 API Key",
  verifiedOn: "地址核对于",
  keyOnlyLocal: "密钥只保存在本机系统密钥库，不会上传到任何服务器",
  deleteKey: "删除已保存的密钥",
  reload: "重新读取",
};

/** 分类 → 图标与配色。三条路的视觉区分是 CC Switch 最有效的那个细节。 */
function categoryMeta(category: string): {
  icon: React.ReactNode;
  tone: string;
  hint: string;
} {
  switch (category) {
    case "international":
      return {
        icon: <GlobalOutlined />,
        tone: "blue",
        hint: "海外官方厂商，通常需要海外网络与信用卡",
      };
    case "domestic":
      return {
        icon: <ThunderboltOutlined />,
        tone: "volcano",
        hint: "国内官方厂商，直连速度快，支持国产模型",
      };
    case "aggregator":
      return {
        icon: <ApiOutlined />,
        tone: "purple",
        hint: "聚合平台，一个密钥调多家模型",
      };
    case "self_hosted":
      return {
        icon: <LaptopOutlined />,
        tone: "green",
        hint: "本地或自建服务，无需密钥、不产生费用",
      };
    default:
      return { icon: <ApiOutlined />, tone: "default", hint: "" };
  }
}

export function AiSettingsPanel(props: AiSettingsPanelProps) {
  const { actions, hasApiKey = false, onSaved } = props;
  const labels: AiSettingsLabels = { ...DEFAULT_LABELS, ...(props.labels ?? {}) };

  const [draft, setDraft] = useState<AiConfigDraft>(() => ({
    ...emptyDraft(),
    ...toDraft(props.value ?? {}),
  }));
  const [presets, setPresets] = useState<PresetView[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<LlmFailure | null>(null);
  const [okText, setOkText] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 预设从后端取（单一事实源在 cap-llm::presets）。
  // 拿不到就留空，界面退回「自定义」手填地址 —— 不假装「一家服务商都没有」。
  const loadPresets = useCallback(async () => {
    setLoadingPresets(true);
    try {
      const list = await actions.listPresets();
      setPresets(Array.isArray(list) ? list : []);
    } catch {
      setPresets([]);
    } finally {
      setLoadingPresets(false);
    }
  }, [actions]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  // 外部配置变化时同步（各仓在保存后回读）
  useEffect(() => {
    if (!props.value) return;
    setDraft((d) => ({ ...d, ...toDraft(props.value as never) }));
  }, [props.value]);

  const currentPreset = useMemo(
    () => findPreset(presets, draft.preset, draft.baseUrl),
    [presets, draft.preset, draft.baseUrl],
  );
  const needsKey = useMemo(
    () => draftNeedsApiKey(presets, draft),
    [presets, draft],
  );
  const configured = useMemo(
    () => draftIsConfigured(presets, draft, hasApiKey),
    [presets, draft, hasApiKey],
  );
  const groups = useMemo(() => groupPresets(presets), [presets]);

  const pick = (presetId: string) => {
    setFailure(null);
    setOkText(null);
    setModels([]);
    setDraft((d) => applyPresetToDraft(d, presets, presetId));
    // 自定义才需要展开地址区 —— 选了厂商就不用管地址
    setAdvancedOpen(!presetId);
  };

  const fetchModels = async () => {
    setFetchingModels(true);
    setFailure(null);
    setOkText(null);
    try {
      const list = await actions.listModels(draft);
      const arr = Array.isArray(list) ? list : [];
      setModels(arr);
      if (arr.length === 0) {
        setFailure({
          kind: "notConfigured",
          status: null,
          message: "服务端没有返回任何模型",
          hint: "该服务可能不实现 /models 接口，请手动填写模型名",
          focus: "model",
        });
        return;
      }
      if (!draft.model.trim()) setDraft((d) => ({ ...d, model: arr[0] }));
    } catch (e) {
      setFailure(toFailure(e));
    } finally {
      setFetchingModels(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setFailure(null);
    setOkText(null);
    try {
      const r = await actions.testConnection(draft);
      if (!r.ok) {
        setFailure(
          r.failure ?? {
            kind: "http",
            status: null,
            message: "连接失败",
            hint: "",
            focus: "none",
          },
        );
        return;
      }
      setOkText(r.detail || "连接正常");
    } catch (e) {
      setFailure(toFailure(e));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setFailure(null);
    setOkText(null);
    try {
      const ok = await actions.save(draft);
      if (!ok) {
        setFailure({
          kind: "io",
          status: null,
          message: "保存失败",
          hint: "请检查本机是否有写权限，或系统密钥库是否可用",
          focus: "none",
        });
        return;
      }
      setDraft((d) => ({ ...d, apiKey: "" }));
      setOkText(labels.saved);
      onSaved?.();
    } catch (e) {
      setFailure(toFailure(e));
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = useMemo(() => models.map((m) => ({ value: m })), [models]);

  return (
    <div className="zllm-panel" data-testid="ai-settings-panel">
      <style>{PANEL_CSS}</style>

      {/* ── 顶部：三路分流 ────────────────────────────────────────── */}
      <Alert
        type="info"
        showIcon
        message="一次配置，全家通用"
        description={
          <Space size={16} wrap style={{ marginTop: 4 }}>
            <span>① 选一家服务商</span>
            <span>② 填 API Key（本地服务免填）</span>
            <span>③ 保存即生效</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              保存后所有兄弟应用（笔记 / 终端 / 文件 / 数据库 / 知识库…）立即共用这一份配置
            </Text>
          </Space>
        }
      />

      {/* ── 厂商卡片墙 ────────────────────────────────────────────── */}
      <div className="zllm-section">
        <div className="zllm-section-head">
          <Text strong>{labels.provider}</Text>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => void loadPresets()}
            loading={loadingPresets}
          >
            {labels.reload}
          </Button>
        </div>

        {loadingPresets && presets.length === 0 ? (
          <div className="zllm-center">
            <Spin size="small" />
          </div>
        ) : groups.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="读取不到服务商列表"
            description="可能后端未就绪。你仍然可以在下面选「自定义」手动填写地址。"
          />
        ) : (
          <div className="zllm-groups">
            {groups.map((g) => {
              const meta = categoryMeta(g.key);
              return (
                <div key={g.key} className="zllm-group">
                  <div className="zllm-group-head">
                    <span className={`zllm-group-icon zllm-tone-${meta.tone}`}>{meta.icon}</span>
                    <Text strong>{g.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {meta.hint}
                    </Text>
                  </div>
                  <div className="zllm-cards">
                    {g.items.map((p) => {
                      const active = currentPreset?.id === p.id;
                      const stale = presetMayBeStale(p.verified_on);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          className={`zllm-card${active ? " active" : ""}`}
                          onClick={() => pick(p.id)}
                          aria-pressed={active}
                        >
                          <span className="zllm-card-name">{p.label}</span>
                          <span className="zllm-card-tags">
                            {!p.requires_api_key && (
                              <Tag color="green" style={{ margin: 0 }}>
                                免密钥
                              </Tag>
                            )}
                            {stale && (
                              <Tooltip title={`地址核对于 ${p.verified_on}，超过半年未复核，可能已变更`}>
                                <Tag color="orange" style={{ margin: 0 }}>
                                  <WarningOutlined /> 可能已过期
                                </Tag>
                              </Tooltip>
                            )}
                            {active && (
                              <Tag color="blue" style={{ margin: 0 }}>
                                <CheckCircleFilled /> 已选
                              </Tag>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Divider style={{ margin: "12px 0" }} />

        <Space wrap>
          <Button
            type={draft.preset ? "default" : "primary"}
            onClick={() => pick("")}
            icon={<ApiOutlined />}
          >
            {labels.custom}
          </Button>
          {!currentPreset && draft.baseUrl.trim() && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前使用自定义地址：{draft.baseUrl}
            </Text>
          )}
        </Space>
      </div>

      {/* ── 密钥 + 模型 ──────────────────────────────────────────── */}
      <div className="zllm-section">
        <Form layout="vertical">
          {/* 密钥：免密钥的服务整个不显示这一栏 */}
          {needsKey ? (
            <Form.Item
              label={
                <Space size={6}>
                  <KeyOutlined />
                  <span>{labels.apiKey}</span>
                  {hasApiKey && (
                    <Tag color="green" style={{ margin: 0 }}>
                      {labels.apiKeySaved}
                    </Tag>
                  )}
                </Space>
              }
              extra={
                <Space direction="vertical" size={2} style={{ width: "100%" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {labels.keyOnlyLocal}
                  </Text>
                  {hasApiKey && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      留空表示保持原密钥不变。
                    </Text>
                  )}
                </Space>
              }
            >
              <Space.Compact style={{ width: "100%" }}>
                <Input.Password
                  value={draft.apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    hasApiKey
                      ? "留空则保持原密钥不变"
                      : labels.apiKeyPlaceholder
                  }
                  onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                />
                {hasApiKey && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setDraft((d) => ({ ...d, apiKey: "" }));
                      message.info("清空后保存即可删除已保存的密钥");
                    }}
                  >
                    {labels.deleteKey}
                  </Button>
                )}
              </Space.Compact>
            </Form.Item>
          ) : (
            <Alert
              type="success"
              showIcon
              icon={<LaptopOutlined />}
              message={labels.noKeyNeeded}
              description={
                currentPreset ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {currentPreset.label} 运行在本机或你的内网，直接用即可 —— 不会有密钥框。
                  </Text>
                ) : undefined
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 模型 */}
          <Form.Item
            label={labels.model}
            extra={
              currentPreset ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  模型名不在预设里 —— 各家模型半年换代，写死必过期。
                  {draft.model.trim() && ` 当前填的是 ${draft.model}，若不属于 ${currentPreset.label} 请点右侧重选。`}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  自建代理常常不实现 /models 接口，允许直接手填。
                </Text>
              )
            }
          >
            <Space.Compact style={{ width: "100%" }}>
              <AutoComplete
                style={{ flex: 1 }}
                value={draft.model}
                options={modelOptions}
                placeholder={labels.modelPlaceholder}
                onChange={(v) => setDraft((d) => ({ ...d, model: v }))}
                filterOption={(input, option) =>
                  String(option?.value ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
              <Button
                icon={<ReloadOutlined />}
                loading={fetchingModels}
                disabled={needsKey && !draft.apiKey.trim() && !hasApiKey}
                title={
                  needsKey && !draft.apiKey.trim() && !hasApiKey
                    ? "先填写 API Key 才能获取该服务商的模型列表"
                    : "从服务商读取可用模型"
                }
                onClick={() => void fetchModels()}
              >
                {fetchingModels ? labels.fetching : labels.fetchModels}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>

        {/* 高级：地址 + 采样参数 */}
        <Collapse
          activeKey={advancedOpen ? ["adv"] : []}
          onChange={(k) => setAdvancedOpen((k as string[]).length > 0)}
          size="small"
          items={[
            {
              key: "adv",
              label: labels.advanced,
              children: (
                <Form layout="vertical">
                  <Form.Item
                    label={labels.baseUrl}
                    extra={
                      currentPreset ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          已按 {currentPreset.label} 标准值填好（{labels.verifiedOn}{" "}
                          {currentPreset.verified_on}）。
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          自定义服务需要填兼容 OpenAI 协议的完整地址。
                        </Text>
                      )
                    }
                  >
                    <Input
                      value={draft.baseUrl}
                      placeholder="https://api.openai.com/v1"
                      onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                    />
                  </Form.Item>
                  <Space size={12} wrap>
                    <Form.Item label={labels.temperature} style={{ marginBottom: 0 }}>
                      <InputNumber
                        min={0}
                        max={2}
                        step={0.1}
                        value={draft.temperature}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, temperature: v ?? undefined }))
                        }
                      />
                    </Form.Item>
                    <Form.Item label={labels.maxTokens} style={{ marginBottom: 0 }}>
                      <InputNumber
                        min={1}
                        value={draft.maxTokens}
                        onChange={(v) => setDraft((d) => ({ ...d, maxTokens: v ?? undefined }))}
                      />
                    </Form.Item>
                    <Form.Item label={labels.timeout} style={{ marginBottom: 0 }}>
                      <InputNumber
                        min={1000}
                        step={1000}
                        value={draft.timeoutMs}
                        onChange={(v) => setDraft((d) => ({ ...d, timeoutMs: v ?? undefined }))}
                      />
                    </Form.Item>
                  </Space>
                </Form>
              ),
            },
          ]}
        />
      </div>

      {/* ── 结构化失败：一句「为什么」+ 一个能点的动作 ─────────────── */}
      {failure && (
        <Alert
          type="error"
          showIcon
          message={failure.message}
          description={
            <Space direction="vertical" size={4}>
              {failure.hint && <Paragraph style={{ margin: 0 }}>{failure.hint}</Paragraph>}
              {failure.status ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  HTTP {failure.status} · {failure.kind}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {failure.kind}
                </Text>
              )}
            </Space>
          }
          style={{ marginBottom: 12 }}
        />
      )}
      {okText && (
        <Alert
          type="success"
          showIcon
          message={okText}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* ── 底部动作条 ──────────────────────────────────────────── */}
      <div className="zllm-actions">
        <Space>
          <Button
            onClick={() => void testConnection()}
            loading={testing}
            disabled={!configured}
            icon={<ApiOutlined />}
          >
            {testing ? labels.testing : labels.test}
          </Button>
          <Button
            type="primary"
            onClick={() => void save()}
            loading={saving}
            disabled={!draft.model.trim()}
            icon={<SaveOutlined />}
          >
            {saving ? labels.saving : labels.save}
          </Button>
        </Space>
        {!configured && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {needsKey && !draft.apiKey.trim() && !hasApiKey
              ? "填了 API Key 后才能测试连接"
              : "选了模型才能保存"}
          </Text>
        )}
      </div>
    </div>
  );
}

/**
 * 把各仓抛出来的错误收敛成结构化失败。
 *
 * 各仓的 IPC 错误形状不一（有的直接回字符串，有的回 `{success:false,error}`），
 * 面板不能因此崩掉 —— 这里兜底成一条能显示的失败。
 */
function toFailure(e: unknown): LlmFailure {
  if (e && typeof e === "object") {
    const obj = e as Partial<LlmFailure> & { error?: string; failure?: LlmFailure };
    if (obj.failure && typeof obj.failure === "object") return obj.failure;
    if (typeof obj.message === "string" && obj.message) {
      return {
        kind: obj.kind ?? "unknown",
        status: obj.status ?? null,
        message: obj.message,
        hint: obj.hint ?? "",
        focus: obj.focus ?? "none",
      };
    }
    if (typeof obj.error === "string" && obj.error) {
      return {
        kind: "unknown",
        status: null,
        message: obj.error,
        hint: "",
        focus: "none",
      };
    }
  }
  return {
    kind: "unknown",
    status: null,
    message: typeof e === "string" ? e : "未知错误",
    hint: "",
    focus: "none",
  };
}

/**
 * 面板自带样式。
 *
 * 用**类名 + CSS 变量**而不是内联样式或 antd 主题：
 * 内联样式没法被宿主覆盖，而这个面板要长在十仓里 —— 宿主的品牌色、
 * 圆角、深浅色都得能接管。
 */
const PANEL_CSS = `
.zllm-panel {
  --zllm-accent: var(--ant-color-primary, #4f46e5);
  --zllm-border: var(--ant-color-border, rgba(0,0,0,0.08));
  --zllm-bg-sub: var(--ant-color-fill-quaternary, rgba(0,0,0,0.02));
  --zllm-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.zllm-section {
  border: 1px solid var(--zllm-border);
  border-radius: var(--zllm-radius);
  padding: 14px 16px;
  background: var(--zllm-bg-sub);
}
.zllm-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.zllm-center {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
.zllm-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.zllm-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.zllm-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 12px;
}
.zllm-tone-blue { background: rgba(22,119,255,0.12); color: #1677ff; }
.zllm-tone-volcano { background: rgba(250,80,50,0.12); color: #fa5030; }
.zllm-tone-purple { background: rgba(114,46,209,0.12); color: #722ed1; }
.zllm-tone-green { background: rgba(82,196,26,0.14); color: #389e0d; }
.zllm-tone-default { background: rgba(0,0,0,0.06); color: #666; }
.zllm-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.zllm-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--zllm-border);
  border-radius: 8px;
  background: var(--ant-color-bg-container, #fff);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.05s;
}
.zllm-card:hover {
  border-color: var(--zllm-accent);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.zllm-card:active { transform: translateY(1px); }
.zllm-card.active {
  border-color: var(--zllm-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--zllm-accent) 18%, transparent);
}
.zllm-card:focus-visible {
  outline: 2px solid var(--zllm-accent);
  outline-offset: 2px;
}
.zllm-card-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--ant-color-text, #18191c);
}
.zllm-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 20px;
}
.zllm-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
`;

/** 卡片墙里用的独立小组件（便于各仓复用）。 */
export function AiProviderBadge({
  preset,
}: {
  preset: PresetView;
}) {
  return (
    <Tag color={preset.requires_api_key ? "default" : "green"}>
      {preset.requires_api_key ? "需要密钥" : "免密钥"}
    </Tag>
  );
}

/** 卡片（独立导出，便于宿主自定义渲染）。 */
export function AiProviderCard({
  preset,
  active,
  onPick,
}: {
  preset: PresetView;
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <Card
      size="small"
      hoverable
      onClick={() => onPick(preset.id)}
      style={{
        borderColor: active ? "var(--ant-color-primary)" : undefined,
        boxShadow: active ? "0 0 0 2px color-mix(in srgb, var(--ant-color-primary) 18%, transparent)" : undefined,
      }}
    >
      <Space direction="vertical" size={2}>
        <Text strong>{preset.label}</Text>
        <AiProviderBadge preset={preset} />
      </Space>
    </Card>
  );
}
