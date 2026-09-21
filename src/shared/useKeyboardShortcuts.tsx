import { useEffect } from "react";

export interface ShortcutSpec {
  /** 主键（如 "k"、"ArrowLeft"） */
  key: string;
  /** 是否需要修饰键（默认不区分大小写，组合键以当前 isMeta/isCtrl/isShift/isAlt 匹配） */
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** 触发时的回调 */
  handler: (e: KeyboardEvent) => void;
  /** 是否允许在输入控件聚焦时触发，默认 false */
  allowInInput?: boolean;
  /** 阻止默认行为，默认 true */
  preventDefault?: boolean;
  /** 描述（用于快捷键面板） */
  description?: string;
}

/**
 * 判断当前焦点是否处于可输入控件内（input/textarea/contenteditable）
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function matchSpec(spec: ShortcutSpec, e: KeyboardEvent): boolean {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  const modKey = isMac ? e.metaKey : e.ctrlKey;

  if (!!spec.meta !== e.metaKey) return false;
  if (!!spec.ctrl !== modKey) return false;
  if (!!spec.shift !== e.shiftKey) return false;
  if (!!spec.alt !== e.altKey) return false;

  // 主键匹配（大小写不敏感 + 支持 " "、"Escape" 等）
  const wanted = spec.key.length === 1 ? spec.key.toLowerCase() : spec.key;
  const actual = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return wanted === actual;
}

/**
 * 全局快捷键 hook。
 * - 焦点在输入控件时默认不响应（可单独覆盖 allowInInput）
 * - 自动 preventDefault（可关闭）
 */
export function useKeyboardShortcuts(specs: ShortcutSpec[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const inEditable = isEditableTarget(e.target);
      for (const spec of specs) {
        if (!matchSpec(spec, e)) continue;
        if (inEditable && !spec.allowInInput) continue;
        if (spec.preventDefault !== false) e.preventDefault();
        spec.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [specs, enabled]);
}

/**
 * 将快捷键规格渲染为可读的键位提示（如 "⌘ + Shift + L"）
 */
export function formatShortcut(spec: ShortcutSpec): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  const parts: string[] = [];
  if (spec.meta || spec.ctrl) parts.push(isMac ? "⌘" : "Ctrl");
  if (spec.alt) parts.push(isMac ? "⌥" : "Alt");
  if (spec.shift) parts.push(isMac ? "⇧" : "Shift");
  let key = spec.key;
  if (key === " ") key = "Space";
  if (key === "ArrowLeft") key = "←";
  if (key === "ArrowRight") key = "→";
  if (key === "ArrowUp") key = "↑";
  if (key === "ArrowDown") key = "↓";
  if (key === "Escape") key = "Esc";
  if (key === "Enter") key = "⏎";
  if (key === "Backspace") key = "⌫";
  parts.push(key);
  return parts.join(" + ");
}

// 快捷键提示组件
export const ShortcutBadge: React.FC<{ spec: ShortcutSpec; size?: "small" | "medium" | "large" }> = ({ 
  spec, 
  size = "small" 
}) => {
  const shortcutText = formatShortcut(spec);
  const sizes = {
    small: { padding: "4px 8px", fontSize: 11, borderRadius: 6 },
    medium: { padding: "6px 10px", fontSize: 12, borderRadius: 8 },
    large: { padding: "8px 12px", fontSize: 13, borderRadius: 10 }
  };
  
  const sizeStyle = sizes[size];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        borderRadius: sizeStyle.borderRadius,
        background: "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)",
        color: "#667eea",
        fontWeight: 500,
        fontFamily: "SF Mono, Monaco, Consolas, monospace",
        border: "1px solid rgba(102,126,234,0.2)",
        boxShadow: "0 2px 4px rgba(102,126,234,0.15)"
      }}
      title={spec.description || shortcutText}
    >
      {shortcutText}
    </span>
  );
};

// 快捷键提示面板
export const ShortcutPanel: React.FC<{ 
  specs: ShortcutSpec[]; 
  title?: string;
  onClose?: () => void;
}> = ({ specs, title = "快捷键", onClose }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 320
      }}
    >
      {title && (
        <div 
          style={{ 
            fontWeight: 600, 
            fontSize: 13, 
            color: "#1a1a2e",
            paddingBottom: 8,
            borderBottom: "2px solid rgba(102,126,234,0.3)"
          }}
        >
          {title}
        </div>
      )}
      
      {specs.map((spec, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: 8,
            background: "linear-gradient(90deg, rgba(102,126,234,0.04) 0%, rgba(118,75,162,0.04) 100%)",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg, rgba(102,126,234,0.04) 0%, rgba(118,75,162,0.04) 100%)";
          }}
        >
          <span 
            style={{ 
              fontSize: 13, 
              color: "#1a1a2e",
              fontWeight: 500,
              flex: 1
            }}
          >
            {spec.description || "快捷键"}
          </span>
          <ShortcutBadge spec={spec} size="small" />
        </div>
      ))}
      
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
        >
          关闭
        </button>
      )}
    </div>
  );
};
