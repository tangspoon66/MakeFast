/**
 * 设备检测器组件
 * 
 * 实时检测和显示连接的 ESP 设备，支持自动识别芯片型号
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  RefreshCw,
  AlertTriangle,
  Search,
  Info,
  Sparkles,
  X
} from 'lucide-react';
import { 
  detectChipFromPort,
  getAuthorizedPorts,
  waitForNewDevice,
  getRecommendedBoardId, 
  formatFlashSize, 
  formatMacAddress,
  type ChipDetectionResult 
} from '../utils/chipDetector';
import { useEditorStore } from '../store/editorStore';

interface DeviceInfo {
  vendorId: number;
  productId: number;
  name: string;
  connected: boolean;
}

interface DeviceDetectorProps {
  variant?: 'card' | 'compact';
}

const KNOWN_DEVICES = [
  { vendorId: 0x10c4, productId: 0xea60, name: 'CP210x USB to UART' },
  { vendorId: 0x1a86, productId: 0x7523, name: 'CH340 USB to UART' },
  { vendorId: 0x0403, productId: 0x6001, name: 'FTDI USB to UART' },
  { vendorId: 0x303a, productId: 0x1001, name: 'ESP32-S2/S3/C3' },
  { vendorId: 0x303a, productId: 0x0002, name: 'ESP32-C3' },
];

export function DeviceDetector({ variant = 'card' }: DeviceDetectorProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [chipInfo, setChipInfo] = useState<ChipDetectionResult | null>(null);
  
  // 引导式检测状态
  const [showGuidedDialog, setShowGuidedDialog] = useState(false);
  const [guidedStep, setGuidedStep] = useState<'unplug' | 'plug' | 'detecting'>('unplug');
  const [beforePorts, setBeforePorts] = useState<SerialPort[]>([]);
  
  // 从全局状态获取 setSelectedBoard 和 setDetectedPort
  const { setSelectedBoard, setDetectedPort } = useEditorStore();
  
  // 使用 ref 来存储防抖定时器和最后的设备列表
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDevicesRef = useRef<string>('[]');
  
  // 检测设备（带防抖）
  const detectDevices = async () => {
    if (!('serial' in navigator)) {
      setIsSupported(false);
      return;
    }
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const ports = await navigator.serial.getPorts();
        const deviceList: DeviceInfo[] = [];
        
        for (const port of ports) {
          const info = port.getInfo();
          const knownDevice = KNOWN_DEVICES.find(
            d => d.vendorId === info.usbVendorId && d.productId === info.usbProductId
          );
          
          deviceList.push({
            vendorId: info.usbVendorId || 0,
            productId: info.usbProductId || 0,
            name: knownDevice?.name || `未知设备 (${info.usbVendorId?.toString(16)}:${info.usbProductId?.toString(16)})`,
            connected: true
          });
        }
        
        // 比较设备列表，只有真正变化时才更新
        const newJson = JSON.stringify(deviceList);
        if (newJson !== lastDevicesRef.current) {
          lastDevicesRef.current = newJson;
          setDevices(deviceList);
        }
      } catch (error) {
        console.error('Failed to detect devices:', error);
      }
    }, 300); // 300ms 防抖延迟
  };
  
  // 监听设备连接/断开事件
  useEffect(() => {
    if (!('serial' in navigator)) {
      setIsSupported(false);
      return;
    }
    
    // 初始检测
    detectDevices();
    
    // 监听连接事件
    const handleConnect = () => {
      detectDevices();
    };
    
    const handleDisconnect = () => {
      detectDevices();
    };
    
    navigator.serial.addEventListener('connect', handleConnect);
    navigator.serial.addEventListener('disconnect', handleDisconnect);
    
    return () => {
      navigator.serial.removeEventListener('connect', handleConnect);
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, []); // 移除所有依赖，只在组件挂载时执行一次
  
  // 处理芯片检测（智能选择检测方式）
  const handleDetectChip = async () => {
    try {
      const ports = await getAuthorizedPorts();
      
      if (ports.length === 0) {
        // 没有设备 → 引导式检测
        startGuidedDetection();
      } else if (ports.length === 1) {
        // 只有一个设备 → 直接检测
        setIsDetecting(true);
        setChipInfo(null);
        const result = await detectChipFromPort(ports[0]);
        setChipInfo(result);
        
        if (result.success && result.chipType) {
          const boardId = getRecommendedBoardId(result.chipType);
          if (boardId) {
            setSelectedBoard(boardId);
          }
          // 保存检测到的串口供上传使用
          if (result.port) {
            setDetectedPort(result.port);
          }
        }
        setIsDetecting(false);
      } else {
        // 多个设备 → 显示选择对话框（暂时使用引导式检测）
        startGuidedDetection();
      }
    } catch (error) {
      console.error('芯片检测失败:', error);
      setChipInfo({
        success: false,
        error: '芯片检测失败，请重试',
      });
      setIsDetecting(false);
    }
  };
  
  // 开始引导式检测
  const startGuidedDetection = async () => {
    setShowGuidedDialog(true);
    setGuidedStep('unplug');
    setChipInfo(null);
  };
  
  // 处理引导式检测的下一步
  const handleGuidedNext = async () => {
    if (guidedStep === 'unplug') {
      // 记录当前设备列表
      const ports = await getAuthorizedPorts();
      setBeforePorts(ports);
      setGuidedStep('plug');
    } else if (guidedStep === 'plug') {
      // 开始检测新设备
      setGuidedStep('detecting');
      setIsDetecting(true);
      
      try {
        // 等待新设备插入（30秒超时）
        const newPort = await waitForNewDevice(beforePorts, 30000);
        
        if (newPort) {
          // 检测新设备
          const result = await detectChipFromPort(newPort);
          setChipInfo(result);
          
          if (result.success && result.chipType) {
            const boardId = getRecommendedBoardId(result.chipType);
            if (boardId) {
              setSelectedBoard(boardId);
            }
            // 保存检测到的串口供上传使用
            if (result.port) {
              setDetectedPort(result.port);
            }
          }
        } else {
          // 超时
          setChipInfo({
            success: false,
            error: '未检测到新设备，请确保开发板已插入并重试',
          });
        }
      } catch (error) {
        console.error('引导式检测失败:', error);
        setChipInfo({
          success: false,
          error: '检测失败，请重试',
        });
      } finally {
        setIsDetecting(false);
        setShowGuidedDialog(false);
        setGuidedStep('unplug');
      }
    }
  };
  
  // 取消引导式检测
  const handleGuidedCancel = () => {
    setShowGuidedDialog(false);
    setGuidedStep('unplug');
    setIsDetecting(false);
  };
  
  if (!isSupported) {
    return (
      <div className={variant === 'compact' ? 'device-compact device-compact--warning' : 'device-card device-card--warning'}>
        <div className="device-warning">
          <AlertTriangle />
          <span>浏览器不支持设备检测</span>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    const statusText = chipInfo?.success && chipInfo.chipType
      ? chipInfo.chipType
      : devices.length > 0
        ? `${devices.length} 个设备`
        : '未检测到设备';

    return (
      <div className="device-compact">
        <div className="device-compact__status">
          <Cpu />
          <div>
            <span>设备状态</span>
            <strong className={devices.length > 0 || chipInfo?.success ? 'is-ready' : ''}>
              {statusText}
            </strong>
          </div>
        </div>
        <button
          onClick={detectDevices}
          className="device-compact__icon-button"
          title="刷新设备状态"
        >
          <RefreshCw />
        </button>
        <button
          onClick={handleDetectChip}
          disabled={isDetecting}
          className="device-compact__detect"
        >
          {isDetecting ? (
            <>
              <svg className="button-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>检测中</span>
            </>
          ) : (
            <>
              <Sparkles />
              <span>检测芯片型号</span>
            </>
          )}
        </button>
      </div>
    );
  }
  
  return (
    <div className="device-card">
      <div className="device-card__header">
        <div className="device-card__title">
          <Cpu />
          <h3>设备状态</h3>
        </div>
        <button
          onClick={detectDevices}
          className="device-refresh"
        >
          <RefreshCw />
          <span>刷新</span>
        </button>
      </div>
      
      {devices.length === 0 ? (
        <div className="device-empty">
          <Search />
          <p>还没有检测到设备</p>
          <span>
            插上 ESP 开发板后，点击下方"检测芯片"按钮。
          </span>
        </div>
      ) : (
        <div className="device-list">
          {devices.map((device) => {
            // 使用 VID:PID 作为稳定的 key
            const deviceKey = `${device.vendorId}-${device.productId}`;
            return (
              <div
                key={deviceKey}
                className="device-item"
              >
                <div className="device-item__main">
                  <div className="device-item__dot"></div>
                  <div>
                    <div className="device-item__name">
                      {device.name}
                    </div>
                    <div className="device-item__meta">
                      VID: 0x{device.vendorId.toString(16).toUpperCase()} 
                      {' '}PID: 0x{device.productId.toString(16).toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="device-item__badge">
                  已连接
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* 芯片检测按钮 */}
      <div className="device-detect-section">
        <button
          onClick={handleDetectChip}
          disabled={isDetecting}
          className="device-detect-button"
        >
          {isDetecting ? (
            <>
              <svg className="button-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>检测中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>检测芯片型号</span>
            </>
          )}
        </button>
      </div>
      
      {/* 芯片检测结果 */}
      {chipInfo && (
        <div className={`chip-info ${chipInfo.success ? 'chip-info--success' : 'chip-info--error'}`}>
          {chipInfo.success ? (
            <>
              <div className="chip-info__header">
                <Cpu className="w-5 h-5" />
                <span className="chip-info__title">检测成功</span>
              </div>
              <div className="chip-info__details">
                <div className="chip-info__row">
                  <span>芯片型号</span>
                  <strong>{chipInfo.chipType}</strong>
                </div>
                {chipInfo.chipId && (
                  <div className="chip-info__row">
                    <span>芯片 ID</span>
                    <strong>0x{chipInfo.chipId}</strong>
                  </div>
                )}
                {chipInfo.macAddress && (
                  <div className="chip-info__row">
                    <span>MAC 地址</span>
                    <strong>{formatMacAddress(chipInfo.macAddress)}</strong>
                  </div>
                )}
                {chipInfo.flashSize && (
                  <div className="chip-info__row">
                    <span>Flash 大小</span>
                    <strong>{formatFlashSize(chipInfo.flashSize)}</strong>
                  </div>
                )}
              </div>
              <div className="chip-info__footer">
                <Info className="w-4 h-4" />
                <span>已自动选择对应的开发板配置</span>
              </div>
            </>
          ) : (
            <>
              <div className="chip-info__header">
                <AlertTriangle className="w-5 h-5" />
                <span className="chip-info__title">检测失败</span>
              </div>
              <p className="chip-info__error">{chipInfo.error}</p>
              <div className="chip-info__footer">
                <Info className="w-4 h-4" />
                <span>请手动选择开发板型号</span>
              </div>
            </>
          )}
        </div>
      )}
      
      <div className="device-footnote">
        <p>
          <Info />
          {devices.length > 1 
            ? '检测到多个设备，点击"检测芯片"将引导您识别正确的设备'
            : '点击"检测芯片"自动识别开发板型号'}
        </p>
      </div>
      
      {/* 引导式检测对话框 */}
      {showGuidedDialog && (
        <div className="guided-dialog-overlay">
          <div className="guided-dialog">
            <div className="guided-dialog__header">
              <h3>引导式芯片检测</h3>
              <button
                onClick={handleGuidedCancel}
                className="guided-dialog__close"
                disabled={isDetecting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="guided-dialog__body">
              {guidedStep === 'unplug' && (
                <>
                  <div className="guided-step">
                    <div className="guided-step__icon guided-step__icon--warning">
                      <span>1</span>
                    </div>
                    <div className="guided-step__content">
                      <h4>请先拔掉开发板</h4>
                      <p>为了准确识别您的开发板，请先将开发板从电脑上拔下来。</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGuidedNext}
                    className="guided-dialog__button"
                  >
                    已拔掉，下一步
                  </button>
                </>
              )}
              
              {guidedStep === 'plug' && (
                <>
                  <div className="guided-step">
                    <div className="guided-step__icon guided-step__icon--success">
                      <span>2</span>
                    </div>
                    <div className="guided-step__content">
                      <h4>请插入开发板</h4>
                      <p>现在请将开发板插入电脑的 USB 接口。</p>
                    </div>
                  </div>
                  <button
                    onClick={handleGuidedNext}
                    className="guided-dialog__button"
                  >
                    已插入，开始检测
                  </button>
                </>
              )}
              
              {guidedStep === 'detecting' && (
                <div className="guided-step">
                  <div className="guided-step__icon guided-step__icon--detecting">
                    <svg className="button-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="guided-step__content">
                    <h4>正在检测...</h4>
                    <p>请稍候，正在识别您的开发板芯片型号。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
