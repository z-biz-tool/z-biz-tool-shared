/**
 * 交互设计规范
 * z-biz-tool 交互设计指南
 */

/**
 * 交互原则
 * 1. 直观 - 用户无需思考就知道如何操作
 * 2. 反馈 - 每个操作都有明确的反馈
 * 3. 一致 - 相似操作保持一致的行为
 * 4. 效率 - 提供快捷键和快速操作
 * 5. 安全 - 防止误操作，支持撤销
 */

// 交互模式
export const INTERACTION_PATTERNS = {
  // 快捷键模式
  keyboard: {
    spotlight: 'Cmd+Shift+Space',
    commandPalette: 'Cmd+K',
    search: 'Cmd+F',
    settings: 'Cmd+,',
    help: 'F1'
  },
  
  // 操作反馈模式
  feedback: {
    success: {
      duration: 3000,
      animation: 'slide-in',
      icon: 'check'
    },
    error: {
      duration: 5000,
      animation: 'slide-in',
      icon: 'x'
    },
    warning: {
      duration: 4000,
      animation: 'slide-in',
      icon: 'warning'
    },
    info: {
      duration: 3000,
      animation: 'slide-in',
      icon: 'info'
    }
  },
  
  // 加载状态模式
  loading: {
    spinner: {
      duration: 1500,
      animation: 'spin'
    },
    skeleton: {
      duration: 1000,
      animation: 'pulse'
    }
  },
  
  // 空状态模式
  empty: {
    icon: 'file',
    title: '暂无数据',
    description: '点击按钮添加新内容',
    action: '添加'
  }
};

// 用户操作流程
export const USER_FLOWS = {
  // 快速操作流程
  quickAction: {
    trigger: '快捷键',
    destination: 'Spotlight',
    actions: ['搜索', '选择', '执行'],
    completion: '自动关闭'
  },
  
  // 文件操作流程
  fileOperation: {
    steps: ['选择文件', '选择操作', '确认执行', '查看结果'],
    undoable: true,
    progress: true
  },
  
  // AI 操作流程
  aiOperation: {
    trigger: '输入提示词',
    processing: 'AI 分析',
    result: '展示结果',
    followUp: ['继续对话', '复制内容', '保存到知识库']
  }
};

// 交互反馈组件
export const InteractionFeedback = {
  // 快速反馈
  toast: {
    showSuccess: (message: string, duration?: number) => {},
    showError: (message: string, duration?: number) => {},
    showWarning: (message: string, duration?: number) => {},
    showInfo: (message: string, duration?: number) => {}
  },
  
  // 持久反馈
  progress: {
    show: (message: string, value: number) => {},
    update: (value: number) => {},
    complete: () => {},
    cancel: () => {}
  },
  
  // 视觉反馈
  highlight: {
    element: (element: HTMLElement, color?: string) => {},
    line: (line: number, color?: string) => {}
  }
};

// 拖拽交互规范
export const DRAG_DROP = {
  // 拖拽开始
  start: {
    delay: 0,
    minDistance: 5,
    ghostOpacity: 0.8
  },
  
  // 拖拽过程
  during: {
    cursor: 'grabbing',
    snap: true,
    preview: true
  },
  
  // 拖拽结束
  end: {
    dropZoneHighlight: true,
    animation: 'slide',
    callback: (dropped: boolean) => {}
  }
};

// 点击交互规范
export const CLICK = {
  // 单击
  single: {
    delay: 0,
    action: '选择/打开',
    visual: 'highlight'
  },
  
  // 双击
  double: {
    delay: 300,
    action: '编辑/打开',
    visual: 'expand'
  },
  
  // 右键
  right: {
    action: '上下文菜单',
    position: 'mouse'
  }
};

// 键盘交互规范
export const KEYBOARD = {
  // 导航
  navigation: {
    arrowUp: '上移',
    arrowDown: '下移',
    arrowLeft: '左移',
    arrowRight: '右移',
    pageUp: '上一页',
    pageDown: '下一页'
  },
  
  // 操作
  actions: {
    enter: '执行/确认',
    escape: '取消/关闭',
    delete: '删除',
    tab: '切换焦点',
    shiftTab: '反向切换焦点'
  },
  
  // 组合键
  shortcuts: {
    cmdC: '复制',
    cmdV: '粘贴',
    cmdX: '剪切',
    cmdA: '全选',
    cmdZ: '撤销',
    cmdShiftZ: '重做'
  }
};
