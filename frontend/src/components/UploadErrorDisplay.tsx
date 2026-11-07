/**
 * 上传错误显示组件
 * 
 * 用于显示固件上传错误，提供解决步骤提示
 */

import { 
  AlertTriangle,
  LightbulbIcon
} from 'lucide-react';

interface UploadErrorDisplayProps {
  error: string;
}

// 常见上传错误和解决方案
const UPLOAD_ERROR_SOLUTIONS: Record<string, { icon: string; title: string; steps: string[] }> = {
  'port is already open': {
    icon: '🔒',
    title: '串口已被占用',
    steps: [
      '关闭其他可能使用串口的程序（Arduino IDE、串口监视器等）',
      '拔出并重新插入 ESP32 设备',
      '刷新页面后重试'
    ]
  },
  'No port selected': {
    icon: '🔌',
    title: '未选择串口',
    steps: [
      '点击"上传到设备"按钮',
      '在弹出的对话框中选择正确的串口',
      '如果没有看到串口，请检查设备连接'
    ]
  },
  'Failed to execute.*SerialPort': {
    icon: '🚫',
    title: '串口访问被拒绝',
    steps: [
      '确认已授予浏览器串口访问权限',
      '检查设备是否正确连接',
      '尝试使用其他 USB 端口',
      '确认使用的是 Chrome、Edge 或 Opera 浏览器'
    ]
  },
  'Timeout': {
    icon: '⏱️',
    title: '连接超时',
    steps: [
      '检查 USB 线缆是否正常（建议使用数据线而非充电线）',
      '确认设备驱动已正确安装',
      '尝试按住 BOOT 按钮后点击上传',
      '检查设备是否处于下载模式'
    ]
  },
  'device disconnected': {
    icon: '🔌',
    title: '设备断开连接',
    steps: [
      '检查 USB 连接是否松动',
      '更换 USB 线缆或端口',
      '重新连接设备后重试'
    ]
  }
};

// 匹配错误消息
function matchErrorSolution(error: string): { icon: string; title: string; steps: string[] } | null {
  for (const [pattern, solution] of Object.entries(UPLOAD_ERROR_SOLUTIONS)) {
    if (new RegExp(pattern, 'i').test(error)) {
      return solution;
    }
  }
  return null;
}

export function UploadErrorDisplay({ error }: UploadErrorDisplayProps) {
  const solution = matchErrorSolution(error);
  
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5 animate-fade-in">
      {/* 错误标题 */}
      <div className="flex items-center space-x-2 mb-3">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <h3 className="text-base font-semibold text-red-300">
          上传失败
        </h3>
      </div>
      
      {/* 错误消息 */}
      <div className="mb-4 p-3 bg-red-500/5 border border-red-500/20 rounded">
        <p className="text-sm text-red-300 font-mono break-words">
          {error}
        </p>
      </div>
      
      {/* 解决方案 */}
      {solution ? (
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-2xl">{solution.icon}</span>
            <span className="text-sm font-semibold text-orange-300">
              {solution.title}
            </span>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs text-orange-300 font-medium mb-2 flex items-center">
              <LightbulbIcon className="w-4 h-4 mr-1.5" />
              解决步骤：
            </p>
            <ol className="space-y-2">
              {solution.steps.map((step, index) => (
                <li key={index} className="text-xs text-orange-200 flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 bg-orange-500/20 text-orange-300 rounded-full flex items-center justify-center mr-2 text-xs font-semibold border border-orange-500/30">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
          <p className="text-xs text-yellow-300 flex items-center mb-2">
            <LightbulbIcon className="w-4 h-4 mr-1.5" />
            <strong>通用解决方案：</strong>
          </p>
          <ul className="space-y-1.5 ml-6">
            <li className="text-xs text-yellow-200 flex items-start">
              <span className="mr-2">•</span>
              <span>检查设备连接和 USB 线缆</span>
            </li>
            <li className="text-xs text-yellow-200 flex items-start">
              <span className="mr-2">•</span>
              <span>确认浏览器已授予串口访问权限</span>
            </li>
            <li className="text-xs text-yellow-200 flex items-start">
              <span className="mr-2">•</span>
              <span>关闭其他可能占用串口的程序</span>
            </li>
            <li className="text-xs text-yellow-200 flex items-start">
              <span className="mr-2">•</span>
              <span>尝试重新插拔设备</span>
            </li>
          </ul>
        </div>
      )}
      
      {/* 帮助链接 */}
      <div className="mt-4 pt-4 border-t border-red-500/20">
        <p className="text-xs text-gray-400 text-center">
          如果问题仍然存在，请检查设备驱动是否正确安装
        </p>
      </div>
    </div>
  );
}
