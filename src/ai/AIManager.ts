import { create } from 'zustand';
import { AIProvider, AIConfig, AIFunctionType, AIFunctionParams, AIResult, AIContext } from './types';

// AI 客户端接口
interface AIClient {
  chat(prompt: string, context?: AIContext): Promise<AIResult>;
  execute(functionType: AIFunctionType, params: AIFunctionParams, context?: AIContext): Promise<AIResult>;
  getModels(): Promise<string[]>;
  validateConfig(): boolean;
}

// 实现 AI 客户端
class OpenAIClient implements AIClient {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async chat(prompt: string, context?: AIContext): Promise<AIResult> {
    try {
      const messages = [
        { role: 'system', content: this.buildSystemPrompt(context) },
        { role: 'user', content: prompt }
      ];

      const startTime = Date.now();
      const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.modelName,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        success: true,
        content: data.choices[0].message.content,
        metadata: {
          model: this.config.modelName,
          tokensUsed: data.usage.total_tokens,
          latency
        }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async execute(functionType: AIFunctionType, params: AIFunctionParams, context?: AIContext): Promise<AIResult> {
    // 根据功能类型构建不同的 prompt
    const prompt = this.buildPrompt(functionType, params, context);
    return this.chat(prompt, context);
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((m: any) => m.id);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  validateConfig(): boolean {
    return !!this.config.apiKey && !!this.config.modelName;
  }

  private buildSystemPrompt(context?: AIContext): string {
    let prompt = 'You are a helpful assistant.';
    
    if (context?.knowledgeBase?.length) {
      prompt += '\n\nContext from knowledge base:\n' + context.knowledgeBase.join('\n');
    }
    
    if (context?.currentLanguage) {
      prompt += `\n\nCurrent programming language: ${context.currentLanguage}`;
    }

    return prompt;
  }

  private buildPrompt(functionType: AIFunctionType, params: AIFunctionParams, context?: AIContext): string {
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
}

// AI 管理器状态
interface AIStore {
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
    const client = createClient(config);
    return client.getModels();
  },

  executeAI: async (functionType, params) => {
    const { config, context } = get();
    const client = createClient(config);
    
    try {
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
    const { agents, context } = get();
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      return {
        success: false,
        content: '',
        error: `Agent ${agentId} not found`
      };
    }

    // 使用特定 Agent 的模型
    const agentConfig: AIConfig = {
      ...get().config,
      modelName: agent.model,
      provider: 'local' // 假设 Agent 使用本地模型
    };

    const client = createClient(agentConfig);
    
    try {
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

// 创建 AI 客户端工厂
function createClient(config: AIConfig): AIClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAIClient(config);
    // 可以扩展更多提供商
    default:
      return new OpenAIClient(config);
  }
}
