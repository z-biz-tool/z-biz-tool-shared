/**
 * UI 设计系统
 * z-biz-tool 的统一设计语言和组件规范
 */

import React from 'react';
import { useTheme } from '../theme';

// 设计令牌
export const DESIGN_TOKENS = {
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px'
  },
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    none: 'none'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px'
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px'
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  }
};

// 图标组件
export const Icon: React.FC<{
  name: string;
  size?: number;
  className?: string;
  color?: string;
}> = ({ name, size = 24, className = '', color }) => {
  const icons: Record<string, React.ReactNode> = {
    search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    close: <path d="M6 18L18 6M6 6l12 12" />,
    settings: (
      <>
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    ),
    plus: <path d="M12 4v16m8-8H4" />,
    edit: (
      <>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9z" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    check: <path d="M5 13l4 4L19 7" />,
    x: <path d="M6 18L18 6M6 6l12 12" />,
    chevronDown: <path d="M19 9l-7 7-7-7" />,
    chevronRight: <path d="M9 5l7 7-7 7" />,
    file: <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />,
    folder: (
      <>
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </>
    ),
    terminal: <path d="M4 17l6-6-6-6" />,
    bolt: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    cpu: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </>
    ),
    robot: (
      <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4M8 11v-2M16 11v-2" />
      </>
    )
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

// 空状态组件
export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon = 'file', title, description, action, className = '' }) => {
  const { themeColors } = useTheme();

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
      style={{ color: themeColors.textSecondary }}
    >
      <div className="mb-6">
        <Icon name={icon} size={64} color={themeColors.textSecondary} />
      </div>
      <h3
        className="text-lg font-medium mb-2"
        style={{ color: themeColors.text }}
      >
        {title}
      </h3>
      {description && (
        <p className="max-w-md mb-6" style={{ color: themeColors.textSecondary }}>
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

// 加载状态组件
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}> = ({ size = 'md', color, className = '' }) => {
  const sizeStyles = {
    sm: { width: '16px', height: '16px', borderWidth: '2px' },
    md: { width: '24px', height: '24px', borderWidth: '3px' },
    lg: { width: '40px', height: '40px', borderWidth: '4px' }
  };

  const { themeColors } = useTheme();

  return (
    <div
      className={`animate-spin rounded-full border-t-transparent ${className}`}
      style={{
        ...sizeStyles[size],
        borderColor: color || themeColors.textSecondary
      }}
    />
  );
};

// Skeleton 组件
export const Skeleton: React.FC<{
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px', 
  className = '' 
}) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{
        width,
        height,
        borderRadius
      }}
    />
  );
};

// 按钮组件
export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  className = '',
  icon
}) => {
  const { themeColors } = useTheme();

  // 基础样式
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s',
    opacity: disabled ? 0.5 : 1
  };

  // 尺寸样式
  const sizeStyles = {
    sm: { padding: '6px 12px', fontSize: '14px' },
    md: { padding: '10px 20px', fontSize: '16px' },
    lg: { padding: '14px 28px', fontSize: '18px' }
  };

  // 变体样式
  const variantStyles = {
    primary: {
      backgroundColor: themeColors.primary,
      color: themeColors.text
    },
    secondary: {
      backgroundColor: themeColors.surface,
      color: themeColors.text,
      border: `1px solid ${themeColors.border}`
    },
    danger: {
      backgroundColor: '#ef4444',
      color: 'white'
    },
    ghost: {
      backgroundColor: 'transparent',
      color: themeColors.text
    }
  };

  const currentStyle = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant]
  };

  return (
    <button
      style={currentStyle}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {icon && <span className="text-lg">{icon}</span>}
      {children}
    </button>
  );
};

// 输入框组件
export const Input: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  error?: string;
}> = ({ 
  value, 
  onChange, 
  placeholder = '', 
  type = 'text', 
  disabled = false,
  icon,
  error
}) => {
  const { themeColors } = useTheme();

  return (
    <div className="relative">
      <div
        className="flex items-center px-4 py-3 rounded-lg border transition-colors"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: error ? '#ef4444' : themeColors.border,
          color: themeColors.text
        }}
      >
        {icon && <span className="mr-3 text-lg">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none"
          style={{
            color: themeColors.text
          }}
        />
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

// 文本框组件
export const Textarea: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}> = ({ 
  value, 
  onChange, 
  placeholder = '', 
  rows = 4, 
  disabled = false
}) => {
  const { themeColors } = useTheme();

  return (
    <div
      className="rounded-lg border p-4 transition-colors"
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border
      }}
    >
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full bg-transparent border-none outline-none resize-y"
        style={{
          color: themeColors.text
        }}
      />
    </div>
  );
};

// 卡片组件
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ children, className = '', title, footer }) => {
  const { themeColors } = useTheme();

  return (
    <div
      className={`rounded-xl border overflow-hidden ${className}`}
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border
      }}
    >
      {title && (
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: themeColors.border }}
        >
          <h3 className="text-lg font-semibold" style={{ color: themeColors.text }}>
            {title}
          </h3>
        </div>
      )}
      
      <div className="p-6">
        {children}
      </div>
      
      {footer && (
        <div
          className="px-6 py-4 border-t"
          style={{ borderColor: themeColors.border }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

// 标签组件
export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ children, variant = 'default', size = 'md', className = '' }) => {
  const { themeColors } = useTheme();

  const variantStyles = {
    success: { backgroundColor: '#4caf50', color: 'white' },
    warning: { backgroundColor: '#ff9800', color: 'black' },
    error: { backgroundColor: '#f44336', color: 'white' },
    info: { backgroundColor: '#2196f3', color: 'white' },
    default: { 
      backgroundColor: themeColors.background, 
      color: themeColors.textSecondary 
    }
  };

  const sizeStyles = {
    sm: { padding: '4px 8px', fontSize: '12px' },
    md: { padding: '6px 12px', fontSize: '14px' },
    lg: { padding: '8px 16px', fontSize: '16px' }
  };

  return (
    <span
      className={`inline-flex items-center rounded-md ${className}`}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size]
      }}
    >
      {children}
    </span>
  );
};

// 分割线组件
export const Divider: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}> = ({ orientation = 'horizontal', className = '' }) => {
  const { themeColors } = useTheme();

  const baseStyle = {
    borderColor: themeColors.border
  };

  return orientation === 'horizontal' ? (
    <div 
      className={`w-full h-px ${className}`}
      style={baseStyle}
    />
  ) : (
    <div 
      className={`h-full w-px ${className}`}
      style={baseStyle}
    />
  );
};

// 模态框组件
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const { themeColors } = useTheme();

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${sizeStyles[size]}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: themeColors.surface
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: themeColors.border }}
        >
          <h3
            className="text-xl font-semibold"
            style={{ color: themeColors.text }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            style={{ color: themeColors.textSecondary }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {children}
        </div>

        {/* 底部 */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: themeColors.border }}
        >
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={onClose}>确定</Button>
        </div>
      </div>
    </div>
  );
};
