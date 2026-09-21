// 上下文管理器 - 管理 AI 上下文数据
import { AIContext } from './types';

export class ContextManager {
  private context: AIContext = {};
  private maxHistorySize = 20;

  // 设置文件内容
  setFiles(filePaths: string[]): void {
    this.context.files = filePaths;
  }

  // 设置文件内容
  setFileContents(fileContents: Record<string, string>): void {
    this.context.fileContents = fileContents;
  }

  // 添加知识库内容
  addKnowledge(knowledge: string): void {
    if (!this.context.knowledgeBase) {
      this.context.knowledgeBase = [];
    }
    this.context.knowledgeBase.push(knowledge);
  }

  // 添加会话历史
  addHistory(message: string): void {
    if (!this.context.history) {
      this.context.history = [];
    }
    this.context.history.push(message);
    
    // 限制历史记录大小
    if (this.context.history.length > this.maxHistorySize) {
      this.context.history.shift();
    }
  }

  // 设置当前语言
  setCurrentLanguage(language: string): void {
    this.context.currentLanguage = language;
  }

  // 设置当前选中内容
  setCurrentSelection(selection: string): void {
    this.context.currentSelection = selection;
  }

  // 获取上下文
  getContext(): AIContext {
    return { ...this.context };
  }

  // 清除上下文
  clear(): void {
    this.context = {};
  }

  // 从文件加载上下文
  async loadFromFile(filePath: string): Promise<void> {
    try {
      // 这里需要通过 Tauri 或其他方式读取文件
      // 暂时留空，由具体实现填充
      console.log('Load from file:', filePath);
    } catch (error) {
      console.error('Failed to load context from file:', error);
    }
  }

  // 从知识库加载上下文
  async loadFromKnowledgeBase(query: string): Promise<void> {
    try {
      // 这里需要调用知识库 API
      console.log('Load from knowledge base:', query);
    } catch (error) {
      console.error('Failed to load from knowledge base:', error);
    }
  }
}

// 导出单例
export const contextManager = new ContextManager();
