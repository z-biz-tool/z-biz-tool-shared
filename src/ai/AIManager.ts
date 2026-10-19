import { create } from 'zustand';
// 必须是 `import type`：AIConfig 等全是纯类型。
// 写成普通 import 时，tsc 会按「只用于类型」自动擦除，所以编译一直是好的；
// 但 node --experimental-strip-types 是**仅擦除、不做类型分析**，擦不掉这条语句，
// 于是运行期真去 ./types 找一个只存在于编译期的导出并抛
// 「does not provide an export named 'AIConfig'」。
import type { AIConfig, AIFunctionType, AIFunctionParams, AIResult, AIContext, Agent } from './types';
import { createClient, type AIClient, type FetchLike } from './clients';

// 客户端实现见 ./clients.ts：
//   - provider 工厂此前对 claude/gemini/ollama/local 全部落进 default 分支
//     返回 OpenAIClient（01 A-11）—— 现在每个 provider 有自己的协议实现；
//   - AIConfig.timeout 此前声明了却从不生效（01 A-10）—— 现在走 AbortController。
export type { AIClient, FetchLike } from './clients';

/**
 * 可注入的 fetch 实现。
 *
 * 默认 undefined = 用真实 fetch。设置它（而不是在测试里猴补 globalThis.fetch）
 * 有两个好处：
 *   1. 测试不碰全局状态，别的测试文件不受影响；
 *   2. 下游若在 Node 侧跑（Tauri 后端 / 脚本），可以塞一个带代理、
 *      带重试、带埋点的实现进来。
 */
let fetchOverride: FetchLike | undefined;

/** 设置/清除 fetch 实现；传 undefined 恢复真实 fetch。返回一个还原函数。 */
export function setFetchImplementation(impl: FetchLike | undefined): () => void {
  const previous = fetchOverride;
  fetchOverride = impl;
  return () => {
    fetchOverride = previous;
  };
}

// AI 管理器状态
export interface AIStore {
  config: AIConfig;
  context: AIContext;
  agents: Agent[];
  setConfig: (config: AIConfig) => void;
  updateConfig: (config: Partial<AIConfig>) => void;
  setContext: (context: AIContext) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  executeAI: (functionType: AIFunctionType, params?: AIFunctionParams) => Promise<AIResult>;
  executeWithAgent: (agentId: string, functionType: AIFunctionType, params?: AIFunctionParams) => Promise<AIResult>;
  getModels: () => Promise<string[]>;
}

// 创建 AI 管理器
export const useAIManager = create<AIStore>((set, get) => ({
  config: {
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000
  },
  context: {},
  agents: [],

  setConfig: (config) => set({ config }),

  updateConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),

  setContext: (context) => set({ context }),

  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, agent]
  })),

  removeAgent: (agentId) => set((state) => ({
    agents: state.agents.filter(a => a.id !== agentId)
  })),

  getModels: async () => {
    const { config } = get();
    const client = createClient(config, fetchOverride);
    return client.getModels();
  },

  executeAI: async (functionType, params) => {
    const { config, context } = get();

    try {
      const client = createClient(config, fetchOverride);
      const result = await client.execute(functionType, params || {}, context);
      return result;
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  executeWithAgent: async (agentId, functionType, params) => {
    const { agents, context, config } = get();
    const agent = agents.find(a => a.id === agentId);

    if (!agent) {
      return {
        success: false,
        content: '',
        error: `Agent ${agentId} not found`
      };
    }

    // 使用特定 Agent 的模型。
    //
    // 此前这里把 provider 硬编码成 'local'，但客户端工厂对 'local' 也落进
    // default 分支返回 OpenAIClient —— 于是"用 Agent 自己的模型"实际是
    // "用 OpenAI 的端点 + Agent 的模型名"，模型多半对不上，必然失败。
    //
    // 现在 provider 沿用全局配置（Agent 类型里也没有 provider 字段），
    // 只覆盖 modelName —— 这才是"用特定 Agent 的模型"的字面含义。
    const agentConfig: AIConfig = {
      ...config,
      modelName: agent.model || config.modelName
    };

    try {
      const client = createClient(agentConfig, fetchOverride);
      const result = await client.execute(functionType, params || {}, context);
      return result;
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}));
