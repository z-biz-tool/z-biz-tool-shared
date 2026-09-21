/**
 * Omnibar - 智能地址栏，集成路径导航和搜索功能
 * 来源：Files v4 的 Omnibar 设计
 */

import { useState, useRef, useEffect, useMemo } from "react";
import type { InputRef } from "antd";
import { Input, Dropdown, type MenuProps } from "antd";
import {
  SearchOutlined,
  SettingOutlined,
  HomeOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  HistoryOutlined,
  MacCommandOutlined,
} from "@ant-design/icons";
import type { FC } from "react";

interface OmnibarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  rootPath: string;
  onRootNavigate: () => void;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  historyIndex: number;
  history: string[];
}

// 渐变色定义
const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const containerGradient = "linear-gradient(135deg, #ffffff 0%, #f8fafd 100%)";

const Omnibar: FC<OmnibarProps> = ({
  currentPath,
  onNavigate,
  rootPath,
  onRootNavigate,
  onBack,
  onForward,
  onUp,
  historyIndex,
  history,
}) => {
  const [mode, setMode] = useState<"navigation" | "search" | "command">("navigation");
  const [searchQuery, setSearchQuery] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [pathEditing, setPathEditing] = useState(false);
  
  const inputRef = useRef<InputRef>(null);
  const commandRef = useRef<InputRef>(null);

  // 当切换模式时聚焦到相应输入框
  useEffect(() => {
    if (mode === "search" && inputRef.current) {
      inputRef.current.focus();
    } else if (mode === "command" && commandRef.current) {
      commandRef.current.focus();
    }
  }, [mode]);

  // 路径编辑模式切换
  const togglePathEditing = () => {
    setPathEditing(!pathEditing);
  };

  // 路径输入提交
  const handlePathSubmit = (value: string) => {
    if (value) {
      onNavigate(value);
    }
    setPathEditing(false);
  };

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+L - 编辑路径
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setMode("navigation");
        setPathEditing(true);
      }
      // Ctrl+F - 搜索
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setMode("search");
      }
      // Ctrl+Shift+P - 命令面板
      if (e.ctrlKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setMode("command");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 导航模式渲染
  const renderNavigation = () => {
    if (pathEditing) {
      return (
        <Input
          value={currentPath}
          onChange={(e) => handlePathSubmit(e.target.value)}
          onPressEnter={() => handlePathSubmit(currentPath)}
          onBlur={() => setPathEditing(false)}
          ref={inputRef}
          size="small"
          style={{ 
            width: '100%',
            fontWeight: 500,
            borderRadius: 8,
            padding: '8px 12px'
          }}
        />
      );
    }

    // 面包屑导航
    const parts = currentPath.split("/").filter(Boolean);
    const breadcrumbs = ["/", ...parts.map((_, i) => `/${parts.slice(0, i + 1).join('/')}`)];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Dropdown
          menu={{
            items: [
              { key: 'home', label: '首页', icon: <HomeOutlined />, onClick: onRootNavigate },
              { key: 'root', label: '根目录', onClick: () => onNavigate(rootPath) },
            ],
          }}
        >
          <div
            onClick={onRootNavigate}
            style={{ 
              cursor: 'pointer', 
              padding: '6px 10px', 
              borderRadius: 8,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)',
            }}
            title="首页"
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'scale(1.05)';
              el.style.boxShadow = '0 2px 8px rgba(102,126,234,0.2)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'scale(1)';
              el.style.boxShadow = 'none';
            }}
          >
            <HomeOutlined style={{ color: '#667eea' }} />
          </div>
        </Dropdown>

        {breadcrumbs.map((path, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: "#999", fontSize: 10 }}>•</span>
              {isLast ? (
                <span 
                  style={{ 
                    fontWeight: 600,
                    background: brandGradient,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    padding: '6px 10px',
                    borderRadius: 8,
                    backgroundSize: '200% 200%',
                    animation: 'gradient-shift 3s ease infinite'
                  }}
                >
                  {parts[index - 1] || 'Home'}
                </span>
              ) : (
                <span
                  onClick={() => onNavigate(path)}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 8,
                    color: "var(--ant-color-text)",
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  {parts[index - 1]}
                </span>
              )}
            </div>
          );
        })}

        <span
          onClick={togglePathEditing}
          style={{ 
            cursor: 'text', 
            padding: '6px 10px', 
            borderRadius: 8, 
            opacity: 0.6,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: 'monospace',
            fontWeight: 500
          }}
          title="点击编辑路径"
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = '0.6'}
        >
          /
        </span>
      </div>
    );
  };

  // 搜索模式渲染
  const renderSearch = () => (
    <Input
      placeholder="搜索文件..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      ref={inputRef}
      prefix={<SearchOutlined style={{ color: '#667eea' }} />}
      suffix={<span style={{ fontSize: 12, color: "#999" }}>Enter 搜索</span>}
      size="small"
      style={{ 
        width: '100%',
        fontWeight: 500,
        borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.06)'
      }}
    />
  );

  // 命令面板模式渲染
  const renderCommand = () => (
    <Input
      placeholder="输入命令 (如：newfolder, settings, refresh)..."
      value={commandInput}
      onChange={(e) => setCommandInput(e.target.value)}
      ref={commandRef}
      prefix={<SettingOutlined style={{ color: '#764ba2' }} />}
      size="small"
      style={{ 
        width: '100%',
        fontWeight: 500,
        borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.06)'
      }}
    />
  );

  return (
    <>
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
          50% { box-shadow: 0 4px 16px rgba(102,126,234,0.15); }
        }
      `}</style>
      
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          background: containerGradient,
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'glow-pulse 3s ease-in-out infinite'
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(102,126,234,0.12)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        {/* 导航控制按钮 */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={onBack}
            disabled={historyIndex <= 0}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: historyIndex <= 0 ? 'transparent' : brandGradient,
              color: historyIndex <= 0 ? '#999' : 'white',
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
              opacity: historyIndex <= 0 ? 0.4 : 1,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="后退 (⌥+←)"
            onMouseEnter={(e) => {
              if (historyIndex > 0) {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(102,126,234,0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (historyIndex > 0) {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }
            }}
          >
            <ArrowLeftOutlined />
          </button>
          
          <button
            onClick={onForward}
            disabled={historyIndex >= history.length - 1}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: historyIndex >= history.length - 1 ? 'transparent' : brandGradient,
              color: historyIndex >= history.length - 1 ? '#999' : 'white',
              cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
              opacity: historyIndex >= history.length - 1 ? 0.4 : 1,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="前进 (⌥+→)"
            onMouseEnter={(e) => {
              if (historyIndex < history.length - 1) {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(102,126,234,0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (historyIndex < history.length - 1) {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }
            }}
          >
            <ArrowLeftOutlined rotate={180} />
          </button>

          <button
            onClick={onUp}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: brandGradient,
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(102,126,234,0.3)'
            }}
            title="上级目录 (⌥+↑)"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(102,126,234,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(102,126,234,0.3)';
            }}
          >
            <ArrowUpOutlined />
          </button>
        </div>

        {/* 模式切换 */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 10 }}>
          {[
            { key: 'navigation', icon: <HistoryOutlined />, label: '路径' },
            { key: 'search', icon: <SearchOutlined />, label: '搜索' },
            { key: 'command', icon: <MacCommandOutlined />, label: '命令' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key as any)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: mode === m.key ? brandGradient : 'transparent',
                color: mode === m.key ? 'white' : 'var(--ant-color-text)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: mode === m.key ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                if (mode !== m.key) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                if (mode !== m.key) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* 主输入区域 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {mode === 'navigation' && renderNavigation()}
          {mode === 'search' && renderSearch()}
          {mode === 'command' && renderCommand()}
        </div>
      </div>
    </>
  );
};

export default Omnibar;
