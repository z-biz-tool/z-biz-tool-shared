import React from 'react';

interface StateIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'idle' | 'error';
  label: string;
  lastUpdate?: string;
  progress?: number;
  className?: string;
}

const statusColors: Record<StateIndicatorProps['status'], string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  busy: 'bg-yellow-500',
  idle: 'bg-green-500',
  error: 'bg-red-500'
};

export const StateIndicator: React.FC<StateIndicatorProps> = ({ 
  status, 
  label, 
  lastUpdate,
  progress,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${statusColors[status]} animate-pulse`} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      
      {progress !== undefined && (
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      {lastUpdate && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {lastUpdate}
        </span>
      )}
    </div>
  );
};
