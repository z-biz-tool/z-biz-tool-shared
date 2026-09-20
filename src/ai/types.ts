// AI 提供商类型定义
export type AIProvider = 'openai' | 'claude' | 'gemini' | 'ollama' | 'local';

// AI 功能类型
export type AIFunctionType = 
  | 'chat'           // 聊天对话
  | 'explain'        // 命令解释
  | 'analyze'        // 错误分析
  | 'generate'       // 文本生成
  | 'code'           // 代码生成/重构
  | 'git-commit'     // Git提交信息生成
  | 'image'          // 图像生成
  | 'video'          // 视频生成
  | 'ppt'            // PPT生成
  | 'natural-language' // 自然语言转命令
  | 'classify'       // 文件/内容分类
  | 'summarize'      // 摘要生成
  | 'health-check'   // 健康检查
  | 'auto-fix';      // 自动修复

// AI 配置接口
export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

// AI 功能参数接口
export interface AIFunctionParams {
  [key: string]: unknown;
}

// AI 执行结果接口
export interface AIResult {
  success: boolean;
  content: string;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    latency?: number;
    [key: string]: unknown;
  };
  error?: string;
}

// 上下文类型
export interface AIContext {
  files?: string[];           // 文件路径列表
  fileContents?: Record<string, string>; // 文件内容
  knowledgeBase?: string[];   // 知识库内容
  history?: string[];         // 会话历史
  currentLanguage?: string;   // 当前编程语言
  currentSelection?: string;  // 当前选中内容
  [key: string]: unknown;
}

// Agent 类型
export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  status: 'idle' | 'working' | 'offline';
}
