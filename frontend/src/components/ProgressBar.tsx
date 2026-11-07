/**
 * 进度条组件
 * 
 * 用于显示上传进度
 */

interface ProgressBarProps {
  progress: number; // 0-100
  message?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  showPercentage?: boolean;
}

export function ProgressBar({ 
  progress, 
  message, 
  color = 'blue',
  showPercentage = true 
}: ProgressBarProps) {
  // 确保进度在 0-100 之间
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600'
  };
  
  const bgColorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100'
  };
  
  return (
    <div className="w-full space-y-2">
      {/* 进度条 */}
      <div className={`w-full h-3 ${bgColorClasses[color]} rounded-full overflow-hidden`}>
        <div 
          className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out rounded-full`}
          style={{ width: `${clampedProgress}%` }}
        >
          {/* 动画效果 */}
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
        </div>
      </div>
      
      {/* 消息和百分比 */}
      <div className="flex items-center justify-between text-sm">
        {message && (
          <span className="text-gray-600 font-medium">{message}</span>
        )}
        {showPercentage && (
          <span className="text-gray-700 font-semibold ml-auto">
            {clampedProgress}%
          </span>
        )}
      </div>
    </div>
  );
}
