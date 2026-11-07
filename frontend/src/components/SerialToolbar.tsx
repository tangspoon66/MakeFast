/**
 * 串口工具栏 — 一行到底 + 齿轮弹出高级设置
 *
 * 主行：[连接设备] [监视器] 板: ESP32-S3 ▼ 波特率: 115200 ▼ [⚙️]
 * ⚙️ → popover 浮层：串口选择、添加串口
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { CompilationClient } from '../api/compilationClient';
import type { BoardInfo } from '../api/types';
import { formatBoardNumberLabel, groupBoardsByChipFamily } from '../utils/boardConstants';
import {
  Cpu,
  Settings,
  CircleCheck,
  FileText,
  Eraser,
  MessageSquareWarning,
  Download,
  Search,
  Upload,
  RefreshCw,
  BookOpen,
} from 'lucide-react';

// ── USB VID/PID 白名单 ──
const PORT_FILTERS: { usbVendorId: number }[] = [
  { usbVendorId: 0x10C4 }, { usbVendorId: 0x1A86 }, { usbVendorId: 0x0403 },
  { usbVendorId: 0x303A }, { usbVendorId: 0x2341 }, { usbVendorId: 0x2A03 }, { usbVendorId: 0x067B },
];

// ── 已知设备 ──
const KNOWN: Record<string, string> = {
  '10C4:EA60': 'CP2102','10C4:EA70': 'CP210x','10C4:EA71': 'CP210x',
  '1A86:7523': 'CH340','1A86:55D3': 'CH343',
  '0403:6001': 'FT232','0403:6010': 'FT2232','0403:6015': 'FT231X',
  '303A:1001': 'S2/S3','303A:0002': 'C3','303A:4001': 'C6',
  '2341:0001': 'Arduino Uno','2341:0010': 'Arduino Mega','2341:0043': 'Arduino Uno R3',
  '2A03:0001': 'Arduino Uno','2A03:0043': 'Arduino Uno R3',
};

function devLabel(vid?: number, pid?: number): string {
  if (vid != null && pid != null) {
    const k = `${vid.toString(16).toUpperCase().padStart(4,'0')}:${pid.toString(16).toUpperCase().padStart(4,'0')}`;
    return KNOWN[k] || `USB(${k})`;
  }
  return '未知';
}

const MONITOR_EVENTS = { SUSPEND: 'serialtoolbar:suspend-monitor', RESUME: 'serialtoolbar:resume-monitor' } as const;
const MONITOR_SEND_EVENT = 'serialtoolbar:send-monitor-input';

const BAUD_OPTIONS = [9600, 115200, 230400, 460800, 921600];
const SERIAL_RECONNECT_GRACE_MS = 3500;

function getPortKey(port?: SerialPort | null): string | null {
  try {
    const info = port?.getInfo?.();
    if (info?.usbVendorId == null) return null;
    return `${info.usbVendorId}:${info.usbProductId ?? 0}`;
  } catch {
    return null;
  }
}

export interface MonitorState {
  isOpen: boolean;
  lines: string[];
  baudRate: number;
  isPaused: boolean;
}

export interface SerialToolbarProps {
  onMonitorStateChange?: (state: MonitorState) => void;
  onFeedbackClick?: () => void;
  showMonitorButton?: boolean;
}

export function SerialToolbar({ onMonitorStateChange, onFeedbackClick, showMonitorButton = true }: SerialToolbarProps) {
  const { selectedBoard, setSelectedBoard, detectedPort, setDetectedPort, detectedChipType, setDetectedChipType } = useEditorStore();

  // ── 状态 ──
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [baudRate, setBaudRate] = useState(115200);
  const [showLibraryPanel, setShowLibraryPanel] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [librarySearchResults, setLibrarySearchResults] = useState<Array<{ name: string; version: string; description?: string }>>([]);
  const [installedLibraries, setInstalledLibraries] = useState<Array<{ name: string; version: string }>>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [localLibraryFile, setLocalLibraryFile] = useState<File | null>(null);
  const baudRateRef = useRef(115200);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverScrollRef = useRef<HTMLDivElement>(null);
  const libraryMessageRef = useRef<HTMLDivElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);

  // 监视器
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [isMonitorPaused, setIsMonitorPaused] = useState(false);
  const [monitorLines, setMonitorLines] = useState<string[]>([]);
  const wasMonitorOpenRef = useRef(false);
  const monitorPortRef = useRef<SerialPort | null>(null);
  const monitorReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const monitorAbortRef = useRef<AbortController | null>(null);
  const monitorBufferRef = useRef<string[]>([]);
  const monitorFlushTimerRef = useRef<number | null>(null);
  const monitorClosingRef = useRef(false);
  const monitorClosePromiseRef = useRef<Promise<void> | null>(null);
  const isMonitorPausedRef = useRef(false);
  const disconnectGraceTimerRef = useRef<number | null>(null);
  const lastPortKeyRef = useRef<string | null>(null);

  // popover 内端口列表
  const [authorizedPorts, setAuthorizedPorts] = useState<SerialPort[]>([]);
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    const key = getPortKey(detectedPort);
    if (key) lastPortKeyRef.current = key;
  }, [detectedPort]);

  // ── 加载开发板 ──
  useEffect(() => {
    const fetchBoards = () => CompilationClient.getBoards().then(r => setBoards(r.boards)).catch(() => {});
    fetchBoards();
    const timer = setInterval(fetchBoards, 60000); // 每分钟刷新，感知管理员变更
    const onBoardsUpdated = () => fetchBoards();
    window.addEventListener('boards-updated', onBoardsUpdated);
    return () => {
      clearInterval(timer);
      window.removeEventListener('boards-updated', onBoardsUpdated);
    };
  }, []);

  // ── 刷新授权端口 ──
  const refreshAuthorizedPorts = useCallback(async () => {
    if (!('serial' in navigator)) return;
    const ports = await navigator.serial.getPorts();
    setAuthorizedPorts(ports);
    return ports;
  }, []);

  // ── 页面加载时恢复已授权的设备（只设置端口，不检测芯片） ──
  useEffect(() => {
    if (!('serial' in navigator) || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    
    const restoreDevice = async () => {
      const ports = await navigator.serial.getPorts();
      if (ports.length > 0 && !detectedPort) {
        // 只设置端口，不自动检测芯片（避免串口冲突）
        setDetectedPort(ports[0]);
        lastPortKeyRef.current = getPortKey(ports[0]);
        console.log('已恢复串口设备');
      }
    };
    restoreDevice();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 串口插拔监听 ──
  useEffect(() => {
    if (!('serial' in navigator)) return;
    navigator.serial.addEventListener('connect', refreshAuthorizedPorts);
    navigator.serial.addEventListener('disconnect', refreshAuthorizedPorts);
    refreshAuthorizedPorts();
    return () => {
      navigator.serial.removeEventListener('connect', refreshAuthorizedPorts);
      navigator.serial.removeEventListener('disconnect', refreshAuthorizedPorts);
    };
  }, [refreshAuthorizedPorts]);

  // ── 监视器 ──
  const flushMonitorLines = useCallback(() => {
    if (monitorBufferRef.current.length === 0) return;
    const nextLines = monitorBufferRef.current;
    monitorBufferRef.current = [];
    setMonitorLines(prev => [...prev, ...nextLines].slice(-300));
  }, []);

  const queueMonitorText = useCallback((text: string) => {
    if (isMonitorPausedRef.current) return;
    const lines = text.split('\n');
    monitorBufferRef.current.push(...lines);
    if (monitorBufferRef.current.length > 60) {
      if (monitorFlushTimerRef.current != null) {
        window.clearTimeout(monitorFlushTimerRef.current);
        monitorFlushTimerRef.current = null;
      }
      flushMonitorLines();
      return;
    }
    if (monitorFlushTimerRef.current == null) {
      monitorFlushTimerRef.current = window.setTimeout(() => {
        monitorFlushTimerRef.current = null;
        flushMonitorLines();
      }, 100);
    }
  }, [flushMonitorLines]);

  const closeMonitor = useCallback((options: { keepLines?: boolean } = {}) => {
    if (monitorClosingRef.current) return monitorClosePromiseRef.current || Promise.resolve();
    monitorClosingRef.current = true;
    isMonitorPausedRef.current = false;

    monitorAbortRef.current?.abort();
    if (monitorFlushTimerRef.current != null) {
      window.clearTimeout(monitorFlushTimerRef.current);
      monitorFlushTimerRef.current = null;
    }
    flushMonitorLines();
    setIsMonitorOpen(false);
    setIsMonitorPaused(false);
    if (!options.keepLines) setMonitorLines([]);

    const reader = monitorReaderRef.current;
    const port = monitorPortRef.current;
    monitorReaderRef.current = null;
    monitorPortRef.current = null;
    monitorAbortRef.current = null;
    monitorBufferRef.current = [];

    monitorClosePromiseRef.current = Promise.resolve()
      .then(async () => {
        try { await reader?.cancel(); } catch { /* 忽略 */ }
        try { reader?.releaseLock(); } catch { /* 忽略 */ }
        if (port?.readable || port?.writable) {
          await Promise.race([
            port.close(),
            new Promise((_, reject) => window.setTimeout(() => reject(new Error('serial close timeout')), 1200)),
          ]);
        }
      })
      .catch((e) => console.warn('关闭串口监视器超时或失败，可忽略:', e))
      .finally(() => {
        monitorClosingRef.current = false;
        monitorClosePromiseRef.current = null;
      });
    return monitorClosePromiseRef.current;
  }, [flushMonitorLines]);

  const openMonitor = useCallback(async (port: SerialPort) => {
    console.log('=== 打开监视器 ===');
    console.log('端口状态:', { readable: port.readable, writable: port.writable, connected: port.connected });
    
    // 检查端口是否连接。部分浏览器没有 connected 字段，不能把 undefined 当作断开。
    if (port.connected === false) {
      alert('设备已断开连接，请重新插拔 USB 线后点击"连接设备"');
      setDetectedPort(null);
      setDetectedChipType(null);
      return;
    }
    
    // 如果端口已经打开，先关闭再重新打开
    try { await port.close(); } catch { /* 忽略 */ }
    try {
      await port.open({ baudRate: baudRateRef.current, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      console.log('端口打开成功，波特率:', baudRateRef.current);
    } catch (e) {
      console.error('打开串口失败:', e);
      alert('打开串口失败，请检查设备是否被其他程序占用');
      return;
    }

    console.log('端口打开后状态:', { readable: port.readable, writable: port.writable });
    isMonitorPausedRef.current = false;
    monitorBufferRef.current = [];
    monitorPortRef.current = port; setMonitorLines([]); setIsMonitorOpen(true);
    // 通知 AIAssistant 切换到 logs tab
    window.dispatchEvent(new CustomEvent('serialtoolbar:monitor-opened'));
    const ctrl = new AbortController(); monitorAbortRef.current = ctrl;
    const decoder = new TextDecoder();
    
    const loop = async () => {
      console.log('开始读取循环...');
      while (port.readable && !ctrl.signal.aborted) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        try {
          reader = port.readable.getReader();
          monitorReaderRef.current = reader;
          console.log('获取 reader 成功，开始读取数据...');
          while (true) {
            const { value, done } = await reader.read();
            if (done || ctrl.signal.aborted) break;
            if (value && value.length > 0) {
              queueMonitorText(decoder.decode(value, { stream: true }));
            }
          }
        } catch (e) {
          if (!ctrl.signal.aborted) console.error('读取错误:', e);
        } finally {
          try { reader?.releaseLock(); } catch { /* 忽略 */ }
        }
      }
      console.log('读取循环结束');
    };
    loop().catch(e => console.error('循环错误:', e));
  }, [queueMonitorText]);

  // 暂停/恢复监视器显示（不关闭端口、不重建 reader，避免恢复时锁状态异常）
  const toggleMonitorPause = useCallback(() => {
    if (!isMonitorOpen) return;
    setIsMonitorPaused(prev => {
      const next = !prev;
      isMonitorPausedRef.current = next;
      if (next) flushMonitorLines();
      return next;
    });
  }, [flushMonitorLines, isMonitorOpen]);

  const toggleMonitor = useCallback(async () => {
    if (isMonitorOpen) { await closeMonitor(); return; }
    const p = detectedPort || useEditorStore.getState().detectedPort; if (!p) return;
    await openMonitor(p);
  }, [isMonitorOpen, closeMonitor, detectedPort, openMonitor]);

  useEffect(() => {
    if (showMonitorButton) return;
    const onToggle = () => { void toggleMonitor(); };
    const onBaudRate = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (!BAUD_OPTIONS.includes(value)) return;
      setBaudRate(value);
      baudRateRef.current = value;
    };
    window.addEventListener('serialtoolbar:toggle-monitor', onToggle);
    window.addEventListener('serialtoolbar:set-baud-rate', onBaudRate);
    return () => {
      window.removeEventListener('serialtoolbar:toggle-monitor', onToggle);
      window.removeEventListener('serialtoolbar:set-baud-rate', onBaudRate);
    };
  }, [showMonitorButton, toggleMonitor]);

  // 监视器读取和写入使用 Web Serial 的两条独立 stream。写入器只在发送期间持有，
  // 不会打断正在运行的 reader，也不会重新打开串口。
  const sendMonitorInput = useCallback(async (text: string, lineEnding: string) => {
    const port = monitorPortRef.current;
    if (!isMonitorOpen || !port?.writable) {
      throw new Error('请先打开串口监视器');
    }

    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${text}${lineEnding}`));
    } finally {
      writer.releaseLock();
    }
  }, [isMonitorOpen]);

  // ── 通知外部监视器状态变化 ──
  useEffect(() => {
    onMonitorStateChange?.({ isOpen: isMonitorOpen, lines: monitorLines, baudRate, isPaused: isMonitorPaused });
  }, [isMonitorOpen, monitorLines, baudRate, isMonitorPaused, onMonitorStateChange]);

  useEffect(() => () => {
    if (monitorFlushTimerRef.current != null) {
      window.clearTimeout(monitorFlushTimerRef.current);
    }
  }, []);

  // ── 上传统筹 ──
  useEffect(() => {
    const onS = () => { wasMonitorOpenRef.current = isMonitorOpen; if (isMonitorOpen) void closeMonitor({ keepLines: true }); };
    const onR = () => { if (wasMonitorOpenRef.current) { const p = useEditorStore.getState().detectedPort; if (p) openMonitor(p); wasMonitorOpenRef.current = false; } };
    window.addEventListener(MONITOR_EVENTS.SUSPEND, onS); window.addEventListener(MONITOR_EVENTS.RESUME, onR);
    return () => { window.removeEventListener(MONITOR_EVENTS.SUSPEND, onS); window.removeEventListener(MONITOR_EVENTS.RESUME, onR); };
  }, [isMonitorOpen, closeMonitor, openMonitor]);

  // ── 监听来自 AIAssistant 的监视器控制事件 ──
  useEffect(() => {
    const onClose = () => { if (isMonitorOpen) void closeMonitor(); };
    const onClear = () => { setMonitorLines([]); };
    const onPause = () => { toggleMonitorPause(); };
    window.addEventListener('serialtoolbar:close-monitor', onClose);
    window.addEventListener('serialtoolbar:clear-monitor', onClear);
    window.addEventListener('serialtoolbar:pause-monitor', onPause);
    return () => {
      window.removeEventListener('serialtoolbar:close-monitor', onClose);
      window.removeEventListener('serialtoolbar:clear-monitor', onClear);
      window.removeEventListener('serialtoolbar:pause-monitor', onPause);
    };
  }, [isMonitorOpen, closeMonitor, toggleMonitorPause]);

  // 接收右侧监视器面板的发送请求，并将结果通过回调回传给 UI。
  useEffect(() => {
    const onSend = (event: Event) => {
      const detail = (event as CustomEvent<{
        text?: string;
        lineEnding?: string;
        onSuccess?: () => void;
        onError?: (message: string) => void;
      }>).detail;
      if (!detail?.text) return;
      void sendMonitorInput(detail.text, detail.lineEnding ?? '\n')
        .then(() => detail.onSuccess?.())
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : '发送失败，请重新打开串口监视器后再试';
          detail.onError?.(message);
        });
    };
    window.addEventListener(MONITOR_SEND_EVENT, onSend);
    return () => window.removeEventListener(MONITOR_SEND_EVENT, onSend);
  }, [sendMonitorInput]);

  // ── 连接设备 ──
  const detectSelectedPort = async (port: SerialPort) => {
    const { detectChipFromPort, getRecommendedBoardId } = await import('../utils/chipDetector');
    const r = await detectChipFromPort(port);
    if (r.success && r.chipType) {
      setDetectedPort(port);
      lastPortKeyRef.current = getPortKey(port);
      setDetectedChipType(r.chipType);
      const bid = getRecommendedBoardId(r.chipType);
      if (bid) setSelectedBoard(bid);
    } else {
      setDetectedPort(port);
      lastPortKeyRef.current = getPortKey(port);
      setDetectedChipType(null);
    }
  };

  const connectDevice = async () => {
    if (!('serial' in navigator)) { alert('请使用 Chrome 或 Edge 浏览器。'); return; }
    setIsConnecting(true);
    try {
      const port = await navigator.serial.requestPort({ filters: PORT_FILTERS });
      await detectSelectedPort(port);
      refreshAuthorizedPorts();
    } catch (e: any) { if (e?.name !== 'NotFoundError') console.error(e); }
    finally { setIsConnecting(false); }
  };

  const isConnected = detectedPort != null;

  // 自动检查连接状态（每 5 秒）
  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(async () => {
      try {
        const ports = await navigator.serial.getPorts();
        const lastKey = lastPortKeyRef.current;
        const port = ports.find(p => p === detectedPort) || (lastKey ? ports.find(p => getPortKey(p) === lastKey) : undefined);
        if (!port || port.connected === false) {
          if (disconnectGraceTimerRef.current != null) return;
          disconnectGraceTimerRef.current = window.setTimeout(async () => {
            disconnectGraceTimerRef.current = null;
            try {
              const latestPorts = await navigator.serial.getPorts();
              const restored = latestPorts.find(p => p === detectedPort)
                || (lastKey ? latestPorts.find(p => getPortKey(p) === lastKey) : undefined);
              if (restored && restored.connected !== false) {
                setDetectedPort(restored);
                lastPortKeyRef.current = getPortKey(restored) || lastKey;
                return;
              }
            } catch { /* ignore */ }
            setDetectedPort(null);
            setDetectedChipType(null);
          }, SERIAL_RECONNECT_GRACE_MS);
        } else if (port !== detectedPort) {
          setDetectedPort(port);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [isConnected, detectedPort]);

  // 断开连接
  const handleDisconnect = async () => {
    if (isMonitorOpen) await closeMonitor();
    if (disconnectGraceTimerRef.current != null) {
      window.clearTimeout(disconnectGraceTimerRef.current);
      disconnectGraceTimerRef.current = null;
    }
    lastPortKeyRef.current = null;
    setDetectedPort(null);
    setDetectedChipType(null);
  };

  useEffect(() => () => {
    if (disconnectGraceTimerRef.current != null) {
      window.clearTimeout(disconnectGraceTimerRef.current);
    }
    void closeMonitor();
  }, [closeMonitor]);

  // ── popover 开关 ──
  useEffect(() => { const onClick = (e: MouseEvent) => { if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setShowPopover(false); }; if (showPopover) document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick); }, [showPopover]);

  // ── 开发板下拉开关 ──
  useEffect(() => { const onClick = (e: MouseEvent) => { if (boardDropdownRef.current && !boardDropdownRef.current.contains(e.target as Node)) setBoardDropdownOpen(false); }; if (boardDropdownOpen) document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick); }, [boardDropdownOpen]);

  const selectedBoardLabel = selectedBoard
    ? (() => {
      const b = boards.find(x => x.id === selectedBoard);
      return b ? `${formatBoardNumberLabel(b.id, boards)}${b.name}` : selectedBoard;
    })()
    : isConnected && detectedChipType ? '请选择开发板' : '请选择';

  const refreshInstalledLibraries = useCallback(async () => {
    const libs = await CompilationClient.getInstalledLibraries();
    setInstalledLibraries(libs);
  }, []);

  const handleLibrarySearch = async () => {
    if (!libraryQuery.trim() || libraryBusy) return;
    setLibraryBusy(true);
    setLibraryMessage(null);
    setLibrarySearchResults([]);
    try {
      const libs = await CompilationClient.searchLibraries(libraryQuery.trim());
      setLibrarySearchResults(libs);
      if (libs.length === 0) setLibraryMessage('未找到匹配的库');
    } finally {
      setLibraryBusy(false);
    }
  };

  const handleLibraryInstall = async (name: string) => {
    if (libraryBusy) return;
    setLibraryBusy(true);
    setLibraryMessage(null);
    try {
      const result = await CompilationClient.installLibrary(name);
      setLibraryMessage(result.success ? result.message : `安装失败：${result.message}`);
      if (result.success) {
        setLibrarySearchResults([]);
        setLibraryQuery('');
        await refreshInstalledLibraries();
      }
    } finally {
      setLibraryBusy(false);
    }
  };

  const handleLocalLibraryUpload = async () => {
    if (!localLibraryFile || libraryBusy) return;
    setLibraryBusy(true);
    setLibraryMessage(null);
    try {
      const result = await CompilationClient.uploadLibraryZip(localLibraryFile);
      setLibraryMessage(result.success ? result.message : `本地上传失败：${result.message}`);
      if (result.success) {
        setLocalLibraryFile(null);
        await refreshInstalledLibraries();
      }
    } finally {
      setLibraryBusy(false);
    }
  };

  useEffect(() => {
    if (showLibraryPanel) refreshInstalledLibraries();
  }, [showLibraryPanel, refreshInstalledLibraries]);

  useEffect(() => {
    if (!libraryMessage) return;
    window.requestAnimationFrame(() => {
      libraryMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [libraryMessage]);

  // ── 渲染 ──
  return (
    <div className="serial-toolbar flex items-center gap-2 min-w-0">
      {/* ===== 连接 / 断开 ===== */}
      <button onClick={isConnected ? handleDisconnect : connectDevice} disabled={isConnecting}
        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
          isConnected
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30'
            : 'bg-blue-500 text-white hover:bg-blue-400'
        } disabled:opacity-50`}>
        {isConnected ? <CircleCheck className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
        {isConnecting ? (
          '检测中...'
        ) : isConnected ? (
          <>
            <span className="group-hover:hidden">设备已连接</span>
            <span className="hidden group-hover:inline">断开连接</span>
          </>
        ) : (
          '连接设备'
        )}
      </button>

      {/* ===== 监视器 ===== */}
      {showMonitorButton && <button onClick={toggleMonitor} disabled={!isConnected}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border shrink-0 ${
          isMonitorOpen
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
            : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title={isMonitorOpen ? '关闭' : '打开串口监视器'}>
        <FileText className="w-3.5 h-3.5" />{isMonitorOpen ? '关闭' : '监视器'}
      </button>}

      {/* ===== 开发板自定义下拉 ===== */}
      <div className="relative min-w-0" ref={boardDropdownRef}>
        <button
          onClick={() => setBoardDropdownOpen(!boardDropdownOpen)}
          className="max-w-[180px] lg:max-w-[260px] text-xs bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 font-medium flex items-center gap-1 min-w-0"
          title={selectedBoardLabel}
        >
          <span className="truncate">开发板：{selectedBoardLabel}</span>
          <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        </button>
        {boardDropdownOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-64 max-h-96 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1"
            onMouseMove={(e) => {
              const el = e.currentTarget;
              const rect = el.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const h = rect.height;
              if (y < 40) el.scrollTop -= 8;
              else if (y > h - 40) el.scrollTop += 8;
            }}
          >
            <button
              onClick={() => { setSelectedBoard(''); setBoardDropdownOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors ${!selectedBoard ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}
            >
              {isConnected && detectedChipType ? '请选择开发板' : '请选择'}
            </button>
            {groupBoardsByChipFamily(boards).map(g => (
              <div key={g.label}>
                <div className="px-3 py-1 text-[10px] text-slate-500 font-semibold uppercase">{g.label}</div>
                {g.boards.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedBoard(b.id); setBoardDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors ${selectedBoard === b.id ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}
                  >
                    {formatBoardNumberLabel(b.id, boards)}{b.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ===== 齿轮 → popover ===== */}
      <div className="relative" ref={popoverRef}>
        <button onClick={() => setShowPopover(!showPopover)}
          aria-expanded={showPopover}
          className={`h-8 px-2 flex items-center justify-center gap-1 rounded-lg border transition-colors ${
            showPopover ? 'bg-slate-700 border-slate-500 text-slate-200' : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`} title="设备设置">
          <Settings className="w-4 h-4" />
          <span className="text-xs font-semibold">设备设置</span>
        </button>
        {showPopover && (
          <div ref={popoverScrollRef} className="absolute right-0 top-full mt-1 w-[min(92vw,340px)] max-h-[78vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-slate-700">
            <div className="mb-3">
              <div className="text-sm font-bold text-slate-800">设备设置</div>
              <div className="text-[11px] text-slate-500 break-words">
                {detectedChipType ? `已识别 ${detectedChipType}` : isConnected ? '已连接，未识别芯片' : '未连接设备'}
              </div>
            </div>

            <label className="text-[11px] font-semibold text-slate-500 block mb-1">串口</label>
            <select
              value={authorizedPorts.indexOf(detectedPort!)}
              onChange={e => { const i = parseInt(e.target.value); if (i >= 0) { setDetectedPort(authorizedPorts[i]); lastPortKeyRef.current = getPortKey(authorizedPorts[i]); setDetectedChipType(null); } }}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-2 outline-none focus:border-blue-400"
            >
              <option value="-1">（自动）</option>
              {authorizedPorts.map((p, i) => {
                let label = `串口 ${i + 1}`;
                try { const info = (p as any).getInfo?.(); if (info?.usbVendorId) label = devLabel(info.usbVendorId, info.usbProductId); } catch { /* 忽略 */ }
                return <option key={i} value={i}>{label}</option>;
              })}
            </select>

            <div className="flex gap-2 mb-3">
              <button onClick={async () => {
                const port = await navigator.serial.requestPort({ filters: PORT_FILTERS });
                setDetectedPort(port);
                lastPortKeyRef.current = getPortKey(port);
                setDetectedChipType(null);
                setTimeout(refreshAuthorizedPorts, 500);
              }}
                className="flex-1 px-2 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-400 transition-colors">添加串口</button>
              <button onClick={async () => {
                const p = detectedPort || useEditorStore.getState().detectedPort;
                if (!p) { alert('请先连接设备'); return; }
                setIsConnecting(true);
                try { await detectSelectedPort(p); }
                finally { setIsConnecting(false); }
              }}
                className="flex-1 px-2 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                disabled={!isConnected || isConnecting}>
                {isConnecting ? '检测中...' : '重新检测'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">波特率</label>
                <select value={baudRate} onChange={e => { const v = parseInt(e.target.value); setBaudRate(v); baudRateRef.current = v; }}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
                  {BAUD_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1">危险操作</div>
                <button onClick={async () => {
                  const p = detectedPort || useEditorStore.getState().detectedPort;
                  if (!p) { alert('请先连接设备'); return; }
                  if (!confirm('确定要擦除 Flash 吗？这将清除设备上的所有固件和数据。')) return;
                  setErasing(true);
                  try {
                    if (isMonitorOpen) {
                      await closeMonitor({ keepLines: true });
                    } else if (p.readable || p.writable) {
                      try { await p.close(); } catch { /* 忽略 */ }
                    }
                    if (p.readable || p.writable) {
                      throw new Error('串口仍被占用，请先关闭监视器，或拔插 USB 后重试');
                    }
                    const { ESPLoader, Transport } = await import('esptool-js');
                    const transport = new Transport(p);
                    const esploader = new ESPLoader({ transport, baudrate: 115200, romBaudrate: 115200 });
                    await esploader.main();
                    await esploader.eraseFlash();
                    await transport.disconnect();
                    alert('Flash 擦除成功！请重新编译上传固件。');
                  } catch (e: any) {
                    alert(`擦除失败: ${e.message || e}`);
                  } finally {
                    setErasing(false);
                  }
                }} disabled={erasing}
                  className="w-full px-2 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Eraser className="w-3 h-3" />{erasing ? '擦除中...' : '擦除 Flash'}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 mt-3">
              <button
                onClick={() => setShowLibraryPanel(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-2 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" />自定义库管理</span>
                <span className="text-slate-400">{showLibraryPanel ? '收起' : '展开'}</span>
              </button>

              {showLibraryPanel && (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={libraryQuery}
                      onChange={e => { setLibraryQuery(e.target.value); setLibraryMessage(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleLibrarySearch(); }}
                      placeholder="搜索库名"
                      className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                    />
                    <button onClick={handleLibrarySearch} disabled={!libraryQuery.trim() || libraryBusy}
                      className="px-2 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1">
                      {libraryBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      搜索
                    </button>
                  </div>

                  {librarySearchResults.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                      {librarySearchResults.map(lib => (
                        <div key={lib.name} className="px-2 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{lib.name}</div>
                            {lib.description && <div className="text-[10px] text-slate-400 truncate">{lib.description}</div>}
                          </div>
                          <button onClick={() => handleLibraryInstall(lib.name)} disabled={libraryBusy}
                            className="shrink-0 px-2 py-1 bg-teal-50 text-teal-700 rounded text-[11px] font-semibold hover:bg-teal-100 disabled:opacity-50 flex items-center gap-1">
                            <Download className="w-3 h-3" />安装
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-slate-100 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".zip,application/zip,application/x-zip-compressed"
                        onChange={e => setLocalLibraryFile(e.target.files?.[0] || null)}
                        className="min-w-0 flex-1 text-xs text-slate-600 file:mr-2 file:px-2 file:py-1 file:border-0 file:rounded file:bg-slate-100 file:text-slate-700"
                      />
                      <button onClick={handleLocalLibraryUpload} disabled={!localLibraryFile || libraryBusy}
                        className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                        <Upload className="w-3 h-3" />本地上传
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-100">
                    <div className="px-2 py-1.5 flex items-center justify-between border-b border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-500">已安装库 ({installedLibraries.length})</span>
                      <button onClick={refreshInstalledLibraries} className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />刷新
                      </button>
                    </div>
                    <div className="max-h-28 overflow-y-auto px-2 py-1">
                      {installedLibraries.length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-2 text-center">暂无库或正在加载</div>
                      ) : (
                        installedLibraries.slice(0, 30).map(lib => (
                          <div key={`${lib.name}-${lib.version}`} className="flex justify-between gap-2 py-1 text-[11px]">
                            <span className="truncate text-slate-700">{lib.name}</span>
                            {lib.version && <span className="shrink-0 text-slate-400">v{lib.version}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {libraryMessage && (
                    <div ref={libraryMessageRef} className={`text-xs px-2 py-1.5 rounded-lg ${libraryMessage.includes('失败') || libraryMessage.includes('未找到') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {libraryMessage}
                    </div>
                  )}
                </div>
              )}
            </div>

            {onFeedbackClick && (
              <div className="border-t border-slate-100 pt-3 mt-3">
                <button
                  onClick={() => {
                    setShowPopover(false);
                    onFeedbackClick();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-2 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 hover:border-blue-300 transition-colors"
                >
                  <MessageSquareWarning className="w-3.5 h-3.5" />
                  问题反馈
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
