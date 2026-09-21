import React, { useState, type ReactNode, useEffect, useRef } from "react";
import { theme } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";

interface CollapsiblePanelProps {
  /** 面板标题 */
  title: ReactNode;
  /** 标题旁的徽标（如 Badge） */
  badge?: ReactNode;
  /** 内容 */
  children: ReactNode;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 受控展开状态 */
  expanded?: boolean;
  /** 状态变化回调 */
  onExpandedChange?: (expanded: boolean) => void;
  /** 标题右侧额外操作 */
  extra?: ReactNode;
  /** 自定义图标 */
  icon?: ReactNode;
  /** 渐变主题色 */
  gradient?: string;
}

// 渐变色定义
const defaultGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

/**
 * 可折叠面板 - 用于侧栏分组（搜索/收藏/暂存栈/文件树等）
 * - 标题点击可折叠/展开
 * - 折叠时内容区域有平滑过渡
 * - 支持键盘可达（Enter/Space）
 * - 现代化渐变设计
 */
export function CollapsiblePanel({
  title,
  badge,
  children,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  extra,
  icon,
  gradient = defaultGradient,
}: CollapsiblePanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const { token } = theme.useToken();
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current && expanded) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [expanded, children]);

  const toggle = () => {
    const next = !expanded;
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

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
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .panel-content-enter {
          animation: slide-down 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .panel-content-leave {
          animation: slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      
      <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={toggle}
          onKeyDown={onKey}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            fontWeight: 600,
            fontSize: 13,
            color: token.colorText,
            cursor: "pointer",
            userSelect: "none",
            background: expanded 
              ? `linear-gradient(90deg, rgba(102,126,234,0.12) 0%, rgba(118,75,162,0.06) 100%)`
              : "linear-gradient(90deg, rgba(102,126,234,0.04) 0%, rgba(118,75,162,0.02) 100%)",
            borderRadius: 12,
            margin: "6px 8px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            border: expanded 
              ? `1px solid rgba(102,126,234,0.2)` 
              : `1px solid transparent`,
            boxShadow: expanded 
              ? '0 4px 12px rgba(102,126,234,0.15)' 
              : 'none',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            if (!expanded) {
              el.style.background = "linear-gradient(90deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.04) 100%)";
              el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            if (!expanded) {
              el.style.background = "linear-gradient(90deg, rgba(102,126,234,0.04) 0%, rgba(118,75,162,0.02) 100%)";
              el.style.boxShadow = "none";
            }
          }}
        >
          {/* 箭头图标 */}
          <span 
            aria-hidden 
            style={{ 
              display: "inline-flex", 
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              color: "#667eea",
              flexShrink: 0
            }}
          >
            {expanded ? <DownOutlined style={{ fontSize: 12 }} /> : <UpOutlined style={{ fontSize: 12 }} />}
          </span>
          
          {/* 图标 */}
          {icon && (
            <span 
              style={{ 
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {React.cloneElement(icon as React.ReactElement<any>, {
                style: {
                  ...((icon as React.ReactElement<any>).props?.style),
                  color: expanded ? "#667eea" : token.colorTextSecondary,
                  filter: expanded ? 'drop-shadow(0 2px 4px rgba(102,126,234,0.2))' : 'none'
                }
              })}
            </span>
          )}
          
          {/* 标题 */}
          <span 
            style={{ 
              flex: 1, 
              minWidth: 0,
              background: expanded 
                ? `linear-gradient(90deg, #667eea 0%, #764ba2 100%)`
                : 'none',
              WebkitBackgroundClip: expanded ? 'text' : 'none',
              WebkitTextFillColor: expanded ? 'transparent' : 'initial',
              backgroundClip: expanded ? 'text' : 'none',
              fontWeight: expanded ? 600 : 500,
              transition: 'all 0.2s ease'
            }}
          >
            {title}
          </span>
          
          {/* 徽标 */}
          {badge && (
            <span style={{ flexShrink: 0 }}>{badge}</span>
          )}
          
          {/* 额外操作 */}
          {extra && (
            <span 
              onClick={(e) => e.stopPropagation()}
              style={{ flexShrink: 0 }}
            >
              {extra}
            </span>
          )}
        </div>
        
        <div
          ref={contentRef}
          style={{
            overflow: "hidden",
            maxHeight: height,
            transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
            opacity: expanded ? 1 : 0,
          }}
          aria-hidden={!expanded}
        >
          <div 
            className={expanded ? 'panel-content-enter' : 'panel-content-leave'}
            style={{ padding: "12px 10px 16px" }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
