import React from 'react';
import { useTheme } from '../theme';
import { toastManager } from '../notifications';

// 导航栏组件
export const Navbar: React.FC<{
  title?: string;
  actions?: React.ReactNode[];
}> = ({ title, actions = [] }) => {
  const { themeColors } = useTheme();

  // 渐变色定义
  const headerGradient = themeColors.mode === 'dark'
    ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
    : "linear-gradient(135deg, #ffffff 0%, #f8fafd 100%)";
  const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

  return (
    <>
      <style>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .nav-item:hover {
          transform: translateX(4px);
        }
      `}</style>
      
      <nav
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{
          background: headerGradient,
          borderColor: themeColors.border,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          animation: 'slide-down 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="flex items-center gap-4">
          {/* Logo - 带悬停效果 */}
          <div 
            className="group flex items-center gap-3 cursor-pointer"
            onMouseEnter={(e) => {
              const el = e.currentTarget.querySelector('.brand-icon') as HTMLElement;
              if (el) el.style.transform = 'scale(1.05) rotate(5deg)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget.querySelector('.brand-icon') as HTMLElement;
              if (el) el.style.transform = 'scale(1) rotate(0deg)';
            }}
          >
            <div 
              className="brand-icon w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ 
                background: brandGradient,
                boxShadow: '0 4px 12px rgba(102,126,234,0.25)',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: 600 }}>⚡</span>
            </div>
            <h1
              className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r"
              style={{ 
                backgroundImage: brandGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              {title || 'z-biz-tool'}
            </h1>
          </div>
        </div>

        {/* 动作按钮 */}
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <div 
              key={index} 
              className="nav-item ml-2 transition-all duration-200"
              style={{ transformOrigin: 'center' }}
            >
              {action}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
};

// 侧边栏组件
export const Sidebar: React.FC<{
  items: { id: string; label: string; icon: React.ReactNode }[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}> = ({ items, activeId, onSelect, className = '' }) => {
  const { themeColors } = useTheme();

  // 渐变色定义
  const sidebarGradient = themeColors.mode === 'dark'
    ? "linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)"
    : "linear-gradient(180deg, #f8fafd 0%, #ffffff 100%)";
  const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

  return (
    <>
      <style>{`
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .sidebar-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sidebar-item:hover {
          transform: translateX(4px);
        }
        
        .sidebar-item.active {
          box-shadow: 0 2px 8px rgba(102,126,234,0.3);
        }
      `}</style>
      
      <div
        className={`w-64 flex flex-col border-r ${className}`}
        style={{
          background: sidebarGradient,
          borderColor: themeColors.border,
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)',
          animation: 'slide-in-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="px-4 py-3">
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ 
              color: themeColors.textSecondary,
              letterSpacing: '0.05em'
            }}
          >
            导航
          </h2>
        </div>

        <nav className="flex-1 px-2 py-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              className={`sidebar-item w-full flex items-center gap-3 px-4 py-3 mb-1.5 rounded-xl transition-all duration-200 group`}
              style={{
                backgroundColor: activeId === item.id 
                  ? "linear-gradient(90deg, rgba(102,126,234,0.12) 0%, rgba(118,75,162,0.12) 100%)"
                  : 'transparent',
                color: themeColors.text,
                border: activeId === item.id 
                  ? '1px solid rgba(102,126,234,0.25)' 
                  : '1px solid transparent',
                opacity: index !== 0 ? 1 : 1,
                transform: activeId === item.id ? 'scale(1.02)' : 'scale(1)',
                boxShadow: activeId === item.id 
                  ? '0 4px 12px rgba(102,126,234,0.15)' 
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeId !== item.id) {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeId !== item.id) {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }
              }}
            >
              <div 
                className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-all duration-200"
                style={{ 
                  background: activeId === item.id 
                    ? brandGradient 
                    : themeColors.mode === 'dark' 
                      ? 'rgba(255,255,255,0.08)' 
                      : 'rgba(0,0,0,0.05)',
                  color: activeId === item.id ? 'white' : themeColors.primary,
                  boxShadow: activeId === item.id 
                    ? '0 2px 6px rgba(102,126,234,0.3)' 
                    : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <span className="text-base">{item.icon}</span>
              </div>
              <span 
                className="font-medium truncate"
                style={{ 
                  color: activeId === item.id ? themeColors.text : themeColors.text,
                  fontWeight: activeId === item.id ? 600 : 500
                }}
              >
                {item.label}
              </span>
              
              {/* 右侧指示器 */}
              {activeId === item.id && (
                <div 
                  className="w-1 rounded-full ml-auto"
                  style={{ 
                    background: brandGradient,
                    minWidth: '4px'
                  }}
                />
              )}
            </button>
          ))}
        </nav>
        
        {/* 底部装饰 */}
        <div 
          className="px-4 py-3 mt-auto"
          style={{ 
            borderTop: `1px solid ${themeColors.border}`,
            opacity: 0.5
          }}
        >
          <div 
            className="h-1 rounded-full"
            style={{ 
              background: brandGradient,
              width: '40px',
              margin: '0 auto'
            }}
          />
        </div>
      </div>
    </>
  );
};
