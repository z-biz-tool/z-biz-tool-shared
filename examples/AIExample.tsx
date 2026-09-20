/**
 * AI 中台使用示例
 */

import React, { useState, useEffect } from 'react';
import { useAIManager } from 'z-biz-tool-shared/ai';
import { toastManager } from 'z-biz-tool-shared/notifications';

// AI 助理组件示例
export const AIAssistantExample: React.FC = () => {
  const { config, updateConfig, executeAI, getModels } = useAIManager();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  // 加载模型列表
  useEffect(() => {
    const loadModels = async () => {
      if (config.apiKey) {
        const models = await getModels();
        setModels(models);
      }
    };
    loadModels();
  }, [config.apiKey, getModels]);

  // 执行 AI 任务
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toastManager.warning('请输入提示词');
      return;
    }

    if (!config.apiKey) {
      toastManager.error('请先配置 API Key');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      const result = await executeAI('chat', { prompt });
      
      if (result.success) {
        setResponse(result.content);
        toastManager.success('生成成功');
      } else {
        toastManager.error(result.error || '生成失败');
      }
    } catch (error) {
      toastManager.error('生成失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: '#FFC131' }}>AI 助理示例</h1>
      
      {/* 配置区域 */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#2d2d2d', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#61DAFB', marginBottom: '12px' }}>AI 配置</h3>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#b0b0b0' }}>
              API 提供商
            </label>
            <select
              value={config.provider}
              onChange={(e) => updateConfig({ provider: e.target.value as any })}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                border: '1px solid #3d3d3d',
                borderRadius: '4px'
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#b0b0b0' }}>
              API Key
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              placeholder="输入 API Key"
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                border: '1px solid #3d3d3d',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#b0b0b0' }}>
              Base URL (可选)
            </label>
            <input
              type="text"
              value={config.baseUrl || ''}
              onChange={(e) => updateConfig({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                border: '1px solid #3d3d3d',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#b0b0b0' }}>
              模型名称
            </label>
            <select
              value={config.modelName}
              onChange={(e) => updateConfig({ modelName: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                border: '1px solid #3d3d3d',
                borderRadius: '4px'
              }}
            >
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#b0b0b0' }}>
              温度 (Temperature)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.temperature}
              onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#1e1e1e',
                color: '#ffffff',
                border: '1px solid #3d3d3d',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
      </div>

      {/* 生成区域 */}
      <div>
        <h3 style={{ color: '#61DAFB', marginBottom: '12px' }}>AI 生成</h3>
        
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入你的问题或提示词..."
          disabled={loading}
          style={{
            width: '100%',
            height: '150px',
            padding: '12px',
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            border: '1px solid #3d3d3d',
            borderRadius: '8px',
            resize: 'vertical',
            marginBottom: '12px'
          }}
        />

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#FFC13180' : '#FFC131',
            color: '#1e1e1e',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          {loading ? '生成中...' : '生成'}
        </button>

        {response && (
          <div style={{ 
            marginTop: '20px', 
            padding: '16px',
            backgroundColor: '#2d2d2d',
            borderRadius: '8px'
          }}>
            <h3 style={{ color: '#61DAFB', marginBottom: '12px' }}>响应结果</h3>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#b0b0b0',
              lineHeight: '1.6'
            }}>
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// AI 命令解释示例
export const AICommandExplanationExample: React.FC = () => {
  const { executeAI } = useAIManager();
  const [command, setCommand] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const explainCommand = async () => {
    if (!command.trim()) return;

    setLoading(true);
    
    try {
      const cmdResult = await executeAI('explain', { text: command });
      
      if (cmdResult.success) {
        try {
          const parsed = JSON.parse(cmdResult.content);
          setResult(parsed);
        } catch {
          setResult({ description: cmdResult.content });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: '#FFC131' }}>AI 命令解释示例</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#b0b0b0' }}>
          输入命令
        </label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="例如: ls -la /home/user"
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            border: '1px solid #3d3d3d',
            borderRadius: '8px'
          }}
        />
      </div>

      <button
        onClick={explainCommand}
        disabled={loading}
        style={{
          padding: '12px 24px',
          backgroundColor: loading ? '#61DAFB80' : '#61DAFB',
          color: '#1e1e1e',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold'
        }}
      >
        {loading ? '分析中...' : '分析命令'}
      </button>

      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '16px',
          backgroundColor: '#2d2d2d',
          borderRadius: '8px'
        }}>
          <h3 style={{ color: '#61DAFB', marginBottom: '12px' }}>分析结果</h3>
          
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#b0b0b0' }}>描述:</strong>
            <p style={{ color: '#ffffff', margin: '4px 0' }}>{result.description}</p>
          </div>

          {result.parameters && (
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#b0b0b0' }}>参数:</strong>
              <ul style={{ color: '#ffffff', margin: '8px 0', paddingLeft: '20px' }}>
                {result.parameters.map((p: any, i: number) => (
                  <li key={i}>
                    <strong>{p.name}:</strong> {p.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.example && (
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#b0b0b0' }}>示例:</strong>
              <code style={{ 
                display: 'block', 
                padding: '8px', 
                backgroundColor: '#1e1e1e',
                borderRadius: '4px',
                marginTop: '4px',
                color: '#61DAFB'
              }}>
                {result.example}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
