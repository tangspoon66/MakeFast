import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  X,
  XCircle,
  AlertTriangle,
  Search,
  Zap,
  Clipboard,
  Info,
  CircleCheck,
  Clock,
  Mic,
  Square,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { aiClient } from '../api/aiClient';
import { CompilationClient } from '../api/compilationClient';
import type { CompileError } from '../api/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BLOCKLY_CONSTRAINT_PROMPT } from '../blockly/blocklyConstraints';
import { parseCodeToXml } from '../blockly/codeToBlocksParser';

export function isCompleteSketch(snippet: string): boolean {
  return /void\s+setup\s*\([^)]*\)\s*\{/.test(snippet) && /void\s+loop\s*\([^)]*\)\s*\{/.test(snippet);
}

function bilibiliEmbedUrl(url: string): string | null {
  const bvMatch = url.match(/BV[a-zA-Z0-9]{8,15}/);
  if (bvMatch) {
    const bvid = bvMatch[0];
    if (bvid.includes('xxx') || bvid.includes('XXXX')) return null;
    return `https://player.bilibili.com/player.html?bvid=${bvid}`;
  }
  return null;
}

// ===== 平台专属约束 =====
const PLATFORM_CONSTRAINTS = `【极其重要 - 平台专属约束】
你是一个在线ESP开发平台的AI助手。用户在一个网页IDE中编写代码，左侧是编辑器（支持代码视图和积木视图），右侧边栏有编译按钮和AI助手面板。

你必须遵守以下规则：

1. 只能提及本平台的操作方式：
- 用户在本页面左侧编辑代码（代码视图/积木视图）
- 点击右上角选择开发板（如 ESP32、ESP32-C3 等）
- 点击"编译代码"按钮编译，编译结果在下方"执行日志"面板查看
- 编译成功后点击"上传到设备"烧录
- 如果编译报错，点击日志面板底部的"发送编译错误给 AI 分析"
- 缺少库时，展开日志面板底部的"搜索安装库"，搜到后点安装
- AI回复中的【库名：xxx】格式的按钮可以直接点击安装库

2. 绝对禁止提及的：
- Arduino IDE 的任何操作（工具菜单、开发板管理器、库管理器、首选项等）
- PlatformIO
- VSCode 插件
- 任何本地开发工具
- 任何第三方编辑器或IDE的配置方式
- "请在ArduinoIDE中打开..."之类的描述

3. 回答格式：
- 代码用 \`\`\`cpp 格式提供
- 只有当错误确实是"缺少 Arduino 库"（头文件 .h 找不到）时，才用【库名：确切名称】格式单独一行标注，例如：【库名：ESP32 Camera】
- 每个库的安装按钮独占一行，方便用户点击
- 不要给出无法点击的纯文本库名，必须用【库名：】格式
- 不要在【库名：】格式中写缩写或不完整的库名
- 不要说"在ArduinoIDE的库管理器中搜索安装"
- 只说"点击下方【库名：xxx】按钮即可安装"
- 重要：如果是API兼容性问题（如函数名改变、参数变化、平台版本差异），不要建议安装库，直接给出代码修改方案
- 重要：如果错误消息是 xxx was not declared / did you mean yyy ，优先判断是否为 API 更名或版本不兼容，不要当成缺少库

5. 芯片库兼容性：
- esp_camera.h 仅 ESP32/ESP32-S2/ESP32-S3 支持，ESP32-C3/ESP32-C6 不支持
- 如果用户在 ESP32-C3 上编译摄像头项目，告诉他们切换开发板到 ESP32 或 ESP32-S3
- 如果用户在 ESP32-C3 上不需要摄像头，告诉他们删除相关代码

6. 回答风格：
- 简洁直接，每个错误说清楚：原因→修复方案→具体操作
- 如果搜索结果不包含你建议的库名，告诉用户"如果搜索不到，请尝试安装 exact_name 这个库"
- 完整回答，不要截断或留空
- 用中文回答

7. 积木优先原则：
- 写代码时优先使用积木视图支持的 Arduino 函数（如 digitalWrite、pinMode、delay、Serial.print、analogRead、Wire.*、Servo.* 等积木已有的模块）
- 只有在积木没有对应功能时，才使用其他代码
- 生成的积木兼容代码可以在积木视图中直接拖拽编辑
- 常见积木已支持的模块：数字I/O、模拟I/O、串口、I2C、舵机、步进电机、OLED显示、NeoPixel灯带、DHT温湿度、超声波测距、红外遥控等

8. 一键部署规则：
- 如果你输出的是可以直接运行的完整 Arduino/ESP 代码，必须包含完整的 void setup() 和 void loop()，并放在一个 cpp 代码块中。
- 如果你只输出局部代码片段，不要假装它可以一键部署。必须用小白式步骤说明用户要修改哪里：
  1. 先说“请在第 X 行附近...”或“请在 setup() 函数里...”；
  2. 再说“把这一行/这一段替换为...”或“在这一行下面新增...”；
  3. 最后给出局部代码片段。
- 当前平台只有完整代码块会显示“一键部署”按钮；局部代码片段不会显示一键部署。`;



interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  code?: string;
}

interface LogEntry {
  timestamp: Date;
  type: string;
  message: string;
}

interface MonitorState {
  isOpen: boolean;
  lines: string[];
  baudRate: number;
  isPaused: boolean;
}

interface AIAssistantProps {
  debugOnly?: boolean;
  debugOnlyTitle?: string;
  onCodeGenerated?: (code: string) => void;
  projectFiles?: Array<{ name: string; content: string }>;
  currentFile?: string;
  compileErrors?: CompileError[];
  selectedBoardName?: string;
  logs?: LogEntry[];
  monitorState?: MonitorState;
  onClearLogs?: () => void;
}

type TabType = 'chat' | 'logs';

export function AIAssistant({ debugOnly = false, debugOnlyTitle = '设备调试', onCodeGenerated, projectFiles, currentFile, compileErrors, selectedBoardName, logs = [], monitorState, onClearLogs }: AIAssistantProps) {
  const [activeTab, setActiveTab] = useState<TabType>(debugOnly ? 'logs' : 'chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [monitorInput, setMonitorInput] = useState('');
  const [monitorLineEnding, setMonitorLineEnding] = useState<'\n' | '\r\n' | ''>('\n');
  const [monitorSending, setMonitorSending] = useState(false);
  const [monitorSendMessage, setMonitorSendMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const recordingStateRef = useRef(false);
  const recognizingStateRef = useRef(false);
  const stopRecordingWhenReadyRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerLongPressRef = useRef(false);
  const MIN_RECORDING_MS = 700;
  const MAX_RECORDING_MS = 30000;
  const LONG_PRESS_MS = 260;
  const isComposingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsListRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const prevErrorsRef = useRef<number>(0);
  const { setCode, code, viewMode, triggerBlocksRefresh } = useEditorStore();

  // 库搜索面板
  const [showLibSearch, setShowLibSearch] = useState(false);
  const [libSearchQuery, setLibSearchQuery] = useState('');
  const [libSearchResults, setLibSearchResults] = useState<Array<{ name: string; version: string; description?: string }>>([]);
  const [libSearching, setLibSearching] = useState(false);
  const [libInstalling, setLibInstalling] = useState<string | null>(null);
  const [libInstallMsg, setLibInstallMsg] = useState<string | null>(null);
  const [aiSuggestedLib, setAiSuggestedLib] = useState(false); // AI 是否建议了库
  const [installedLibs, setInstalledLibs] = useState<Set<string>>(new Set());
  const libPanelRef = useRef<HTMLDivElement>(null);

  // 展开搜索面板时加载已安装库列表
  useEffect(() => {
    if (showLibSearch) {
      CompilationClient.getInstalledLibraries().then(libs => {
        setInstalledLibs(new Set(libs.map(l => l.name)));
      });
    }
  }, [showLibSearch]);

  // 检测最新 AI 回复是否包含库建议
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant && /【库名：.+?】/.test(lastAssistant.content)) {
      setAiSuggestedLib(true);
    } else if (!lastAssistant || !/【库名：.+?】/.test(lastAssistant.content)) {
      setAiSuggestedLib(false);
    }
  }, [messages]);

  // 点击外部关闭搜索面板
  useEffect(() => {
    if (!showLibSearch) return;
    const handler = (e: MouseEvent) => {
      if (libPanelRef.current && !libPanelRef.current.contains(e.target as Node)) {
        setShowLibSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLibSearch]);

  const handleLibSearch = async () => {
    if (!libSearchQuery.trim() || libSearching) return;
    setLibSearching(true);
    const results = await CompilationClient.searchLibraries(libSearchQuery.trim());
    setLibSearchResults(results);
    setLibSearching(false);
  };

  const handleLibInstall = async (name: string, isCustom?: boolean) => {
    setLibInstalling(name);
    setLibInstallMsg(null);
    let result;
    if (isCustom) {
      const { default: axios } = await import('axios');
      try {
        const r = await axios.post('/api/libraries/custom/install', { name }, { timeout: 60000 });
        result = r.data;
      } catch (e: any) {
        result = { success: false, message: e?.response?.data?.message || e.message };
      }
    } else {
      result = await CompilationClient.installLibrary(name);
    }
    if (result.success) {
      const v = result.version ? ` v${result.version}` : '';
      setLibInstallMsg(`${name}${v} 安装成功，请重新编译`);
      setInstalledLibs(prev => new Set(prev).add(name));
    } else {
      setLibInstallMsg(`${name} 安装失败: ${result.message || '未知错误'}`);
    }
    setLibInstalling(null);
  };

  // compileErrors 变化时自动切到日志 tab
  useEffect(() => {
    const currentCount = compileErrors?.length || 0;
    if (currentCount > 0 && currentCount !== prevErrorsRef.current) {
      setActiveTab('logs');
    }
    prevErrorsRef.current = currentCount;
  }, [compileErrors]);

  // 监视器打开时自动切到日志 tab
  useEffect(() => {
    const showLogs = () => setActiveTab('logs');
    const onMonitorOpened = () => showLogs();
    const onShowLogs = () => showLogs();
    window.addEventListener('serialtoolbar:monitor-opened', onMonitorOpened);
    window.addEventListener('makefast:show-logs', onShowLogs);
    return () => {
      window.removeEventListener('serialtoolbar:monitor-opened', onMonitorOpened);
      window.removeEventListener('makefast:show-logs', onShowLogs);
    };
  }, []);


  useEffect(() => {
    if (debugOnly) return;
    const onFirmwareAiResult = (event: Event) => {
      const detail = (event as CustomEvent<{ userPrompt?: string; message?: string }>).detail;
      if (!detail?.message) return;
      const message = detail.message;
      const userPrompt = detail.userPrompt || '请帮我判断这个固件应该填什么烧录地址';
      setActiveTab('chat');
      const now = new Date();
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userPrompt, timestamp: now },
        { role: 'assistant', content: message, timestamp: new Date() },
      ]);
    };
    window.addEventListener('makefast:firmware-ai-result', onFirmwareAiResult);
    return () => window.removeEventListener('makefast:firmware-ai-result', onFirmwareAiResult);
  }, [debugOnly]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const list = logsListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) {
        window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      aiAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    recordingStateRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    recognizingStateRef.current = isRecognizing;
  }, [isRecognizing]);

  const deployCompleteCode = (snippet: string) => {
    const trimmedSnippet = snippet.trim();
    if (!trimmedSnippet) return;
    setDeployError(null);
    setCode(trimmedSnippet);
    onCodeGenerated?.(trimmedSnippet);
    if (viewMode === 'blocks') {
      const result = parseCodeToXml(trimmedSnippet);
      if (result.success && result.warnings.length === 0) {
        triggerBlocksRefresh();
      } else {
        const lines = result.warnings || [];
        const detail = lines.length > 0
          ? `有 ${lines.length} 处代码无法转换为积木：\n${lines.map((w, i) => `  ${i + 1}. ${w}`).join('\n')}`
          : '代码无法转换为积木模块';
        setDeployError(detail);
      }
    }
  };

  const handleClearChat = () => {
    if (!confirm('确定要清空所有聊天记录吗？')) return;
    setMessages([]);
    setAiSuggestedLib(false);
    setShowLibSearch(false);
    setLibSearchResults([]);
    setLibInstallMsg(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const userMessage: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const storeState = useEditorStore.getState();
      const apiMessages = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));

      // ===== 平台专属约束（每次对话都注入） =====
      apiMessages.unshift({ role: 'user', content: PLATFORM_CONSTRAINTS });
      if (storeState.viewMode === 'blocks') {
        apiMessages.unshift({ role: 'user', content: BLOCKLY_CONSTRAINT_PROMPT });
      }
      // 编译错误时加库安装指导约束
      if (compileErrors && compileErrors.length > 0) {
        const installedList = [...installedLibs].join(', ') || '无';
        apiMessages.unshift({
          role: 'user',
          content: `【系统约束】平台已装库: ${installedList}。核心版本 3.3.8 (mbedTLS 3.x)。仅当编译错误明确是缺少库（头文件 .h 找不到）时才用【库名：xxx】格式建议安装。API兼容问题（函数名变更、_ret后缀移除）直接给代码修改方案，不要建议装库。`,
        });
      }
      // 只在当前代码与项目文件内容匹配时才发送 project_files（避免发送旧数据）
      const relevantFiles = (projectFiles && projectFiles.length > 0 &&
        projectFiles.some(f => f.content && f.content.trim() === code.trim()))
        ? projectFiles : undefined;

      const data = await aiClient.generateCode({
        messages: apiMessages,
        board: storeState.selectedBoard,
        context: code,
        project_files: relevantFiles,
        current_file: currentFile,
        compile_errors: compileErrors,
        signal: controller.signal,
      });
      let content = data.message || '';
      if (data.code && !content.includes('```')) {
        content += '\n```cpp\n' + data.code + '\n```';
      }
      setMessages(prev => [...prev, { role: 'assistant', content, code: data.code || undefined, timestamp: new Date() }]);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('AI generation error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，生成代码时出现错误。请稍后重试。', timestamp: new Date() }]);
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const stopGeneration = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setIsLoading(false);
  };

  const stopRecording = useCallback(async (options: { allowTooShort?: boolean } = {}) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      stopRecordingWhenReadyRef.current = true;
      return;
    }
    const elapsed = Date.now() - recordingStartedAtRef.current;
    if (!options.allowTooShort && elapsed < MIN_RECORDING_MS) {
      setDeployError('录音时间太短，请长按说话，或单击麦克风后再单击结束录音');
      return;
    }
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingStateRef.current || recognizingStateRef.current || isLoading) return;
    stopRecordingWhenReadyRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeployError('当前浏览器不支持录音');
      return;
    }
    try {
      setDeployError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          setIsRecording(false);
          setIsRecognizing(true);
          if (recordingTimerRef.current !== null) {
            window.clearTimeout(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          stream.getTracks().forEach(track => track.stop());
          const elapsed = Date.now() - recordingStartedAtRef.current;
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (elapsed < MIN_RECORDING_MS || blob.size === 0) {
            setDeployError('录音时间太短，请长按说话，或单击麦克风后再单击结束录音');
            return;
          }
          const formData = new FormData();
          formData.append('file', blob, 'speech.webm');
          const resp = await fetch('/api/asr/transcribe', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          const data = await resp.json();
          if (!resp.ok || !data?.success) {
            throw new Error(data?.message || '语音识别失败');
          }
          if (data.text) {
            setInput(prev => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch (err: any) {
          setDeployError(err?.message || '语音识别失败');
        } finally {
          setIsRecognizing(false);
          mediaRecorderRef.current = null;
        }
      };

      recorder.start();
      recordingTimerRef.current = window.setTimeout(() => {
        void stopRecording({ allowTooShort: true });
      }, MAX_RECORDING_MS);
      if (stopRecordingWhenReadyRef.current) {
        stopRecordingWhenReadyRef.current = false;
        window.setTimeout(() => stopRecording(), 0);
      }
    } catch (err: any) {
      setIsRecording(false);
      setDeployError(err?.message || '无法启动录音');
    }
  }, [isLoading]);

  useEffect(() => {
    if (activeTab !== 'chat') return;
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable;
    };
    const handleSpaceDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target) || isLoading || recognizingStateRef.current) return;
      event.preventDefault();
      startRecording();
    };
    const handleSpaceUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      event.preventDefault();
      stopRecording();
    };
    window.addEventListener('keydown', handleSpaceDown);
    window.addEventListener('keyup', handleSpaceUp);
    return () => {
      window.removeEventListener('keydown', handleSpaceDown);
      window.removeEventListener('keyup', handleSpaceUp);
    };
  }, [activeTab, isLoading, startRecording, stopRecording]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean };
    if (nativeEvent.isComposing || isComposingRef.current || e.key === 'Process') return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const sendMonitorInput = useCallback(() => {
    if (!monitorState?.isOpen || !monitorInput || monitorSending) return;
    setMonitorSending(true);
    setMonitorSendMessage(null);
    window.dispatchEvent(new CustomEvent('serialtoolbar:send-monitor-input', {
      detail: {
        text: monitorInput,
        lineEnding: monitorLineEnding,
        onSuccess: () => {
          setMonitorInput('');
          setMonitorSending(false);
        },
        onError: (message: string) => {
          setMonitorSending(false);
          setMonitorSendMessage(message);
        },
      },
    }));
  }, [monitorInput, monitorLineEnding, monitorSending, monitorState?.isOpen]);

  const handleMonitorInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMonitorInput();
    }
  };

  const sendQuickPrompt = (prompt: string) => { setInput(prompt); };
  const sendErrorsToAI = () => {
    if (!compileErrors || compileErrors.length === 0) return;
    setInput('请分析以上编译错误，告诉我每个错误的原因和修复方案。');
    setActiveTab('chat');
  };

  // AI 回复中的【库名】按钮 → 直接安装，同时展示搜索结果
  const handleAutoInstallLib = (libName: string) => {
    setActiveTab('chat');
    setShowLibSearch(true);
    setLibSearchQuery(libName);
    setLibSearching(true);
    // 直接安装
    handleLibInstall(libName);
    // 同时搜索展示结果
    CompilationClient.searchLibraries(libName).then(results => {
      setLibSearchResults(results);
      setLibSearching(false);
    });
  };

  const contextItems: string[] = [];
  if (selectedBoardName) contextItems.push(selectedBoardName);
  // 只在有实际文件内容且当前代码与项目文件匹配时才显示文件上下文
  if (projectFiles && projectFiles.length > 0) {
    const matchesProject = projectFiles.some(f => f.content && f.content.trim() === code.trim());
    if (matchesProject) {
      contextItems.push(projectFiles.length <= 3 ? projectFiles.map(f => f.name).join(', ') : `${projectFiles.length} 个文件`);
    }
  }
  const hasCompileErrors = compileErrors && compileErrors.length > 0;
  const contextSummary = contextItems.join(' · ');
  const errorLogCount = logs.filter(l => l.type === 'error').length;

  const renderMessageContent = (msg: Message) => {
    // 用 ReactMarkdown 渲染，自定义组件处理【库名：xxx】、B站链接、代码块
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const text = String(children);
            // 【库名：xxx】→ 安装按钮
            const libMatch = text.match(/^【库名：(.+)】$/);
            if (libMatch) {
              return (
                <button onClick={() => handleAutoInstallLib(libMatch[1].trim())}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', margin: '0 2px',
                    background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Search className="w-3 h-3" />安装 {libMatch[1].trim()}
                </button>
              );
            }
            // B站链接 → iframe
            if (href && (href.includes('bilibili.com') || href.startsWith('BV'))) {
              const embed = bilibiliEmbedUrl(href);
              if (embed) return <iframe src={embed} sandbox="allow-scripts allow-presentation" allow="autoplay; fullscreen" style={{ width: '100%', height: 240, border: 'none', borderRadius: 8, margin: '12px 0' }} allowFullScreen />;
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{children}</a>;
          },
          code: ({ className, children }) => {
            const text = String(children).replace(/\n$/, '');
            if (msg.role === 'assistant' && /"files"\s*:\s*\[/.test(text) && /"address"/.test(text)) {
              return null;
            }
            const canDeploy = msg.role === 'assistant' && isCompleteSketch(text);
            if (className) {
              return (
                <div className="ai-message__code-wrap">
                  <pre className="ai-message__code-block"><code>{text}</code></pre>
                  <button className="ai-message__code-copy" onClick={() => { navigator.clipboard.writeText(text); }} title="复制代码块">
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                  {canDeploy && (
                    <button className="ai-message__deploy" onClick={() => deployCompleteCode(text)} type="button">
                      <Zap className="w-3.5 h-3.5" />
                      一键部署
                    </button>
                  )}
                </div>
              );
            }
            return <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>{text}</code>;
          },
          p: ({ children }) => {
            // 检查段落中是否包含【库名：xxx】
            const text = String(children);
            const libMatch = text.match(/【库名：(.+?)】/);
            if (libMatch) {
              const idx = text.indexOf('【库名：');
              const before = text.slice(0, idx);
              return (
                <p style={{ margin: '4px 0' }}>
                  {before}
                  <button onClick={() => handleAutoInstallLib(libMatch[1])}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', margin: '0 2px',
                      background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Search className="w-3 h-3" />安装 {libMatch[1]}
                  </button>
                </p>
              );
            }
            return <p style={{ margin: '4px 0' }}>{children}</p>;
          },
          ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
          h1: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 4px' }}>{children}</h3>,
          h2: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 3px' }}>{children}</h3>,
          h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: '6px 0 2px' }}>{children}</h3>,
          blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #0d9488', paddingLeft: 10, color: '#6b7280', margin: '6px 0', background: '#f0fdfa', padding: '4px 10px', borderRadius: '0 4px 4px 0', fontSize: 12 }}>{children}</blockquote>,
          table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0', fontSize: 12 }}>{children}</table>,
          th: ({ children }) => <th style={{ border: '1px solid #d1d5db', padding: '4px 8px', background: '#f9fafb', textAlign: 'left' }}>{children}</th>,
          td: ({ children }) => <td style={{ border: '1px solid #e5e7eb', padding: '4px 8px' }}>{children}</td>,
        }}
      >
        {msg.content}
      </ReactMarkdown>
    );
  };

  const logTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-4 h-4" style={{ color: '#dc2626' }} />;
      case 'success': return <CircleCheck className="w-4 h-4" style={{ color: '#16a34a' }} />;
      case 'warning': return <AlertTriangle className="w-4 h-4" style={{ color: '#d97706' }} />;
      case 'info': return <Info className="w-4 h-4" style={{ color: '#2563eb' }} />;
      default: return <Info className="w-4 h-4" style={{ color: '#6b7280' }} />;
    }
  };

  return (
    <div className={`ai-assistant ${debugOnly ? 'ai-assistant--debug-only' : ''} flex h-full max-h-full flex-col flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-0`} aria-label={debugOnly ? '设备调试面板' : 'AI 代码助手'}>
      {/* Tab 切换栏 - 参考UI风格 */}
      <div className="flex border-b border-slate-100">
        {!debugOnly && <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm transition-colors relative ${
            activeTab === 'chat'
              ? 'font-bold text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
              : 'font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={16} className={activeTab === 'chat' ? 'text-blue-500' : 'text-slate-400'} />
          <span>AI 对话</span>
          {messages.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">{messages.length}</span>}
          {messages.length > 0 && (
            <span onClick={(e) => { e.stopPropagation(); handleClearChat(); }} title="清空聊天"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={12} />
            </span>
          )}
        </button>}
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm transition-colors ${
            activeTab === 'logs'
              ? 'font-bold text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
              : 'font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Clock size={16} className={activeTab === 'logs' ? 'text-blue-500' : 'text-slate-400'} />
          <span>{monitorState?.isOpen ? '串口监视器' : debugOnly ? debugOnlyTitle : '执行日志'}</span>
          {!monitorState?.isOpen && errorLogCount > 0 && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">{errorLogCount}</span>}
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ========== AI 对话 Tab ========== */}
        {activeTab === 'chat' && (
          <>
            {contextSummary && (
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
                <Sparkles size={12} className="text-purple-400" />
                <span className="truncate">{contextSummary}</span>
                {hasCompileErrors && (
                  <span className="flex items-center gap-1 text-red-500 font-semibold ml-auto">
                    <AlertTriangle size={12} />
                    {compileErrors!.length}
                  </span>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto px-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 h-full">
                  <div className="w-16 h-16 text-purple-400 flex items-center justify-center mb-4">
                    <Sparkles size={32} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-2">你好！我是 AI 代码助手</h3>
                  {viewMode === 'blocks' && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mb-3">积木模式 — 仅使用积木支持的函数</span>}
                  <p className="text-slate-500 text-sm mb-6">我可以帮你：</p>
                  <ul className="text-sm text-slate-600 space-y-2 mb-8 text-left">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />分析和理解现有代码</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />修改和优化代码</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />添加新功能</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />修复错误和问题</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />诊断编译错误</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />生成新的代码</li>
                  </ul>
                  {hasCompileErrors && (
                    <button className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs flex items-center gap-2 text-red-600 hover:bg-red-100 transition-colors mb-2" onClick={sendErrorsToAI}>
                      <AlertTriangle size={14} />
                      发送编译错误给 AI 分析
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-2 text-slate-600 hover:border-purple-300 hover:text-purple-600 transition-colors" onClick={() => sendQuickPrompt('请解释这段代码的功能和逻辑')}>
                      <Search size={14} />解释代码
                    </button>
                    <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-2 text-slate-600 hover:border-purple-300 hover:text-purple-600 transition-colors" onClick={() => sendQuickPrompt('请分析这段代码的性能和内存使用，给出优化建议')}>
                      <Zap size={14} />优化性能
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => (
                    <div key={index} className={`flex flex-col mb-2.5 ${index === 0 ? 'mt-2' : ''} ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-2.5 py-1 text-[13px] leading-snug ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-md'
                          : 'bg-slate-100 text-slate-700 rounded-bl-md'
                      }`}>
                        {renderMessageContent(msg)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 px-1">{msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex flex-col mb-3 items-start">
                      <div className="bg-slate-100 text-slate-700 rounded-xl rounded-bl-md px-2.5 py-1.5 ai-message__loading"><span></span><span></span><span></span></div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* 库搜索面板：AI 建议库后才出现 */}
            {(aiSuggestedLib || showLibSearch) && (
              <div ref={libPanelRef} style={{ borderTop: '1px solid #e5e7eb', flexShrink: 0, background: '#fafafa' }}>
                <button
                  onClick={() => setShowLibSearch(!showLibSearch)}
                  style={{ width: '100%', padding: '7px 12px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6b7280', fontWeight: 500 }}
                >
                  <Search className="w-4 h-4" />
                  {showLibSearch ? '收起库搜索' : '搜索安装库'}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>{showLibSearch ? '▲' : '▼'}</span>
                </button>
                {showLibSearch && (
                  <div style={{ padding: '0 12px 8px' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input type="text" value={libSearchQuery} onChange={e => setLibSearchQuery(e.target.value)}
                        placeholder="输入库名，如: ESP32 Camera"
                        style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
                        onKeyDown={e => { if (e.key === 'Enter') handleLibSearch(); }} />
                      <button onClick={handleLibSearch} disabled={!libSearchQuery.trim() || libSearching}
                        style={{ padding: '5px 10px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {libSearching ? '...' : '搜索'}
                      </button>
                      <label style={{ padding: '5px 10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                        📎 ZIP
                        <input type="file" accept=".zip" style={{ display: 'none' }}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setLibInstallMsg(null);
                            const r = await CompilationClient.uploadLibraryZip(f);
                            setLibInstallMsg(r.success ? r.message : r.message);
                            e.target.value = '';
                          }} />
                      </label>
                    </div>
                    {libInstallMsg && (
                      <div style={{ fontSize: 12, padding: '4px 8px', marginBottom: 4, borderRadius: 4, background: libInstallMsg.includes('失败') ? '#fef2f2' : '#f0fdf4', color: libInstallMsg.includes('失败') ? '#dc2626' : '#16a34a' }}>
                        {libInstallMsg}
                      </div>
                    )}
                    {libSearchResults.length > 0 && (
                      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
                        {libSearchResults.map((lib, i) => {
                          const isInstalled = installedLibs.has(lib.name);
                          return (
                          <div key={i} style={{ padding: '6px 10px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {lib.name}
                                {isInstalled && <span style={{ fontSize: 10, color: '#16a34a', background: '#f0fdf4', padding: '0 4px', borderRadius: 3, border: '1px solid #86efac' }}>已安装</span>}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {lib.version && <span style={{ color: '#9ca3af', fontSize: 11 }}>v{lib.version}</span>}
                                <button onClick={() => handleLibInstall(lib.name, lib.description === '自定义库')} disabled={libInstalling === lib.name || isInstalled}
                                  style={{ padding: '2px 8px', background: isInstalled ? '#d1d5db' : libInstalling === lib.name ? '#9ca3af' : '#2563eb', color: isInstalled ? '#6b7280' : '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: isInstalled ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                                  {isInstalled ? '已安装' : libInstalling === lib.name ? '...' : '安装'}
                                </button>
                              </div>
                            </div>
                            {lib.description && <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{lib.description}</div>}
                          </div>
                          );
                        })}
                      </div>
                    )}
                    {libSearchResults.length === 0 && libSearchQuery && !libSearching && (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 8 }}>未找到匹配的库，请尝试更换关键词</div>
                    )}
                    {installedLibs.size > 0 && (
                      <div style={{ marginTop: 8, padding: '6px 8px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>已安装的库 ({installedLibs.size}): </span>
                        <span style={{ fontSize: 11, color: '#374151' }}>{[...installedLibs].slice(0, 8).join(', ')}{installedLibs.size > 8 ? ' ...' : ''}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              {deployError && (
                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 text-red-600 font-semibold mb-1">
                    <AlertTriangle size={14} /><span>部署失败</span>
                    <div className="flex gap-1 ml-auto">
                      <button className="px-2 py-0.5 bg-white border border-red-200 rounded text-red-500 hover:bg-red-100 text-[11px]" onClick={() => navigator.clipboard.writeText(deployError)} title="复制错误信息">
                        <Clipboard size={12} />复制
                      </button>
                      <button className="px-2 py-0.5 bg-white border border-red-200 rounded text-red-500 hover:bg-red-100 text-[11px]" onClick={() => setDeployError(null)}><X size={12} /></button>
                    </div>
                  </div>
                  <pre className="text-red-700 whitespace-pre-wrap text-[11px]">{deployError}</pre>
                </div>
              )}
              <div className="relative">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => { isComposingRef.current = false; }}
                  placeholder={hasCompileErrors ? "描述问题或点击上方按钮分析编译错误..." : viewMode === 'blocks' ? "积木模式 — 描述你想要的功能..." : projectFiles && projectFiles.length > 0 ? "描述你想要的修改..." : "描述你想要的功能，比如：帮我写一个LED闪烁的代码"}
                  className={`ai-assistant__prompt-input w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all resize-none h-[60px] ${input.trim() || isLoading ? 'pr-24' : 'pr-12'}`}
                  rows={2}
                  disabled={isRecording || isRecognizing}
                />
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (longPressTimerRef.current !== null) {
                      window.clearTimeout(longPressTimerRef.current);
                    }
                    pointerLongPressRef.current = false;
                    if (isRecording) return;
                    longPressTimerRef.current = window.setTimeout(() => {
                      pointerLongPressRef.current = true;
                      startRecording();
                    }, LONG_PRESS_MS);
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    if (longPressTimerRef.current !== null) {
                      window.clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                    if (pointerLongPressRef.current) {
                      stopRecording();
                      return;
                    }
                    if (recordingStateRef.current) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  onPointerLeave={(e) => {
                    if (longPressTimerRef.current !== null) {
                      window.clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                    if (pointerLongPressRef.current && isRecording) {
                      e.preventDefault();
                      stopRecording();
                    }
                  }}
                  onPointerCancel={() => {
                    if (longPressTimerRef.current !== null) {
                      window.clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                    if (pointerLongPressRef.current && isRecording) stopRecording();
                  }}
                  disabled={isLoading || isRecognizing}
                  title="长按说话，松开识别；单击开始/结束录音；也可以按住空格键"
                  className={`absolute ${input.trim() || isLoading ? 'right-12' : 'right-3'} top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {isRecording ? <Square size={13} /> : <Mic size={14} />}
                </button>
                {isLoading ? (
                  <button
                    onClick={stopGeneration}
                    title="停止生成"
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
                  >
                    <Square size={13} />
                  </button>
                ) : input.trim() && (
                  <button
                    onClick={handleSend}
                    disabled={isLoading || isRecording || isRecognizing}
                    title="发送"
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========== 执行日志 Tab / 监视器覆盖层 ========== */}
        {activeTab === 'logs' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* 监视器覆盖层 */}
            {monitorState?.isOpen ? (
              <div className="serial-monitor-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', overflow: 'hidden' }}>
                <div className="serial-monitor__header" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className="serial-monitor__title" style={{ flex: 1 }}>
                    串口输出 · {monitorState.baudRate} baud
                    {monitorState.isPaused && <span style={{ color: '#f59e0b', marginLeft: 6 }}>(已暂停)</span>}
                  </span>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('serialtoolbar:pause-monitor'))}
                    style={{ padding: '2px 8px', border: '1px solid #475569', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: 'transparent', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}
                    title={monitorState.isPaused ? '恢复输出' : '暂停输出'}>
                    {monitorState.isPaused ? '▶ 恢复' : '⏸ 暂停'}
                  </button>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('serialtoolbar:close-monitor'))}
                    style={{ padding: '2px 8px', border: '1px solid #475569', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: 'transparent', color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <XCircle size={14} />关闭
                  </button>
                </div>
                <pre className="serial-monitor__output" style={{ flex: 1, minHeight: 0, maxHeight: 'none', overflowY: 'auto' }}>
                  {monitorState.lines.length === 0 
                    ? <span className="serial-monitor__waiting">等待设备输出...</span> 
                    : monitorState.lines.map((l, i) => <div key={i}>{l}</div>)}
                </pre>
                <div className="serial-monitor__actions" style={{ flexShrink: 0 }}>
                  <div className="serial-monitor__send-row">
                    <input
                      value={monitorInput}
                      onChange={event => { setMonitorInput(event.target.value); setMonitorSendMessage(null); }}
                      onKeyDown={handleMonitorInputKeyDown}
                      placeholder="输入要发送给开发板的内容"
                      aria-label="串口发送内容"
                      disabled={monitorSending}
                      className="serial-monitor__input"
                    />
                    <select
                      value={monitorLineEnding}
                      onChange={event => setMonitorLineEnding(event.target.value as '\n' | '\r\n' | '')}
                      aria-label="发送结尾"
                      disabled={monitorSending}
                      className="serial-monitor__line-ending"
                      title="发送结尾"
                    >
                      <option value="\n">LF</option>
                      <option value="\r\n">CRLF</option>
                      <option value="">不换行</option>
                    </select>
                    <button
                      onClick={sendMonitorInput}
                      disabled={!monitorInput || monitorSending}
                      className="serial-monitor__send-button"
                    >
                      {monitorSending ? '发送中...' : '发送'}
                    </button>
                    <button onClick={() => {
                      window.dispatchEvent(new CustomEvent('serialtoolbar:clear-monitor'));
                    }} className="toolbar-button toolbar-button--cancel toolbar-button--sm">清空</button>
                  </div>
                  {monitorSendMessage && <div className="serial-monitor__send-error" role="alert">{monitorSendMessage}</div>}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 overflow-hidden flex-col">
                {/* 日志列表 */}
                {logs.length === 0 && !hasCompileErrors ? (
                  <div className="ai-assistant__empty">
                    <Clock className="w-12 h-12" />
                    <p>暂无日志</p>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>编译或上传操作后日志会显示在这里</span>
                  </div>
                ) : (
                  <div ref={logsListRef} className="ai-logs__list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 12 }}>
                    {logs.map((log, i) => (
                      <div key={i} className={`ai-logs__item ai-logs__item--${log.type}`}>
                        {logTypeIcon(log.type)}
                        <span className="ai-logs__time">{log.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="ai-logs__msg">{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}

                {/* 底部操作栏 */}
                {logs.length > 0 && (
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', gap: 8 }}>
                    {hasCompileErrors && !debugOnly && (
                      <button className="ai-quick-action ai-quick-action--error" onClick={sendErrorsToAI}
                        style={{ flex: 1, justifyContent: 'center' }}>
                        <Sparkles className="w-4 h-4" />
                        发送编译错误给 AI 分析
                      </button>
                    )}
                    {onClearLogs && (
                      <button onClick={onClearLogs}
                        className="ai-quick-action"
                        style={{ justifyContent: 'center', color: '#6b7280' }}>
                        <XCircle className="w-4 h-4" />
                        清空日志
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
