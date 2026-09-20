import { Tabs, Button, Tooltip } from "antd";
import { PlusOutlined, CloseOutlined, BookOutlined, PictureOutlined, FolderOpenOutlined } from "@ant-design/icons";

interface Props {
  onOpenNewTab: () => void;
  onSwitchTo: (path: string) => void;
}

// 渐变色定义
const brandGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
const tabHoverGradient = "linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)";

/** 把绝对路径压缩成 tab 标题：~/Downloads/foo */
function tabTitle(path: string): string {
  if (!path || path === "/") return "/";
  const home = "/Users/zifang";
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~/" + path.slice(home.length + 1);
  return path;
}

/** 不同类型 tab 的图标 */
function tabIcon(kind: string): React.ReactNode {
  if (kind === "library") return <BookOutlined style={{ fontSize: 13, color: '#667eea' }} />;
  if (kind === "media") return <PictureOutlined style={{ fontSize: 13, color: '#764ba2' }} />;
  return <FolderOpenOutlined 
    style={{ 
      fontSize: 13, 
      background: brandGradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text"
    }} 
  />;
}

export default function TabsBar({ onOpenNewTab, onSwitchTo }: Props) {
  // 注意：这里需要从外部传入 tabs 数据，具体实现由调用方决定
  // 示例中使用 mock 数据展示效果
  const tabs = [] as Array<{ id: string; path: string; kind: "directory" | "library" | "media" }>;
  const activeTabId = "" as string;
  const closeTab = (id: string) => {};
  const switchTab = (id: string) => {};

  if (tabs.length === 0) return null;

  const items = tabs.map((t) => {
    const title = tabTitle(t.path);
    return {
      key: t.id,
      label: (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            maxWidth: 200,
            userSelect: "none",
            padding: "6px 12px",
            borderRadius: 10,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            position: 'relative' as const,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onOpenNewTab();
          }}
          onMouseEnter={(ev) => {
            const el = ev.currentTarget as HTMLElement;
            if (!el.classList.contains('ant-tabs-tab-active')) {
              el.style.background = tabHoverGradient;
              el.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(ev) => {
            const el = ev.currentTarget as HTMLElement;
            if (!el.classList.contains('ant-tabs-tab-active')) {
              el.style.background = "transparent";
              el.style.transform = 'translateY(0)';
            }
          }}
        >
          {/* Tab 激活指示器 */}
          {activeTabId === t.id && (
            <div 
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40%',
                height: '3px',
                background: brandGradient,
                borderRadius: 2,
                boxShadow: '0 2px 4px rgba(102,126,234,0.3)'
              }}
            />
          )}
          
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 180,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title={t.path}
          >
            <span style={{ flexShrink: 0 }}>{tabIcon(t.kind)}</span>
            <span 
              style={{ 
                fontWeight: activeTabId === t.id ? 600 : 500,
                transition: 'color 0.2s ease'
              }}
            >
              {title}
            </span>
          </span>
        </span>
      ),
      closable: tabs.length > 1,
      closeIcon: (
        <span
          onClick={(e) => {
            e.stopPropagation();
            closeTab(t.id);
          }}
          style={{ 
            fontSize: 12, 
            padding: "2px",
            borderRadius: 6,
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "pointer" as const,
            opacity: 0,
          }}
          aria-label={`关闭 tab ${title}`}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.opacity = "1";
            el.style.background = "#ff4d4f";
            el.style.color = "white";
            el.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            if (!el.closest('.ant-tabs-tab-active')) {
              el.style.opacity = "0";
              el.style.background = "transparent";
              el.style.color = "var(--ant-color-text-secondary)";
              el.style.transform = "scale(1)";
            }
          }}
        >
          <CloseOutlined />
        </span>
      ),
    };
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "linear-gradient(180deg, #f8fafd 0%, #eef2f7 100%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 6,
        paddingBottom: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        gap: 6,
      }}
    >
      <style>{`
        .ant-tabs-tab:hover .tab-close-btn {
          opacity: 1 !important;
        }
        
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .ant-tabs-tab {
          animation: slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      
      <Tabs
        type="editable-card"
        hideAdd
        size="small"
        activeKey={activeTabId ?? undefined}
        onChange={(key) => {
          switchTab(key as string);
          const tab = tabs.find((t) => t.id === key);
          if (tab && tab.kind === "directory") onSwitchTo(tab.path);
        }}
        onEdit={(targetKey, action) => {
          if (action === "remove") {
            closeTab(targetKey as string);
          }
        }}
        items={items}
        style={{ flex: 1, minHeight: 32 }}
        tabBarStyle={{ margin: 0, borderBottom: "none" }}
        cardGutter={6}
      />
      
      <Tooltip title="新建标签页 (⌘+T)">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={onOpenNewTab}
          style={{ 
            borderRadius: 10,
            background: brandGradient,
            color: "white",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            minWidth: '32px',
            height: '32px',
            padding: '0',
            boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="新建标签页"
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLElement;
            btn.style.transform = "scale(1.08)";
            btn.style.boxShadow = "0 4px 12px rgba(102,126,234,0.4)";
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLElement;
            btn.style.transform = "scale(1)";
            btn.style.boxShadow = "0 2px 8px rgba(102,126,234,0.3)";
          }}
        />
      </Tooltip>
    </div>
  );
}
