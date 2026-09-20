// 示例：在新项目中使用统一快捷键系统

import React, { useEffect } from 'react';
import { shortcutManager, useShortcutStore } from 'z-biz-tool-shared/shortcuts';
import { toastManager } from 'z-biz-tool-shared/notifications';

// 快捷键示例组件
export const KeyboardShortcutsExample: React.FC = () => {
  // 注册快捷键
  useEffect(() => {
    // 注册 AI 助理快捷键
    shortcutManager.register('ai', 'assistant', {
      description: '打开 AI 助理',
      category: 'AI功能',
      action: () => {
        toastManager.info('AI 助理已打开');
        console.log('打开 AI 助理');
      }
    });

    // 注册文件搜索快捷键
    shortcutManager.register('file', 'search', {
      description: '打开文件搜索',
      category: '文件操作',
      action: () => {
        toastManager.info('文件搜索已打开');
        console.log('打开文件搜索');
      }
    });

    // 注册设置快捷键
    shortcutManager.register('system', 'settings', {
      description: '打开设置',
      category: '系统',
      action: () => {
        toastManager.info('设置已打开');
        console.log('打开设置');
      }
    });

    // 清理快捷键
    return () => {
      shortcutManager.unregister('ai', 'assistant');
      shortcutManager.unregister('file', 'search');
      shortcutManager.unregister('system', 'settings');
    };
  }, []);

  // 显示所有快捷键
  const showAllShortcuts = () => {
    const allShortcuts = shortcutManager.getAll();
    console.log('所有快捷键:', allShortcuts);
    
    toastManager.info(`共 ${Object.keys(allShortcuts).length} 个快捷键`);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: '#FFC131' }}>快捷键系统示例</h1>
      
      <div style={{ marginTop: '20px' }}>
        <h3>已注册的快捷键</h3>
        <ul style={{ 
          listStyle: 'none', 
          padding: 0,
          backgroundColor: '#2d2d2d',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <li style={{ marginBottom: '12px' }}>
            <span style={{ color: '#61DAFB' }}>AI 助理：</span>
            <ShortcutDisplay keys={['Ctrl+Shift+A']} />
          </li>
          <li style={{ marginBottom: '12px' }}>
            <span style={{ color: '#61DAFB' }}>文件搜索：</span>
            <ShortcutDisplay keys={['Ctrl+Shift+F']} />
          </li>
          <li>
            <span style={{ color: '#61DAFB' }}>设置：</span>
            <ShortcutDisplay keys={['Ctrl+Shift+S']} />
          </li>
        </ul>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={showAllShortcuts}
          style={{
            padding: '12px 24px',
            backgroundColor: '#FFC131',
            color: '#1e1e1e',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          查看所有快捷键
        </button>
      </div>
    </div>
  );
};

// 快捷键显示组件
const ShortcutDisplay: React.FC<{ keys: string[] }> = ({ keys }) => {
  return (
    <span>
      {keys.map((key, index) => (
        <span
          key={index}
          style={{
            padding: '4px 8px',
            backgroundColor: '#3d3d3d',
            borderRadius: '4px',
            marginRight: '8px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}
        >
          {key}
        </span>
      ))}
    </span>
  );
};
