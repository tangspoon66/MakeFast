/**
 * 错误显示组件
 * 
 * 用于显示编译错误，提供友好的错误提示和解决建议
 */

import { 
  AlertCircle, 
  AlertTriangle,
  LightbulbIcon,
  MapPinIcon
} from 'lucide-react';

interface CompileError {
  type: 'error' | 'warning';
  line: number;
  message: string;
  hint?: string;
}

interface ErrorDisplayProps {
  errors: CompileError[];
  onLineClick?: (line: number) => void;
}

// 常见错误模式和友好提示
const ERROR_PATTERNS = [
  {
    pattern: /was not declared in this scope/i,
    icon: '🔍',
    title: '未声明的标识符',
    suggestions: [
      '检查变量或函数名是否拼写正确',
      '确认是否包含了必要的库（#include）',
      '检查变量是否在使用前已定义'
    ]
  },
  {
    pattern: /expected.*before/i,
    icon: '📝',
    title: '语法错误',
    suggestions: [
      '检查是否缺少分号（;）',
      '检查括号是否配对（()、{}、[]）',
      '检查是否缺少逗号或其他标点符号'
    ]
  },
  {
    pattern: /invalid conversion/i,
    icon: '🔄',
    title: '类型转换错误',
    suggestions: [
      '检查变量类型是否匹配',
      '使用正确的类型转换函数',
      '确认函数参数类型是否正确'
    ]
  },
  {
    pattern: /does not name a type/i,
    icon: '❓',
    title: '未知类型',
    suggestions: [
      '检查是否包含了定义该类型的库',
      '检查类型名称是否拼写正确',
      '确认库的版本是否兼容'
    ]
  },
  {
    pattern: /no matching function/i,
    icon: '🎯',
    title: '函数调用错误',
    suggestions: [
      '检查函数参数数量是否正确',
      '检查参数类型是否匹配',
      '确认函数是否存在该重载版本'
    ]
  }
];

// 根据错误消息匹配友好提示
function getErrorSuggestions(message: string): { icon: string; title: string; suggestions: string[] } | null {
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(message)) {
      return pattern;
    }
  }
  return null;
}

export function ErrorDisplay({ errors, onLineClick }: ErrorDisplayProps) {
  if (!errors || errors.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-3 animate-fade-in">
      {errors.map((error, index) => {
        const suggestions = getErrorSuggestions(error.message);
        
        return (
          <div 
            key={index} 
            className="bg-gray-900 rounded-lg p-4 border border-red-500/30 hover:border-red-500/50 transition-colors"
          >
            {/* 错误头部 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 ${
                  error.type === 'error' 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {error.type === 'error' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>{error.type === 'error' ? '错误' : '警告'}</span>
                </span>
                {error.line > 0 && (
                  <button
                    onClick={() => onLineClick?.(error.line)}
                    className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded-full text-xs font-medium text-gray-300 transition-colors cursor-pointer flex items-center space-x-1.5 border border-gray-700"
                    title="点击跳转到错误行"
                  >
                    <MapPinIcon className="w-4 h-4" />
                    <span>第 {error.line} 行</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* 错误消息 */}
            <div className="mb-3">
              <p className="text-sm text-red-300 font-mono bg-red-500/5 p-3 rounded border border-red-500/20">
                {error.message}
              </p>
            </div>
            
            {/* 原始提示 */}
            {error.hint && (
              <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                <p className="text-xs text-blue-300 flex items-start">
                  <LightbulbIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error.hint}</span>
                </p>
              </div>
            )}
            
            {/* 增强的友好提示 */}
            {suggestions && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">{suggestions.icon}</span>
                  <span className="text-sm font-semibold text-purple-300">
                    {suggestions.title}
                  </span>
                </div>
                <ul className="space-y-1.5 ml-7">
                  {suggestions.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="text-xs text-purple-200 flex items-start">
                      <span className="mr-2 text-purple-400">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
      
      {/* 总结 */}
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
        <p className="text-xs text-gray-400 text-center">
          共发现 <span className="font-semibold text-red-400">{errors.length}</span> 个问题
          {errors.length > 1 && '，建议从第一个错误开始修复'}
        </p>
      </div>
    </div>
  );
}
