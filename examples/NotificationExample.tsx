// 示例：在新项目中使用统一通知系统

import React from 'react';
import { ToastContainer } from 'z-biz-tool-shared/notifications';
import { toastManager } from 'z-biz-tool-shared/notifications';

// 通知系统示例组件
export const NotificationExample: React.FC = () => {
  const showSuccess = () => {
    toastManager.success('操作成功！');
  };

  const showError = () => {
    toastManager.error('操作失败，请重试');
  };

  const showWarning = () => {
    toastManager.warning('警告：配置即将过期');
  };

  const showInfo = () => {
    toastManager.info('新版本可用');
  };

  const showLongMessage = () => {
    toastManager.success('这是一个很长的成功消息，用于演示通知框的自适应宽度和多行显示能力');
  };

  const showCustomDuration = () => {
    toastManager.success('这个消息会在 5 秒后消失', 5000);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ color: '#FFC131' }}>通知系统示例</h1>
      <p style={{ color: '#b0b0b0' }}>点击按钮查看不同的通知类型</p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginTop: '20px'
      }}>
        <button
          onClick={showSuccess}
          style={{
            padding: '16px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          成功通知
        </button>
        
        <button
          onClick={showError}
          style={{
            padding: '16px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          错误通知
        </button>
        
        <button
          onClick={showWarning}
          style={{
            padding: '16px',
            backgroundColor: '#ff9800',
            color: 'black',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          警告通知
        </button>
        
        <button
          onClick={showInfo}
          style={{
            padding: '16px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          信息通知
        </button>
        
        <button
          onClick={showLongMessage}
          style={{
            padding: '16px',
            backgroundColor: '#9c27b0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          长消息通知
        </button>
        
        <button
          onClick={showCustomDuration}
          style={{
            padding: '16px',
            backgroundColor: '#00bcd4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          自定义时长
        </button>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>通知类型说明</h3>
        <ul style={{ 
          color: '#b0b0b0',
          lineHeight: '1.6'
        }}>
          <li><strong>成功通知</strong> - 绿色背景，用于表示操作成功</li>
          <li><strong>错误通知</strong> - 红色背景，用于表示操作失败</li>
          <li><strong>警告通知</strong> - 黄色背景，用于提醒用户注意</li>
          <li><strong>信息通知</strong> - 蓝色背景，用于传递一般信息</li>
        </ul>
      </div>
      
      {/* 通知容器 - 必须添加到应用根组件 */}
      <ToastContainer />
    </div>
  );
};

// 在应用根组件使用
export const App: React.FC = () => {
  return (
    <div>
      <NotificationExample />
    </div>
  );
};
