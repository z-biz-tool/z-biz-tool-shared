import { Spin, Button, Tag } from "antd";
import { ReloadOutlined, CloudOutlined, CloseOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

// 渐变色定义
const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title = "暂无数据",
  description = "点击按钮添加新内容",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 320,
        gap: 20,
        background: "linear-gradient(135deg, #f8fafd 0%, #eef2f7 100%)",
        borderRadius: 20,
        padding: 40,
        position: 'relative' as const,
        overflow: 'hidden' as const
      }}
    >
      {/* 背景装饰 */}
      <div 
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(102,126,234,0.08) 0%, transparent 70%)',
          animation: 'float 6s ease-in-out infinite'
        }}
      />
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 0 4px 12px rgba(102,126,234,0.25);
          }
          50% { 
            box-shadow: 0 8px 24px rgba(102,126,234,0.4);
          }
        }
      `}</style>
      
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: brandGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(102,126,234,0.3)",
          animation: 'pulse-glow 2s ease-in-out infinite',
          zIndex: 1
        }}
      >
        {icon ?? (
          <CloudOutlined 
            style={{ 
              fontSize: 40, 
              color: "white",
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
            }} 
          />
        )}
      </div>
      
      <div 
        style={{ 
          fontWeight: 600, 
          fontSize: 18, 
          color: "#1a1a2e",
          textAlign: 'center' as const
        }} 
      >
        {title}
      </div>
      
      <div 
        style={{ 
          color: "#666666", 
          fontSize: 14, 
          textAlign: "center" as const, 
          maxWidth: 320,
          lineHeight: 1.6
        }}
      >
        {description}
      </div>
      
      {action && (
        <div style={{ zIndex: 1 }}>{action}</div>
      )}
      
      <Tag 
        color="blue" 
        style={{ 
          borderRadius: 20, 
          fontSize: 12,
          padding: '4px 16px',
          fontWeight: 500,
          background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)',
          border: '1px solid rgba(102,126,234,0.2)'
        }}
      >
        🎯 准备就绪
      </Tag>
    </div>
  );
}

interface LoadingStateProps {
  tip?: string;
  minHeight?: number;
  content?: ReactNode;
}

export function LoadingState({ 
  tip = "加载中...", 
  minHeight = 320,
  content
}: LoadingStateProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        minHeight,
        background: "linear-gradient(135deg, #fafbff 0%, #f0f4ff 100%)",
        borderRadius: 20,
        position: 'relative' as const,
        overflow: 'hidden' as const
      }}
    >
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* 背景动画 */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(102,126,234,0.03) 0%, rgba(118,75,162,0.03) 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 3s ease infinite'
        }}
      />
      
      <div style={{ 
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }}>
        {content || (
          <>
            <Spin 
              size="large" 
              style={{ 
                color: "#667eea",
                filter: 'drop-shadow(0 4px 12px rgba(102,126,234,0.3))'
              }}
            />
            <div 
              style={{ 
                fontSize: 14, 
                color: "#666666",
                fontWeight: 500,
                letterSpacing: '0.02em'
              }}
            >
              {tip}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ 
  message = "发生未知错误", 
  onRetry,
  title = "操作失败"
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 320,
        gap: 20,
        background: "linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)",
        borderRadius: 20,
        padding: 40,
        position: 'relative' as const,
        overflow: 'hidden' as const
      }}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
      `}</style>
      
      <div 
        className="error-icon"
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f44336 0%, #e57373 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(244,67,54,0.3)",
          animation: 'shake 0.6s ease-in-out',
          zIndex: 1
        }}
      >
        <CloseOutlined 
          style={{ 
            fontSize: 40, 
            color: "white",
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
          }} 
        />
      </div>
      
      <div 
        style={{ 
          fontWeight: 600, 
          fontSize: 20, 
          color: "#c62828",
          textAlign: 'center' as const,
          zIndex: 1
        }} 
      >
        ❌ {title}
      </div>
      
      <div 
        style={{ 
          color: "#757575", 
          fontSize: 14, 
          textAlign: "center" as const, 
          maxWidth: 320,
          lineHeight: 1.6,
          zIndex: 1
        }}
      >
        {message}
      </div>
      
      {onRetry && (
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={onRetry}
          size="large"
          style={{
            background: brandGradient,
            border: "none",
            borderRadius: 12,
            padding: "12px 32px",
            fontSize: 14,
            fontWeight: 500,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
            zIndex: 1,
            position: 'relative' as const
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLElement;
            btn.style.transform = "scale(1.05)";
            btn.style.boxShadow = "0 8px 24px rgba(102,126,234,0.4)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLElement;
            btn.style.transform = "scale(1)";
            btn.style.boxShadow = "0 4px 12px rgba(102,126,234,0.3)";
          }}
        >
          重试
        </Button>
      )}
    </div>
  );
}
