import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { theme as antdTheme, Button } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import {
  isThemePreference,
  nextPreference,
  readStoredPreference,
  resolveThemeMode,
  writeStoredPreference,
  type ResolvedThemeMode,
  type ThemePreference,
} from "../theme/themeMode";

interface ThemeContextType {
  mode: ResolvedThemeMode;
  /** 用户偏好：跟随系统 / 强制亮色 / 强制暗色 */
  preference: ThemePreference;
  toggle: () => void;
  /** 设置偏好；传 'system' 表示回到跟随系统 */
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** 系统是否偏好暗色；无 window（SSR / Node 测试）时按亮色处理 */
function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const stored = readStoredPreference(window.localStorage);
    if (stored) return stored;
    return "system";
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());

  const mode = resolveThemeMode(preference, systemDark);

  // 同步到 localStorage 和 HTML 元素
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      writeStoredPreference(window.localStorage, preference);
    } catch {
      /* 容量满或隐私模式，忽略 */
    }

    // 同步到 HTML 元素
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode, preference]);

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemDark(mediaQuery.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setPreference = (next: ThemePreference) => {
    if (!isThemePreference(next)) return;
    setPreferenceState(next);
  };

  const toggle = () => {
    setPreferenceState((prev) => nextPreference(prev, mode));
  };

  return (
    <ThemeContext.Provider value={{ mode, preference, toggle, setPreference }}>
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
export const ThemeSelector: React.FC<{ popup?: boolean }> = ({ popup: _popup = false }) => {
  const { mode, preference, setPreference } = useTheme();
  const { token: _token } = antdTheme.useToken();

  // A-8：此前这里的 onClick 调的是 setModeInternal —— 一个
  // `const [, setModeInternal] = useState(mode)` 的 setter，
  // **它改的 state 从来没被读取过**（解构里第一个位置是空位）。
  // 于是"跟随系统/亮色/暗色"三个选项点了都没反应，组件是死的。
  // 现在改为调用 context 暴露的 setPreference，直接改真正被消费的偏好。
  const items = [
    {
      key: "system",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>🖥️</span>
          <span>跟随系统</span>
        </div>
      ),
      active: preference === "system",
      onClick: () => setPreference("system")
    },
    {
      key: "light",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SunOutlined style={{ color: "#fadb14" }} />
          <span>亮色模式</span>
        </div>
      ),
      active: preference === "light",
      onClick: () => setPreference("light")
    },
    {
      key: "dark",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MoonOutlined style={{ color: "#667eea" }} />
          <span>深色模式</span>
        </div>
      ),
      active: preference === "dark",
      onClick: () => setPreference("dark")
    },
  ];

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
