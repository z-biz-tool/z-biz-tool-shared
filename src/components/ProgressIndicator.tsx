import React from 'react';

interface ProgressIndicatorProps {
  value: number;
  max?: number;
  message?: string;
  cancellable?: boolean;
  onCancel?: () => void;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  value, 
  max = 100, 
  message,
  cancellable,
  onCancel,
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 ${className}`}>
      {message && (
        <div className="mb-2 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}
      
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="mt-2 text-right text-xs text-gray-500 dark:text-gray-400">
        {Math.round(percentage)}%
      </div>

      {cancellable && onCancel && (
        <div className="mt-3 text-right">
          <button
            onClick={onCancel}
            className="text-xs text-red-500 hover:text-red-600"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
};
