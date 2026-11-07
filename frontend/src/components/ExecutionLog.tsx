/**
 * 执行日志组件
 * 
 * 可折叠的日志面板，显示编译和上传的详细信息
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';

export interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface ExecutionLogProps {
  logs: LogEntry[];
  onClear?: () => void;
}

export function ExecutionLog({ logs, onClear }: ExecutionLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className={`execution-log ${isExpanded ? 'execution-log--expanded' : ''}`}>
      <button
        className="execution-log__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <FileText className="execution-log__icon" />
        <span>执行日志 ({logs.length})</span>
        {isExpanded ? (
          <ChevronUp className="execution-log__toggle" />
        ) : (
          <ChevronDown className="execution-log__toggle" />
        )}
      </button>

      {isExpanded && (
        <div className="execution-log__content">
          <div className="execution-log__toolbar">
            {onClear && (
              <button onClick={onClear} className="execution-log__clear">
                清空日志
              </button>
            )}
          </div>
          <div className="execution-log__entries">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry log-entry--${log.type}`}>
                <span className="log-entry__time">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className="log-entry__message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
