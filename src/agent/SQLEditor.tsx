// SQL 编辑器 - 共享组件
import { useState } from 'react';
import { Card, Button, Space, Typography, message } from 'antd';
import { PlayOutlined, CopyOutlined, SaveOutlined } from '@ant-design/icons';
import ReactCodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';

const { Text } = Typography;

interface SQLEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onExecute?: (sql: string) => Promise<any>;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  value = '',
  onChange,
  onExecute,
}) => {
  const [sql, setSql] = useState(value);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!sql.trim()) {
      message.warning('SQL 不能为空');
      return;
    }

    setIsExecuting(true);
    try {
      const result = await onExecute?.(sql);
      message.success('查询执行成功');
      // TODO: 显示结果
    } catch (error: any) {
      message.error('查询执行失败: ' + error.message);
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
            icon={<PlayOutlined />}
            loading={isExecuting}
            onClick={handleExecute}
          >
            执行
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(sql);
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
      <div style={{ height: '400px' }}>
        <ReactCodeMirror
          value={sql}
          onChange={(val) => {
            setSql(val);
            onChange?.(val);
          }}
          extensions={[sql()]}
          theme="dark"
          style={{
            fontSize: '14px',
            height: '100%',
            fontFamily: 'monospace',
          }}
        />
      </div>
    </Card>
  );
};

export default SQLEditor;
