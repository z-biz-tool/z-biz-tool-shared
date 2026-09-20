/**
 * DragHandle — 窗口顶部的可拖动区域。
 *
 * macOS 浮层窗口没有原生 title bar, 需要一个明确的区域 + 视觉抓手让用户知道
 * "这里可以拖"。
 *
 * 设计:
 *   - 高度可配置，渐变背景 (跟现有玻璃态统一)
 *   - 左侧 HolderOutlined icon(3 条横线，经典 drag affordance)
 *   - 中间可选 children
 *   - 整条 data-tauri-drag-region="deep": 子树内非交互元素点击即可拖动
 *     (tauri drag.js 自动排除 input/button/select 等交互元素; 需要整簇
 *      禁拖的局部用 data-tauri-drag-region="false", 如搜索框)
 *   - 前置：capabilities 需含 core:window:allow-start-dragging
 *     (core:window:default 权限集不含它，缺了 invoke 会被 ACL 拒掉)
 *   - hover/active 状态：抓手指针 + 渐变更明显
 *
 * 用法:
 *   <DragHandle>
 *     <Input data-no-drag ... />   ← 搜索框不参与拖动，但在 handle 内
 *     <Button data-no-drag>关闭</Button>
 *   </DragHandle>
 */

import type { ReactNode } from "react";
import { HolderOutlined } from "@ant-design/icons";

export interface DragHandleProps {
  children?: ReactNode;
  /** 右侧 slot (close / pin / 等等), 这些元素会自动 no-drag */
  right?: ReactNode;
  /** 左侧 icon 是否显示，默认 true */
  showGrip?: boolean;
  /** 背景透明 (让父级背景透出), 默认 false(自带渐变) */
  transparent?: boolean;
  /** 自定义高度，默认 40 */
  height?: number;
}

// 渐变色定义
const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

export function DragHandle({
  children,
  right,
  showGrip = true,
  transparent = false,
  height = 40,
}: DragHandleProps) {
  return (
    <>
      <style>{`
        @keyframes pulse-grip {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.7;
          }
          50% { 
            transform: scale(1.1);
            opacity: 0.9;
          }
        }
        
        .zBizDragHandleGrip {
          animation: pulse-grip 2s ease-in-out infinite;
        }
        
        .drag-handle-area:hover {
          cursor: grabbing;
        }
      `}</style>
      
      <div
        data-tauri-drag-region="deep"
        className="drag-handle-area"
        style={{
          height,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px 0 14px",
          background: transparent
            ? "transparent"
            : `linear-gradient(180deg, rgba(102,126,234,0.12) 0%, rgba(118,75,162,0.06) 100%)`,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          cursor: "grab",
          userSelect: "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          position: 'relative' as const,
          overflow: 'hidden' as const,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          if (!transparent) {
            el.style.background = `linear-gradient(180deg, rgba(102,126,234,0.16) 0%, rgba(118,75,162,0.08) 100%)`;
            el.style.boxShadow = '0 2px 8px rgba(102,126,234,0.1)';
          }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          if (!transparent) {
            el.style.background = transparent
              ? "transparent"
              : `linear-gradient(180deg, rgba(102,126,234,0.08) 0%, rgba(139,92,246,0.03) 100%)`;
            el.style.boxShadow = 'none';
          }
        }}
        title="按住拖动窗口"
      >
        {/* 背景装饰条 */}
        {!transparent && (
          <div 
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              background: brandGradient,
              opacity: 0.8
            }}
          />
        )}
        
        {showGrip && (
          <HolderOutlined
            className="zBizDragHandleGrip"
            style={{
              fontSize: 16,
              color: "#667eea",
              opacity: 0.8,
              flexShrink: 0,
              cursor: "grab",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              filter: 'drop-shadow(0 2px 4px rgba(102,126,234,0.2))'
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.opacity = "1";
              el.style.color = "#764ba2";
              el.style.transform = "scale(1.15)";
              el.style.filter = 'drop-shadow(0 4px 8px rgba(118,75,162,0.3))';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.opacity = "0.8";
              el.style.color = "#667eea";
              el.style.transform = "scale(1)";
              el.style.filter = 'drop-shadow(0 2px 4px rgba(102,126,234,0.2))';
            }}
          />
        )}
        <div
          data-tauri-drag-region="deep"
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          {children}
        </div>
        {right && (
          <div data-no-drag style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {right}
          </div>
        )}
      </div>
    </>
  );
}
