// SQL 编辑器 - 共享组件（无外部编辑器依赖）
import { useState } from 'react';
import { Card, Button, Space, Input, message } from 'antd';
import { PlayCircleOutlined, CopyOutlined, SaveOutlined } from '@ant-design/icons';
import { errorMessage } from '../shared/errorMessage';

interface SQLEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  /**
   * 执行回调的返回值。
   *
   * 此前是 `Promise<any>`（01 A-13）—— any 直接暴露在公共 API 面上。
   * 组件自己并不消费返回值（只关心成功/失败），用 unknown 表达
   * "结果形状由调用方决定"，不撒谎也不限制调用方。
   */
  onExecute?: (sql: string) => Promise<unknown>;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  value = '',
  onChange,
  onExecute,
}) => {
  const [code, setCode] = useState(value);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!code.trim()) {
      message.warning('SQL 不能为空');
      return;
    }

    setIsExecuting(true);
    try {
      await onExecute?.(code);
      message.success('查询执行成功');
    } catch (error) {
      message.error('查询执行失败: ' + errorMessage(error));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card
      title="SQL 编辑器"
      extra={
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={isExecuting}
            onClick={handleExecute}
          >
            执行
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(code);
              message.success('已复制到剪贴板');
            }}
          >
            复制
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={() => {
              message.success('SQL 已保存');
            }}
          >
            保存
          </Button>
        </Space>
      }
    >
      <Input.TextArea
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder="输入 SQL..."
        rows={14}
        style={{
          fontFamily: 'SF Mono, Monaco, Consolas, monospace',
          fontSize: 13,
        }}
      />
    </Card>
  );
};

export default SQLEditor;
