/**
 * 混合主题示例
 */

import React from 'react';
import { useTheme } from 'z-biz-tool-shared/theme';
import { toastManager } from 'z-biz-tool-shared/notifications';

// 主题混合示例组件
export const ThemeMixinExample: React.FC = () => {
  const { themeColors, setTheme } = useTheme();

  return (
    <div 
      className="p-8"
      style={{ backgroundColor: themeColors.background }}
    >
      <h1 
        className="text-3xl font-bold mb-8"
        style={{ color: themeColors.primary }}
      >
        主题混合示例
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 卡片 1 */}
        <div
          className="p-6 rounded-xl"
          style={{
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`
          }}
        >
          <h3
            className="text-xl font-semibold mb-4"
            style={{ color: themeColors.text }}
          >
            卡片标题
          </h3>
          <p
            className="text-gray-600 dark:text-gray-300"
            style={{ color: themeColors.textSecondary }}
          >
            这是一个卡片内容示例，展示了如何在不同主题下保持一致的视觉效果。
          </p>
        </div>

        {/* 卡片 2 */}
        <div
          className="p-6 rounded-xl"
          style={{
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`
          }}
        >
          <h3
            className="text-xl font-semibold mb-4"
            style={{ color: themeColors.text }}
          >
            组件示例
          </h3>
          <div className="space-y-4">
            <button
              className="px-4 py-2 rounded-lg font-medium"
              style={{
                backgroundColor: themeColors.primary,
                color: themeColors.text
              }}
              onClick={() => toastManager.success('按钮点击成功！')}
            >
              主要按钮
            </button>
            <button
              className="px-4 py-2 rounded-lg font-medium border"
              style={{
                backgroundColor: 'transparent',
                color: themeColors.text,
                borderColor: themeColors.border
              }}
            >
              次要按钮
            </button>
          </div>
        </div>

        {/* 卡片 3 */}
        <div
          className="p-6 rounded-xl"
          style={{
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`
          }}
        >
          <h3
            className="text-xl font-semibold mb-4"
            style={{ color: themeColors.text }}
          >
            主题切换
          </h3>
          <div className="flex flex-wrap gap-2">
            {['dark', 'light', 'dracula', 'nord'].map((theme) => (
              <button
                key={theme}
                onClick={() => setTheme(theme)}
                className="px-3 py-1 rounded text-sm font-medium"
                style={{
                  backgroundColor: themeColors.background,
                  color: themeColors.text,
                  border: `1px solid ${themeColors.border}`
                }}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="mt-8 p-6 rounded-xl"
        style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`
        }}
      >
        <h3
          className="text-xl font-semibold mb-4"
          style={{ color: themeColors.text }}
        >
          设计令牌
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <span
              className="text-sm font-medium"
              style={{ color: themeColors.textSecondary }}
            >
              主色:
            </span>
            <span
              className="inline-block w-4 h-4 ml-2 rounded"
              style={{ backgroundColor: themeColors.primary }}
            />
          </div>
          <div>
            <span
              className="text-sm font-medium"
              style={{ color: themeColors.textSecondary }}
            >
              背景色:
            </span>
            <span
              className="inline-block w-4 h-4 ml-2 rounded"
              style={{ backgroundColor: themeColors.background }}
            />
          </div>
          <div>
            <span
              className="text-sm font-medium"
              style={{ color: themeColors.textSecondary }}
            >
              表面色:
            </span>
            <span
              className="inline-block w-4 h-4 ml-2 rounded"
              style={{ backgroundColor: themeColors.surface }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
