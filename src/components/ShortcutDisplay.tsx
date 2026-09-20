import React from 'react';

interface ShortcutDisplayProps {
  shortcuts: string[];
  className?: string;
}

export const ShortcutDisplay: React.FC<ShortcutDisplayProps> = ({ 
  shortcuts, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {shortcuts.map((shortcut, index) => (
        <div
          key={index}
          className="px-2 py-1 bg-gray-700 rounded text-xs font-mono text-gray-300"
        >
          {shortcut}
        </div>
      ))}
    </div>
  );
};
