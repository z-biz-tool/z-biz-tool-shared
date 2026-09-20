import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { theme as antdTheme, Button } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";

interface ThemeContextType {
  mode: "light" | "dark";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("z-tool-theme-mode");
    if (stored === "dark" || stored === "light") return stored;
    // 优先使用系统偏好
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return systemPrefersDark ? "dark" : "light";
  });

  // 同步到 localStorage 和 HTML 元素
  useEffect(() => {
    try {
      localStorage.setItem("z-tool-theme-mode", mode);
    } catch {
      /* 容量满或隐私模式，忽略 */
    }
    
    // 同步到 HTML 元素
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const stored = localStorage.getItem("z-tool-theme-mode");
      if (!stored) {
        // 如果用户没有手动设置，跟随系统
        setMode(mediaQuery.matches ? "dark" : "light");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggle = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// 主题切换按钮组件
export const ThemeToggle: React.FC<{ size?: "small" | "middle" | "large" }> = ({ 
  size = "small" 
}) => {
  const { mode, toggle } = useTheme();
  const { token } = antdTheme.useToken();

  return (
    <Button
      type="text"
      size={size}
      icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
      onClick={toggle}
      style={{
        borderRadius: 10,
        padding: "8px",
        minWidth: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: mode === "dark" 
          ? "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)"
          : "linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)",
        color: mode === "dark" ? token.colorText : "#667eea",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: mode === "dark" 
          ? "0 2px 8px rgba(255,255,255,0.05)" 
          : "0 2px 8px rgba(102,126,234,0.15)"
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLElement;
        btn.style.transform = "scale(1.08)";
        btn.style.boxShadow = mode === "dark"
          ? "0 4px 12px rgba(255,255,255,0.1)"
          : "0 4px 16px rgba(102,126,234,0.25)";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLElement;
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = mode === "dark"
          ? "0 2px 8px rgba(255,255,255,0.05)"
          : "0 2px 8px rgba(102,126,234,0.15)";
      }}
      title={`切换到${mode === "dark" ? "亮色" : "深色"}模式`}
    />
  );
};

// 带下拉菜单的主题选择器
export const ThemeSelector: React.FC<{ popup?: boolean }> = ({ popup = false }) => {
  const { mode, toggle } = useTheme();
  const { token } = antdTheme.useToken();

  const items = [
    {
      key: "system",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>🖥️</span>
          <span>跟随系统</span>
        </div>
      ),
      onClick: () => {
        localStorage.removeItem("z-tool-theme-mode");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setModeInternal(systemPrefersDark ? "dark" : "light");
      }
    },
    {
      key: "light",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SunOutlined style={{ color: "#fadb14" }} />
          <span>亮色模式</span>
        </div>
      ),
      active: mode === "light",
      onClick: () => setModeInternal("light")
    },
    {
      key: "dark",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MoonOutlined style={{ color: "#667eea" }} />
          <span>深色模式</span>
        </div>
      ),
      active: mode === "dark",
      onClick: () => setModeInternal("dark")
    },
  ];

  const [internalMode, setModeInternal] = useState(mode);

  return (
    <div>
      {items.map(item => (
        <div
          key={item.key}
          onClick={item.onClick}
          style={{
            padding: "10px 14px",
            cursor: "pointer",
            borderRadius: 8,
            background: item.active 
              ? "linear-gradient(90deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)"
              : "transparent",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            fontWeight: item.active ? 600 : 500
          }}
          onMouseEnter={(e) => {
            if (!item.active) {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
            }
          }}
          onMouseLeave={(e) => {
            if (!item.active) {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};
