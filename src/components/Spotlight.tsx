import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../theme';
import { useShortcutStore } from '../shortcuts';
import { toastManager } from '../notifications';

// Spotlight 命令
export interface SpotlightCommand {
  id: string;
  title: string;
  description?: string;
  category: 'actions' | 'files' | 'terminals' | 'ai' | 'settings' | 'system';
  icon?: React.ReactNode;
  action?: () => void;
  shortcut?: string[];
  keywords?: string[];
}

// Spotlight 组件
export const Spotlight: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void 
}> = ({ isOpen, onClose }) => {
  const { themeColors } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [commands, setCommands] = useState<SpotlightCommand[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载所有命令
  useEffect(() => {
    if (isOpen) {
      // 按类别分组
      const categorizedCommands: SpotlightCommand[] = [
        // 其他系统命令
        {
          id: 'settings',
          title: '打开设置',
          category: 'system',
          action: () => toastManager.info('设置功能开发中...'),
          shortcut: ['Ctrl', ',', 'Shift']
        },
        {
          id: 'help',
          title: '打开帮助',
          category: 'system',
          action: () => toastManager.info('帮助文档开发中...'),
          shortcut: ['F1']
        },
        {
          id: 'about',
          title: '关于',
          category: 'system',
          action: () => toastManager.info('关于 z-biz-tool'),
          shortcut: ['Ctrl', 'Shift', 'A']
        }
      ];

      setCommands(categorizedCommands);
    }
  }, [isOpen]);

  // 过滤命令
  const filteredCommands = commands.filter(cmd => {
    const queryLower = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(queryLower) ||
      cmd.description?.toLowerCase().includes(queryLower) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(queryLower))
    );
  });

  // 快捷键处理
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 拦截导航快捷键
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => 
          Math.min(prev + 1, filteredCommands.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[activeIndex] && filteredCommands[activeIndex].action) {
          filteredCommands[activeIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, activeIndex, onClose]);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        event.target !== inputRef.current
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 渐变色定义
  const overlayGradient = "linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)";
  const cardGradient = themeColors.mode === 'dark'
    ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
    : "linear-gradient(135deg, #ffffff 0%, #f8fafd 100%)";
  const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

  return (
    <>
      <style>{`
        @keyframes spotlight-slide-in {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 4px 12px rgba(102,126,234,0.3);
          }
          50% {
            box-shadow: 0 4px 20px rgba(102,126,234,0.5);
          }
        }
      `}</style>
      
      <div 
        ref={containerRef}
        className="fixed inset-0 z-50 flex items-start justify-center pt-24"
        style={{ 
          backgroundColor: overlayGradient,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      >
      <div 
        className="w-full max-w-2xl mx-4"
        style={{
          background: cardGradient,
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          animation: 'spotlight-slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* 输入框 */}
        <div 
          className="p-4 border-b"
          style={{ borderColor: themeColors.border, opacity: 0.9 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div 
              className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ 
                background: brandGradient,
                boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
                animation: 'pulse 2s ease-in-out infinite'
              }}
            >
              <span style={{ fontSize: '20px' }}>🔍</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="搜索功能、文件、命令..."
              className="w-full bg-transparent border-none outline-none text-lg font-medium"
              style={{ color: themeColors.text }}
            />
            <span 
              className="text-xs px-2.5 py-1 rounded-lg font-mono"
              style={{ 
                background: themeColors.mode === 'dark' 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.05)', 
                color: themeColors.textSecondary,
                fontWeight: 500
              }}
            >
              Esc
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-xs">
            <div 
              className="px-2 py-0.5 rounded-lg font-mono"
              style={{ 
                background: themeColors.mode === 'dark' 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.05)', 
                color: themeColors.textSecondary,
                fontWeight: 500
              }}
            >
              ↓↑
            </div>
            <span style={{ color: themeColors.textSecondary, opacity: 0.8 }}>导航</span>
            <span className="mx-1" style={{ color: themeColors.border, opacity: 0.5 }}>•</span>
            <div 
              className="px-2 py-0.5 rounded-lg font-mono"
              style={{ 
                background: themeColors.mode === 'dark' 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.05)', 
                color: themeColors.textSecondary,
                fontWeight: 500
              }}
            >
              ⏎
            </div>
            <span style={{ color: themeColors.textSecondary, opacity: 0.8 }}>执行</span>
          </div>
        </div>

        {/* 命令列表 */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div 
              className="p-8 text-center"
              style={{ color: themeColors.textSecondary }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <p>未找到匹配的命令</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                尝试: {query.toLowerCase()}
              </p>
            </div>
          ) : (
            <ul>
              {filteredCommands.map((cmd, index) => (
                <li
                  key={cmd.id}
                  onClick={() => {
                    if (cmd.action) cmd.action();
                    onClose();
                  }}
                  className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                    index === activeIndex 
                      ? 'bg-blue-500/20' 
                      : 'hover:bg-gray-700/30'
                  }`}
                  style={{
                    backgroundColor: index === activeIndex 
                      ? 'rgba(59, 130, 246, 0.15)' 
                      : 'transparent'
                  }}
                >
                  <div 
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-lg"
                    style={{ 
                      backgroundColor: themeColors.background,
                      color: themeColors.primary
                    }}
                  >
                    {cmd.icon || getCategoryIcon(cmd.category)}
                  </div>
                  
                  <div className="flex-1">
                    <div 
                      className="text-lg font-medium"
                      style={{ color: themeColors.text }}
                    >
                      {cmd.title}
                    </div>
                    
                    {cmd.description && (
                      <div 
                        className="text-sm mt-1"
                        style={{ color: themeColors.textSecondary }}
                      >
                        {cmd.description}
                      </div>
                    )}
                    
                    {cmd.shortcut && cmd.shortcut.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {cmd.shortcut.map((key, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: themeColors.background,
                              color: themeColors.textSecondary,
                              fontFamily: 'monospace'
                            }}
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底部状态栏 */}
        <div 
          className="p-3 flex justify-between items-center text-xs"
          style={{ 
            backgroundColor: themeColors.background,
            color: themeColors.textSecondary 
          }}
        >
          <span>
            {filteredCommands.length} 个结果
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.background }}>
                ↑↓
              </span>
              选择
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.background }}>
                Enter
              </span>
              执行
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.background }}>
                Esc
              </span>
              关闭
            </span>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

// 获取类别图标
const getCategoryIcon = (category: string): React.ReactNode => {
  const icons: Record<string, string> = {
    actions: '⚡',
    files: '📄',
    terminals: '💻',
    ai: '🤖',
    settings: '⚙️',
    system: '🖥️'
  };
  
  return icons[category] || '🔍';
};

// 导出 Spotlight 状态管理
export const useSpotlight = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const openSpotlight = () => setIsOpen(true);
  const closeSpotlight = () => setIsOpen(false);
  const toggleSpotlight = () => setIsOpen(prev => !prev);
  
  return {
    isOpen,
    openSpotlight,
    closeSpotlight,
    toggleSpotlight
  };
};
