/**
 * 固件详情页面 - 用户端
 * 
 * 功能：
 * - 显示固件详细信息
 * - 显示支持的开发板
 * - 兼容性检查
 * - 烧录到设备按钮
 * - 下载固件包按钮
 * - 集成 Web Serial API 烧录
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Download,
  Zap,
  Cpu,
  Tag,
  AlertTriangle,
  CircleCheck,
  XCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import { FirmwareClient, FirmwareApiError } from '../api/firmwareClient';
import { FirmwareUploader, type UploadProgress } from '../utils/firmwareUploader';
import type { FirmwareMetadata, BoardInfo, FlashFile } from '../api/types';

export function FirmwareDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [firmware, setFirmware] = useState<FirmwareMetadata | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 烧录状态
  const [flashing, setFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<UploadProgress | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [flashSuccess, setFlashSuccess] = useState(false);
  
  // 兼容性检查
  const [currentBoardId, setCurrentBoardId] = useState<string | undefined>();
  const [showCompatibilityWarning, setShowCompatibilityWarning] = useState(false);
  
  // 加载固件详情
  useEffect(() => {
    const loadFirmwareDetail = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await FirmwareClient.getFirmwareDetail(id);
        setFirmware(data);
      } catch (err) {
        if (err instanceof FirmwareApiError) {
          setError(err.message);
        } else {
          setError('加载固件详情失败，请稍后重试');
        }
        console.error('Failed to load firmware detail:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadFirmwareDetail();
  }, [id]);
  
  // 加载开发板列表
  useEffect(() => {
    const loadBoards = async () => {
      try {
        const response = await fetch('/api/boards');
        const data = await response.json();
        setBoards(data.boards || []);
      } catch (err) {
        console.error('Failed to load boards:', err);
      }
    };
    
    loadBoards();
  }, []);
  
  // 获取当前检测的开发板
  useEffect(() => {
    const detectedBoard = localStorage.getItem('detectedBoardId');
    if (detectedBoard) {
      setCurrentBoardId(detectedBoard);
    }
  }, []);
  
  // 检查兼容性
  const isCompatible = currentBoardId && firmware
    ? firmware.supported_board_ids.includes(currentBoardId)
    : false;
  
  // 获取开发板名称
  const getBoardName = useCallback((boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    return board?.name || boardId;
  }, [boards]);
  
  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
  };
  
  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // 下载固件包
  const handleDownload = async () => {
    if (!firmware) return;
    
    try {
      const blob = await FirmwareClient.downloadFirmware(firmware.firmware_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${firmware.project_name}_v${firmware.version}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('下载失败，请稍后重试');
    }
  };
  
  // 烧录固件
  const handleFlash = async () => {
    if (!firmware) return;
    
    // 检查浏览器支持
    if (!FirmwareUploader.isSupported()) {
      alert('您的浏览器不支持 Web Serial API，请使用 Chrome、Edge 或 Opera 浏览器');
      return;
    }
    
    // 检查兼容性
    if (!isCompatible && currentBoardId) {
      setShowCompatibilityWarning(true);
      return;
    }
    
    await performFlash();
  };
  
  // 执行烧录
  const performFlash = async () => {
    if (!firmware) return;
    
    setFlashing(true);
    setFlashError(null);
    setFlashSuccess(false);
    setFlashProgress(null);
    setShowCompatibilityWarning(false);
    
    try {
      // 转换文件格式
      const flashFiles: FlashFile[] = firmware.files.map(file => ({
        name: file.name,
        address: file.address,
        size: file.size,
        role: file.role
      }));
      
      // 执行烧录
      await FirmwareUploader.upload(
        firmware.firmware_id,
        flashFiles,
        (progress) => {
          setFlashProgress(progress);
        }
      );
      
      // 烧录成功
      setFlashSuccess(true);
      
      // 记录烧录事件
      await FirmwareClient.logFlashEvent(firmware.firmware_id, true);
      
    } catch (err) {
      console.error('Flash failed:', err);
      setFlashError(err instanceof Error ? err.message : '烧录失败');
      
      // 记录烧录失败事件
      if (firmware) {
        await FirmwareClient.logFlashEvent(firmware.firmware_id, false);
      }
    } finally {
      setFlashing(false);
    }
  };
  
  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-[#edf6fb] p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回固件库</span>
          </button>
          
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">加载固件详情中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // 错误状态
  if (error || !firmware) {
    return (
      <div className="min-h-screen bg-[#edf6fb] p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回固件库</span>
          </button>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">加载失败</h3>
            <p className="text-red-700">{error || '固件不存在'}</p>
          </div>
        </div>
      </div>
    );
  }
  
  // 正常显示
  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回固件库</span>
        </button>
        
        {/* 固件头部 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex gap-6">
            {/* 缩略图 */}
            <div className="flex-shrink-0">
              {firmware.has_thumbnail ? (
                <img
                  src={FirmwareClient.getThumbnailUrl(firmware.firmware_id)}
                  alt={firmware.project_name}
                  className="w-48 h-48 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <div className="w-48 h-48 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                  <Cpu className="w-20 h-20 text-gray-400" />
                </div>
              )}
            </div>
            
            {/* 基本信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {firmware.project_name}
                  </h1>
                  <p className="text-lg text-slate-600">
                    版本 {firmware.version}
                  </p>
                </div>
                
                {/* 兼容性标记 */}
                {currentBoardId && (
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    isCompatible
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isCompatible ? '✓ 兼容' : '⚠ 检查兼容性'}
                  </div>
                )}
              </div>
              
              {/* 标签 */}
              {firmware.tags.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Tag className="w-4 h-4 text-gray-400" />
                  {firmware.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* 统计信息 */}
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <span>{firmware.download_count} 次下载</span>
                <span>{firmware.flash_count} 次烧录</span>
                <span>发布于 {formatDate(firmware.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 描述 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">项目描述</h2>
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
            {firmware.description}
          </p>
        </div>
        
        {/* 支持的开发板 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-600" />
            <span>支持的开发板</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {firmware.supported_board_ids.map((boardId) => (
              <div
                key={boardId}
                className={`px-4 py-3 rounded-lg border-2 ${
                  boardId === currentBoardId
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 bg-[#edf6fb]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {getBoardName(boardId)}
                  </span>
                  {boardId === currentBoardId && (
                    <CircleCheck className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* 固件文件 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">固件文件</h2>
          <div className="space-y-2">
            {firmware.files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between px-4 py-3 bg-[#edf6fb] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <code className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">
                    0x{file.address.toString(16).toUpperCase()}
                  </code>
                  <span className="font-medium text-slate-900">{file.name}</span>
                  <span className="text-sm text-slate-500">({file.role})</span>
                </div>
                <span className="text-sm text-slate-600">
                  {formatSize(file.size)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">总大小</span>
              <span className="text-lg font-bold text-blue-600">
                {formatSize(firmware.total_size)}
              </span>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 烧录按钮 */}
            <button
              onClick={handleFlash}
              disabled={flashing}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              {flashing ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span>烧录中...</span>
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6" />
                  <span>烧录到设备</span>
                </>
              )}
            </button>
            
            {/* 下载按钮 */}
            <button
              onClick={handleDownload}
              disabled={flashing}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-600 text-white rounded-lg font-semibold text-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              <Download className="w-6 h-6" />
              <span>下载固件包</span>
            </button>
          </div>
          
          {/* 烧录进度 */}
          {flashing && flashProgress && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="font-semibold text-blue-900">
                  {flashProgress.message}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${flashProgress.percentage}%` }}
                />
              </div>
              <div className="text-right text-sm text-blue-700 mt-1">
                {flashProgress.percentage}%
              </div>
            </div>
          )}
          
          {/* 烧录成功 */}
          {flashSuccess && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CircleCheck className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">烧录成功！</p>
                  <p className="text-sm text-green-700">
                    固件已成功烧录到设备，设备正在重启...
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 烧录错误 */}
          {flashError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">烧录失败</p>
                  <p className="text-sm text-red-700">{flashError}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* 提示信息 */}
          {!flashing && !flashSuccess && (
            <div className="mt-6 p-4 bg-[#edf6fb] border border-slate-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                  <p className="font-semibold mb-1">烧录提示：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>请确保设备已通过 USB 连接到电脑</li>
                    <li>烧录过程中请勿断开设备连接</li>
                    <li>烧录完成后设备会自动重启</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* 兼容性警告对话框 */}
        {showCompatibilityWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <AlertTriangle className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    兼容性警告
                  </h3>
                  <p className="text-slate-700 mb-2">
                    您的开发板（{getBoardName(currentBoardId!)}）可能与此固件不兼容。
                  </p>
                  <p className="text-slate-700">
                    支持的开发板：{firmware.supported_board_ids.map(getBoardName).join('、')}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompatibilityWarning(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-slate-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={performFlash}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
                >
                  继续烧录
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
