/**
 * Toast 通知组件
 * 
 * 用于显示临时的成功/错误/信息提示
 */

import { useEffect } from 'react';
import { CircleCheck, XCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number; // 自动关闭时间（毫秒），0 表示不自动关闭
}

export function Toast({ type, message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: CircleCheck,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  };

  const Icon = icons[type];

  return (
    <div className={`toast toast--${type}`}>
      <Icon className="toast__icon" />
      <span className="toast__message">{message}</span>
      <button onClick={onClose} className="toast__close">
        ×
      </button>
    </div>
  );
}
