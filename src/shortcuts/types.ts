// 快捷键配置类型
export interface ShortcutConfig {
  key: string;
  description: string;
  category?: string;
  action: () => void;
  enabled?: boolean;
}
