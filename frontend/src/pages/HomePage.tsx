/**
 * 首页 - 现有的编辑器页面
 * 
 * 这是原来的 App.tsx 主要内容
 * 后续会将编辑器逻辑移到这里
 */

import '../styles/legacy-workbench.css';
import { BrowserCompatibilityWarning } from '../components/BrowserCompatibilityWarning';
import { EditorTabs, preloadBlocklyEditor } from '../components/EditorTabs';
import { SerialToolbar } from '../components/SerialToolbar';
import type { MonitorState } from '../components/SerialToolbar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ProgressBar } from '../components/ProgressBar';
import { ExecutionLog, type LogEntry } from '../components/ExecutionLog';
import { FeedbackDialog } from '../components/workbench/FeedbackDialog';
import { CourseResourcesPanel } from '../components/workbench/CourseResourcesPanel';
import { Toast } from '../components/Toast';
import type { ToastType } from '../components/Toast';
import { AgentWidget } from '../components/AgentWidget';
import type { AgentState } from '../components/AgentWidget';
import { AgentOverlay } from '../components/workbench/AgentOverlay';
import { WorkbenchShell } from '../components/workbench/WorkbenchShell';
import { CompilationClient, ApiError } from '../api/compilationClient';
import { learningClient, type AgentConversation, type AgentProposal } from '../api/learningClient';
import type { ProjectFile } from '../store/editorStore';
import type { LocalFirmwareAnalysis, LocalFirmwareFile } from '../utils/localFirmware';
import type { BoardInfo } from '../api/types';
import type { UploadProgress } from '../utils/firmwareUploader';
import { useEditorStore } from '../store/editorStore';
import { useLearnerAuthStore } from '../store/learnerAuthStore';
import { useLearnerProject, type WorkbenchStepId } from '../hooks/useLearnerProject';
import { getPublishedCourse, type CourseStepType, type PublishedCourse } from '../api/learningCourseClient';
import { starterConnections, starterFinishedMedia, starterMaterials, starterSteps, STEP_SUBTITLES } from '../data/starterCourse';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Cpu,
  UploadCloud,
  Download,
  FileText,
  BookOpenCheck,
  Cable,
  Check,
  ChevronRight,
  Code2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  PlayCircle,
  Sparkles,
  TerminalSquare,
  Save,
} from 'lucide-react';

const STEP_ICONS: Record<CourseStepType, typeof BookOpenCheck> = {
  intro: BookOpenCheck,
  materials: Cable,
  wiring: Cable,
  blocks: Sparkles,
  code: Code2,
  compile: Cpu,
  flash: UploadCloud,
  verify: TerminalSquare,
  challenge: PlayCircle,
  quiz: BookOpenCheck,
  completion: BookOpenCheck,
};

export { WorkbenchStepContent } from '../components/workbench/WorkbenchStepContent';
import { WorkbenchStepContent } from '../components/workbench/WorkbenchStepContent';

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const learnerId = useLearnerAuthStore((state) => state.learner?.id);
  const projectId = new URLSearchParams(location.search).get('project');
  const { project, activeStep, setActiveStep, materialsConfirmed, completedStepIds, toggleMaterial, debugPanelPreference, setDebugPanelPreference, loadState, saveStatus, saveMessage, isDirty, saveNow, retrySave, saveCopy, acceptServerProject } = useLearnerProject(projectId, learnerId);
  const [publishedCourse, setPublishedCourse] = useState<PublishedCourse | null>(null);
  useEffect(() => {
    if (!project?.course_slug || !project.course_version) return;
    let active = true;
    getPublishedCourse(project.course_slug, project.course_version).then((course) => {
      if (active) setPublishedCourse(course);
    }).catch(() => {
      if (active) setPublishedCourse(null);
    });
    return () => { active = false; };
  }, [project?.course_slug, project?.course_version]);
  const activePublishedCourse = publishedCourse && publishedCourse.slug === project?.course_slug && publishedCourse.version === project?.course_version
    ? publishedCourse : null;
  const courseSteps = activePublishedCourse?.content.steps || starterSteps;
  const materialStep = courseSteps.find((item) => item.type === 'materials');
  const courseMaterials = activePublishedCourse
    ? activePublishedCourse.content.components.filter((item) => materialStep?.material_ids.includes(item.id)) : starterMaterials;
  const wiringComponents = activePublishedCourse?.content.components || starterMaterials;
  const wiringConnections = activePublishedCourse?.content.connections || starterConnections;
  const materialIds = courseMaterials.map((item) => item.id);
  const allMaterialsReady = materialIds.length > 0 && materialIds.every((id) => materialsConfirmed.includes(id));
  const currentStep = courseSteps.find((item) => item.id === activeStep) || courseSteps[0];
  const guidedAgentEnabled = project?.learning_mode === 'guided';
  const autoDebugOpen = ['wiring', 'blocks', 'code', 'compile', 'flash', 'verify'].includes(currentStep.type);
  const debugPanelOpen = debugPanelPreference === 'auto' ? autoDebugOpen : debugPanelPreference === 'open';
  const toggleDebugPanel = () => setDebugPanelPreference(debugPanelOpen ? 'closed' : 'open');
  const workbenchSteps = useMemo(() => courseSteps.map((item) => ({
    id: item.id, title: item.title, subtitle: STEP_SUBTITLES[item.type], icon: STEP_ICONS[item.type],
  })), [courseSteps]);
  // 使用 zustand 状态管理
  const {
    code,
    setCode,
    projectFiles,
    setProjectFiles,
    blocksXml,
    selectedBoard,
    setSelectedBoard,
    detectedChipType,
    detectedPort,
    isCompiling,
    setIsCompiling,
    compileResult,
    setCompileResult,
    setErrorMessage,
    isUploading,
    setIsUploading,
    uploadProgress,
    setUploadProgress,
    viewMode
  } = useEditorStore();
  
  // Toast 通知状态
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  
  // 执行日志状态
  const [logs, setLogs] = useState<Array<{ timestamp: Date; type: string; message: string }>>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('故障反馈');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackIncludeLogs, setFeedbackIncludeLogs] = useState(true);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [isStoppingUpload, setIsStoppingUpload] = useState(false);
  const [conversionToast, setConversionToast] = useState<string | null>(null);
  const [localFirmwareFiles, setLocalFirmwareFiles] = useState<LocalFirmwareFile[]>([]);
  const [localFirmwareAnalysis, setLocalFirmwareAnalysis] = useState<LocalFirmwareAnalysis | null>(null);
  const progressRecordedRef = useRef<Set<string>>(new Set());

  const recordLearningEvent = useCallback((eventType: string, suffix: string, evidence?: string) => {
    // Prototype/fallback projects can render the local starter course before a
    // publishable course version exists. They may save work, but must not call
    // the verified progress/reward API until the project is version-bound.
    if (!projectId || !project?.course_version) return;
    const key = `${projectId}:${eventType}:${suffix}`;
    if (progressRecordedRef.current.has(key)) return;
    progressRecordedRef.current.add(key);
    void learningClient.recordProgress(eventType, key, projectId, evidence).then((result) => {
      if (result.recorded && result.points_awarded > 0) {
        const label: Record<string, string> = { materials_confirmed: '材料确认', blocks_saved: '保存积木', code_saved: '保存代码', compile_succeeded: '编译成功', flash_succeeded: '烧录成功', serial_verified: '串口观察', challenge_completed: '完成挑战', quiz_passed: '答对知识检查', course_completed: '完成课程' };
        setToast({ type: 'success', message: `${label[eventType] || '学习进步'}，获得 ${result.points_awarded} 积分` });
      }
    }).catch((error) => {
      progressRecordedRef.current.delete(key);
      const detail = (error as { response?: { data?: { detail?: string | { message?: string } } } }).response?.data?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message;
      if (message) setToast({ type: 'error', message });
    });
  }, [projectId, project?.course_version]);

  // MakeFast 工作台第一版状态
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>('standby');
  const [agentMessage, setAgentMessage] = useState('我会在你需要的时候跳到对应区域，告诉你下一步做什么。');
  const [agentConversations, setAgentConversations] = useState<AgentConversation[]>([]);
  const [activeAgentConversation, setActiveAgentConversation] = useState<AgentConversation | null>(null);
  const [agentAskBusy, setAgentAskBusy] = useState(false);
  const [agentProposal, setAgentProposal] = useState<AgentProposal | null>(null);
  const [agentProposalBusy, setAgentProposalBusy] = useState(false);

  // Guided learners should meet the character at the start of the workbench.
  // Autonomous projects keep the Agent available without opening it for every step.
  useEffect(() => {
    if (!project?.project_id || !guidedAgentEnabled) return;
    setAgentOpen(true);
    setAgentState('guide');
    setAgentMessage('先从左侧当前步骤开始。我会在需要时跳到真实按钮旁边。');
  }, [project?.project_id, guidedAgentEnabled]);

  // 监视器状态
  const [monitorState, setMonitorState] = useState<MonitorState>({ isOpen: false, lines: [], baudRate: 115200, isPaused: false });
  const handleMonitorStateChange = useCallback((state: MonitorState) => {
    setMonitorState(state);
  }, []);

  useEffect(() => {
    if (allMaterialsReady) recordLearningEvent('materials_confirmed', 'all');
  }, [allMaterialsReady, recordLearningEvent]);

  useEffect(() => {
    if (compileResult?.success) recordLearningEvent('compile_succeeded', compileResult.firmware_id || 'success', compileResult.firmware_id || undefined);
  }, [compileResult, recordLearningEvent]);

  useEffect(() => {
    if (monitorState.lines.length >= 3) recordLearningEvent('serial_verified', 'three-lines', 'parsed-temperature');
  }, [monitorState.lines.length, recordLearningEvent]);

  useEffect(() => {
    if (saveStatus === 'saved' && code.trim() && code.trim() !== '//使用 AI 助手写代码，一键部署!') recordLearningEvent('code_saved', 'source');
  }, [code, saveStatus, recordLearningEvent]);

  useEffect(() => {
    if (saveStatus === 'saved' && blocksXml) recordLearningEvent('blocks_saved', 'workspace');
  }, [blocksXml, saveStatus, recordLearningEvent]);

  useEffect(() => {
    const idlePreloadBlockly = () => preloadBlocklyEditor();
    const requestIdle = window.requestIdleCallback || ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 1400));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const id = requestIdle(idlePreloadBlockly, { timeout: 3500 });
    return () => cancelIdle(id as any);
  }, []);

  // 课程详情页状态
  const [isCourseDetail, setIsCourseDetail] = useState(false);
  const [courseDetailData, setCourseDetailData] = useState<any>(null);
  const [unlockingPkg, setUnlockingPkg] = useState<string | null>(null);
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // 编译中断控制器
  const abortControllerRef = useRef<AbortController | null>(null);
  const compileJobIdRef = useRef<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // 开发板信息列表（用于判断是否支持 Web Serial 烧录）
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  useEffect(() => {
    const fetchBoards = () => CompilationClient.getBoards().then(res => setBoards(res.boards)).catch(() => {});
    fetchBoards();
    const timer = window.setInterval(fetchBoards, 60000);
    const onBoardsUpdated = () => fetchBoards();
    window.addEventListener('boards-updated', onBoardsUpdated);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('boards-updated', onBoardsUpdated);
    };
  }, []);
  const selectedBoardInfo = boards.find(b => b.id === selectedBoard);
  const uploadProtocol = selectedBoardInfo?.upload_protocol || (selectedBoardInfo?.platform === 'arduino-avr' ? 'stk500v1' : 'esptool');
  const isUnsupportedUploadProtocol = uploadProtocol === 'none';
  const isLocalFirmwareMode = viewMode === 'firmware';

  const showConversionToast = useCallback((message: string) => {
    setConversionToast(message);
  }, []);

  useEffect(() => {
    if (!conversionToast) return;
    const timer = window.setTimeout(() => setConversionToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [conversionToast]);

  // 从课程库/模板库打开项目时，加载代码到编辑器
  useEffect(() => {
    const state = location.state as { templateFiles?: ProjectFile[]; boardId?: string } | null;
    if (state?.templateFiles && state.templateFiles.length > 0) {
      setProjectFiles(state.templateFiles);
      if (state.boardId) {
        setSelectedBoard(state.boardId);
      }
      // 清除 location.state 避免刷新后重复加载
      window.history.replaceState({}, document.title);
    }
  }, []); // 仅在首次挂载时执行

  // 添加日志
  const addLog = (type: string, message: string) => {
    window.dispatchEvent(new CustomEvent('makefast:show-logs'));
    setLogs(prev => [...prev, { timestamp: new Date(), type, message }]);
  };
  
  // 显示 Toast
  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
  };

  const selectWorkbenchStep = (step: WorkbenchStepId) => {
    const type = courseSteps.find((item) => item.id === step)?.type;
    if (!type) return;
    if (guidedAgentEnabled) setAgentOpen(true);
    if (type === 'blocks') {
      const editor = useEditorStore.getState();
      if (!editor.blocksXml && editor.code.trim() && editor.code.trim() !== '//使用 AI 助手写代码，一键部署!') {
        setActiveStep(courseSteps.find((item) => item.type === 'code')?.id || step);
        editor.setViewMode('code');
        setAgentState('warning');
        setAgentMessage('这段代码目前不能安全转换成积木。为了不丢代码，我先留在代码编程；原代码仍然可以继续修改和烧录。');
        return;
      }
      setActiveStep(step);
      useEditorStore.getState().setViewMode('blocks');
      setAgentState('guide');
      setAgentMessage('这一步先用积木搭出程序逻辑。你可以从左侧拖入传感器和提醒动作。');
    } else if (type === 'code') {
      setActiveStep(step);
      useEditorStore.getState().setViewMode('code');
      setAgentState('guide');
      setAgentMessage('这里是代码编程区。你可以查看积木生成的代码，也可以切换到代码项目进行修改。');
    } else if (type === 'verify') {
      setActiveStep(step);
      setAgentState('guide');
      setAgentMessage('请看右侧串口面板：先打开串口，再观察设备是否持续输出温湿度数据。');
    } else if (type === 'wiring') {
      setActiveStep(step);
      setAgentState('warning');
      setAgentMessage('接线方案还在实物核验中。现在先不要按页面接线；核验完成后我会逐根带你连接。');
    } else if (type === 'challenge') {
      setActiveStep(step);
      setAgentState('waiting');
      setAgentMessage('准备好后，把阈值改成你想要的数值，再重新编译和烧录。');
    } else if (type === 'materials') {
      setActiveStep(step);
      setAgentState('explain');
      setAgentMessage('先把材料找齐，不需要现在选择开发板；项目和设备会优先尝试自动识别。');
    } else if (type === 'compile' || type === 'flash') {
      setActiveStep(step);
      setAgentState('guide');
      setAgentMessage(type === 'compile' ? '先编译程序，确认没有错误。' : '编译成功后，再将程序烧录到设备。');
    } else {
      setActiveStep(step);
      setAgentState('standby');
      setAgentMessage('这是这个项目的最终目标。准备好后，从左侧下一步开始。');
    }
  };

  useEffect(() => {
    if (!agentOpen || !projectId || !project?.course_version) return;
    let active = true;
    learningClient.listAgentConversations(projectId).then(async (items) => {
      if (!active) return;
      setAgentConversations(items);
      if (items[0]) setActiveAgentConversation(await learningClient.getAgentConversation(projectId, items[0].conversation_id));
    }).catch(() => {
      if (active) setAgentMessage('这个项目还没有可用的已发布课程 Agent。');
    });
    return () => { active = false; };
  }, [agentOpen, projectId, project?.course_version]);

  const handleAgentQuestion = async (question: string) => {
    if (!projectId || !project?.course_version || agentAskBusy) {
      setAgentState('warning');
      setAgentMessage('当前课程还没有发布 Agent 对话；你可以先继续完成步骤。');
      return;
    }
    setAgentAskBusy(true);
    setAgentState('thinking');
    try {
      let conversation = activeAgentConversation;
      if (!conversation) {
        conversation = await learningClient.createAgentConversation(projectId);
        setAgentConversations((items) => [conversation!, ...items]);
      }
      const result = await learningClient.askAgent(projectId, conversation.conversation_id, question, currentStep.id);
      setActiveAgentConversation(result.conversation);
      setAgentState('explain');
      setAgentMessage(result.answer);
    } catch {
      setAgentState('warning');
      setAgentMessage('Agent 暂时无法回答，你的问题没有丢失，请稍后重试。');
    } finally {
      setAgentAskBusy(false);
    }
  };

  const requestAgentProposal = async () => {
    if (!projectId || !project?.course_version || agentProposalBusy) return;
    setAgentProposalBusy(true);
    setAgentState('thinking');
    try {
      const result = await learningClient.createAgentProposal(projectId, '请根据当前课程目标，提出一个安全、可检查、可以撤销的代码小改动。', activeAgentConversation?.conversation_id || null, currentStep.id);
      setAgentProposal(result.proposal);
      setAgentState('waiting');
      setAgentMessage('我先把修改方案放在这里。请检查代码和硬件假设，确认后才会应用。');
    } catch (error) {
      setAgentState('warning');
      setAgentMessage(error instanceof Error ? error.message : '这次没有生成可靠的修改建议，项目没有被改动。');
    } finally {
      setAgentProposalBusy(false);
    }
  };

  const applyAgentProposal = async () => {
    if (!projectId || !agentProposal) return;
    try {
      const result = await learningClient.applyAgentProposal(projectId, agentProposal.proposal_id);
      acceptServerProject(result.project);
      setCode(result.project.project_state.code || '');
      setAgentProposal(result.proposal);
      setAgentState('success');
      setAgentMessage('建议已应用。先读一遍改动，再决定是否编译；Agent 不会替你烧录。');
    } catch (error) {
      setAgentState('warning');
      setAgentMessage(error instanceof Error ? error.message : '项目已经变化，建议没有应用。');
    }
  };

  const undoAgentProposal = async () => {
    if (!projectId || !agentProposal) return;
    try {
      const result = await learningClient.undoAgentProposal(projectId, agentProposal.proposal_id);
      acceptServerProject(result.project);
      setCode(result.project.project_state.code || '');
      setAgentProposal(result.proposal);
      setAgentState('success');
      setAgentMessage('这次修改已撤销，项目恢复到应用前的版本。');
    } catch (error) {
      setAgentState('warning');
      setAgentMessage(error instanceof Error ? error.message : '项目已有新的修改，暂时不能自动撤销。');
    }
  };

  const selectAgentConversation = async (conversationId: string) => {
    if (!projectId || !conversationId) {
      setActiveAgentConversation(null);
      setAgentMessage('可以直接问我当前这一步怎么做。');
      return;
    }
    try {
      const conversation = await learningClient.getAgentConversation(projectId, conversationId);
      setActiveAgentConversation(conversation);
      const last = conversation.messages?.at(-1);
      setAgentMessage(last?.role === 'assistant' ? last.content : '继续问我当前这一步怎么做。');
    } catch {
      setAgentMessage('这段对话暂时打不开，但不会影响项目。');
    }
  };

  const newAgentConversation = async () => {
    if (!projectId || !project?.course_version) return;
    try {
      const conversation = await learningClient.createAgentConversation(projectId);
      setAgentConversations((items) => [conversation, ...items]);
      setActiveAgentConversation(conversation);
      setAgentMessage('新对话已准备好。你想先解决哪一步？');
    } catch {
      setAgentMessage('当前课程还没有发布 Agent 对话。');
    }
  };

  const deleteAgentConversation = async () => {
    if (!projectId || !activeAgentConversation) return;
    try {
      await learningClient.archiveAgentConversation(projectId, activeAgentConversation.conversation_id);
      const remaining = agentConversations.filter((item) => item.conversation_id !== activeAgentConversation.conversation_id);
      setAgentConversations(remaining);
      setActiveAgentConversation(null);
      setAgentMessage('这段对话已收起。');
    } catch {
      setAgentMessage('这段对话暂时无法删除，请稍后重试。');
    }
  };

  // 处理课程详情页状态变化
  const handleCourseDetailChange = (isDetail: boolean, courseData?: any) => {
    setIsCourseDetail(isDetail);
    setCourseDetailData(courseData || null);
  };

  // 处理编译
  const handleCompile = async () => {
    // 验证：必须选择开发板
    if (!selectedBoard) {
      showToast('error', '请先选择开发板！');
      addLog('error', '编译失败：未选择开发板');
      return;
    }
    
    // 验证：代码不能为空（单文件模式）或文件列表不能为空（多文件模式）
    if (!code.trim() && projectFiles.length === 0) {
      showToast('error', '请先输入代码或上传项目文件！');
      addLog('error', '编译失败：代码为空');
      return;
    }
    
    // 清除之前的日志
    setLogs([]);

    // 创建中断控制器
    const controller = new AbortController();
    const compileJobId = crypto.randomUUID();
    abortControllerRef.current = controller;
    compileJobIdRef.current = compileJobId;

    setIsCompiling(true);
    setCompileResult(null);
    setErrorMessage('');
    addLog('info', '开始编译...');

    try {
      let result;

      if (projectFiles.length > 0) {
        // 多文件模式：先将当前编辑器代码同步回项目文件中的主文件
        const syncedFiles = projectFiles.map(f =>
          f.name.endsWith('.ino') || f.content.trim() === code.trim()
            ? { ...f, content: code }
            : f
        );
        // 同步回 store，防止后续操作丢失文件
        setProjectFiles(syncedFiles);
        addLog('info', `编译多文件项目 (${syncedFiles.length} 个文件)`);
        result = await CompilationClient.compile(undefined, selectedBoard, syncedFiles, controller.signal, compileJobId);
      } else {
        // 单文件模式
        if (code.length > 50000) {
          const msg = `代码长度超过限制！当前 ${code.length} 字符，最大 50000 字符。`;
          showToast('error', msg);
          addLog('error', msg);
          setIsCompiling(false);
          abortControllerRef.current = null;
          return;
        }
        addLog('info', `编译单文件代码 (${code.length} 字符)`);
        result = await CompilationClient.compile(code, selectedBoard, undefined, controller.signal, compileJobId);
      }
      
      setCompileResult(result);
      
      if (result.success) {
        showToast('success', '编译成功！固件已就绪');
        addLog('success', `编译成功 (固件大小: ${result.firmware_size} bytes, 耗时: ${result.duration?.toFixed(2)}s)`);
      } else {
        showToast('error', '编译失败，请查看执行日志');
        addLog('error', `编译失败：${result.errors?.[0]?.message || '未知错误'}`);
        if (result.errors) {
          result.errors.forEach(err => {
            addLog('error', `第 ${err.line} 行: ${err.message}`);
          });
        }
      }
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
        addLog('info', '编译已取消');
      } else if (error instanceof ApiError) {
        showToast('error', error.message);
        addLog('error', `编译错误: ${error.message}`);
      } else {
        showToast('error', '编译失败：未知错误');
        addLog('error', '编译失败：未知错误');
      }
    } finally {
      setIsCompiling(false);
      abortControllerRef.current = null;
      compileJobIdRef.current = null;
    }
  };

  // 停止编译
  const handleStopCompile = async () => {
    const jobId = compileJobIdRef.current;
    addLog('info', '正在停止编译...');
    if (jobId) {
      try {
        await CompilationClient.cancelCompile(jobId);
      } catch {
        addLog('warning', '已请求停止本地等待，但后端停止请求未确认');
      }
    }
    abortControllerRef.current?.abort();
    setIsCompiling(false);
  };

  const handleStopUpload = () => {
    if (isStoppingUpload) return;
    setIsStoppingUpload(true);
    uploadAbortControllerRef.current?.abort();
    addLog('warning', '正在安全停止上传；如果设备已开始写入 Flash，请重新完整上传一次。');
  };

  const getFeedbackLogs = () => {
    const executionLogs = logs.map(log =>
      `${log.timestamp.toLocaleTimeString('zh-CN')} [${log.type}] ${log.message}`
    );
    const serialLogs = monitorState.lines.map(line => `[serial] ${line}`);
    return [...executionLogs, ...serialLogs].slice(-50);
  };

  const handleSubmitFeedback = async () => {
    if (feedbackMessage.trim().length < 5) {
      showToast('error', '请简单描述一下遇到的问题');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      await CompilationClient.submitFeedback({
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        contact: feedbackContact.trim(),
        page_url: window.location.href,
        logs: feedbackIncludeLogs ? getFeedbackLogs() : [],
      });
      setFeedbackOpen(false);
      setFeedbackMessage('');
      setFeedbackContact('');
      showToast('success', '反馈已提交');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '反馈提交失败');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const feedbackLogsPreview = getFeedbackLogs();
  
  // 处理上传
  const handleUpload = async () => {
    if (isLocalFirmwareMode) {
      if (localFirmwareFiles.length === 0) {
        showToast('error', '请先上传 .bin 固件文件');
        addLog('error', '烧录失败：未选择固件文件');
        return;
      }
      if (uploadProtocol !== 'esptool') {
        showToast('error', '本地 .bin 固件烧录目前仅支持 ESP 系列开发板');
        addLog('error', '烧录失败：当前开发板不是 ESP 烧录协议');
        return;
      }
    } else {
      // 验证：必须先编译成功
      if (!compileResult?.success || !compileResult.firmware_id) {
        showToast('error', '请先编译代码！');
        addLog('error', '上传失败：未编译');
        return;
      }
      
      // 验证：必须有烧录文件清单
      if (!compileResult.firmware_files || compileResult.firmware_files.length === 0) {
        showToast('error', '编译结果缺少烧录文件清单，请重新编译！');
        addLog('error', '上传失败：缺少烧录文件清单');
        return;
      }
    }
    const compiledFirmwareId = compileResult?.firmware_id;
    const compiledFirmwareFiles = compileResult?.firmware_files || [];
    
    // 验证：浏览器支持
    if (!('serial' in navigator)) {
      showToast('error', '您的浏览器不支持 Web Serial API');
      addLog('error', '上传失败：浏览器不支持 Web Serial API');
      return;
    }

    // 验证：是否选择了串口
    if (!detectedPort) {
      showToast('error', '请先在顶部工具栏选择一个串口，然后点击"检测芯片"确认设备。');
      addLog('error', '上传失败：未选择串口');
      return;
    }
    
    // 串口监视器协调：上传前暂停，上传后恢复
    window.dispatchEvent(new CustomEvent('serialtoolbar:suspend-monitor'));

    setIsUploading(true);
    setIsStoppingUpload(false);
    setUploadProgress(0);
    setErrorMessage('');
    const uploadController = new AbortController();
    uploadAbortControllerRef.current = uploadController;
    addLog('info', isLocalFirmwareMode ? '开始烧录本地固件...' : '开始上传固件...');

    try {
      if (isLocalFirmwareMode) {
        const { FirmwareUploader } = await import('../utils/firmwareUploader');
        await FirmwareUploader.uploadLocal(
          localFirmwareFiles,
          (progress: UploadProgress) => {
            setUploadProgress(progress.percentage);
            addLog('info', progress.message);
          },
          detectedPort,
          uploadController.signal
        );
      } else if (['stk500v1', 'stk500v2', 'avr109'].includes(uploadProtocol)) {
        const { AvrFirmwareUploader } = await import('../utils/avrFirmwareUploader');
        await AvrFirmwareUploader.upload(
          compiledFirmwareId!,
          compiledFirmwareFiles,
          {
            protocol: uploadProtocol,
            baudRate: selectedBoardInfo?.upload_speed || 115200,
            resetMethod: selectedBoardInfo?.reset_method || 'dtr-rts',
          },
          (progress: UploadProgress) => {
            setUploadProgress(progress.percentage);
            addLog('info', progress.message);
          },
          detectedPort,
          uploadController.signal
        );
      } else if (uploadProtocol === 'esptool') {
        const { FirmwareUploader } = await import('../utils/firmwareUploader');
        await FirmwareUploader.upload(
          compiledFirmwareId!,
          compiledFirmwareFiles,
          (progress: UploadProgress) => {
            setUploadProgress(progress.percentage);
            addLog('info', progress.message);
          },
          detectedPort,  // 传入已检测的串口
          uploadController.signal
        );
      } else {
        throw new Error('该开发板的网页烧录协议还没有适配完成');
      }
      window.dispatchEvent(new CustomEvent('serialtoolbar:resume-monitor'));
      
      // 上传成功
      setUploadProgress(100);
      showToast('success', isLocalFirmwareMode ? '固件烧录成功！设备正在重启...' : '固件上传成功！设备正在重启...');
      addLog('success', isLocalFirmwareMode ? '固件烧录成功' : '固件上传成功');
      recordLearningEvent('flash_succeeded', compiledFirmwareId || 'local-firmware', 'user-confirmed');
      
    } catch (error) {
      window.dispatchEvent(new CustomEvent('serialtoolbar:resume-monitor'));
      if (uploadController.signal.aborted) {
        showToast('error', '上传已停止');
        addLog('warning', '上传已停止');
      } else if (error instanceof Error) {
        showToast('error', `上传失败：${error.message}`);
        addLog('error', `上传失败：${error.message}`);
      } else {
        showToast('error', '上传失败：未知错误');
        addLog('error', '上传失败：未知错误');
      }
    } finally {
      setIsUploading(false);
      setIsStoppingUpload(false);
      uploadAbortControllerRef.current = null;
      // 延迟重置进度，让用户看到 100%
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  // Arduino AVR 固件下载
  const handleDownloadHex = async () => {
    if (!compileResult?.success || !compileResult.firmware_id) {
      showToast('error', '请先编译代码！');
      return;
    }
    const firmwareFiles = compileResult.firmware_files || [];
    const hexFile = firmwareFiles.find(f => f.name === 'firmware.hex');
    if (!hexFile) {
      showToast('error', '未找到 firmware.hex 文件');
      return;
    }
    try {
      const url = `/api/firmware/${compileResult.firmware_id}/${hexFile.name}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = hexFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('success', '固件 .hex 文件开始下载');
      addLog('success', '固件 .hex 下载中...');
    } catch {
      showToast('error', '下载失败');
    }
  };

  // 处理打开课程代码（从课程详情页）
  const handleImportCourseProject = () => {
    if (!courseDetailData?.files || courseDetailData.files.length === 0) {
      showToast('error', '没有可导入的源代码');
      return;
    }
    const codeFiles = courseDetailData.files.map((f: any, i: number) => ({
      id: `file-${Date.now()}-${i}`,
      name: f.name,
      content: f.content,
      type: f.name.endsWith('.ino') ? 'ino' : f.name.endsWith('.h') ? 'h' : 'cpp',
    }));
    setProjectFiles(codeFiles);
    useEditorStore.getState().setBlocksXml(null);
    if (courseDetailData.supported_board_ids?.length > 0) {
      useEditorStore.getState().setSelectedBoard(courseDetailData.supported_board_ids[0]);
    }
    const mainFile = codeFiles.find((f: any) => f.type === 'ino') || codeFiles[0];
    if (mainFile) setCode(mainFile.content);
    useEditorStore.getState().setViewMode('code');
    setIsCourseDetail(false);
    setCourseDetailData(null);
    showToast('success', '项目已导入，可以开始编译');
  };

  const returnToDashboard = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    // leave workbench → Home Hub (Agent IDLE); catalog at /courses
    if (!isDirty || await saveNow()) navigate('/home');
  };

  if (loadState !== 'ready' || !project) {
    return <div className="learner-loading-screen">{loadState === 'error'
      ? <div role="alert">项目无法打开。<Link to="/courses">返回课程目录</Link></div>
      : <LoadingSpinner message="正在打开你的项目..." size="lg" />}</div>;
  }

  return (
    <div className="app-shell mf-legacy min-h-screen lg:h-screen flex flex-col bg-[#EAF5FD] text-slate-900 font-sans">
      {/* Toast 通知 */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={toast.type === 'error' ? 5000 : 3000}
        />
      )}

      {/* 浏览器兼容性警告 */}
      <BrowserCompatibilityWarning />

      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        category={feedbackCategory} onCategoryChange={setFeedbackCategory}
        message={feedbackMessage} onMessageChange={setFeedbackMessage}
        contact={feedbackContact} onContactChange={setFeedbackContact}
        includeLogs={feedbackIncludeLogs} onIncludeLogsChange={setFeedbackIncludeLogs}
        submitting={feedbackSubmitting}
        onSubmit={handleSubmitFeedback}
        logsPreview={feedbackLogsPreview}
        hasSerialLines={monitorState.lines.length > 0}
      />

      <header className="mf-legacy-header flex flex-col gap-0 shrink-0 border-b border-[#C0E2F9] bg-white/95 backdrop-blur-md shadow-[0_4px_16px_rgba(31,94,142,0.08)] relative z-20">
        <div className="flex items-center gap-3.5 min-h-[60px] px-3 sm:px-6 py-2">
          <Link
            to="/home"
            onClick={(event) => { void returnToDashboard(event); }}
            className="relative w-10 h-10 flex items-center justify-center shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="返回学习主页"
            aria-label="返回学习主页"
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-full h-full text-[#74B0E1]">
                <rect x="8" y="8" width="24" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M4 14h4M4 20h4M4 26h4M32 14h4M32 20h4M32 26h4M14 4v4M20 4v4M26 4v4M14 32v4M20 32v4M26 32v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <rect x="14" y="14" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            </div>
          </Link>
          <div className="min-w-0 flex items-center gap-3">
            <Link
              to="/home"
              onClick={(event) => { void returnToDashboard(event); }}
              className="hidden md:block text-[20px] leading-none font-bold text-[#1F5E8E] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#74B0E1]"
              title="返回学习主页"
            >
              MakeFast
            </Link>
            <div className="hidden md:block w-px h-7 bg-[#C0E2F9] shrink-0" />
            <div className="flex flex-col justify-center gap-0.5 min-w-0">
              <span className="text-[13px] text-slate-800 font-semibold leading-tight truncate max-w-[110px] sm:max-w-[220px]">{project.title}</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline leading-tight">{saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '正在保存...' : saveStatus === 'unsaved' ? '有未保存修改' : '保存需要处理'}</span>
            </div>
          </div>

          <div className="workbench-device-controls" data-agent-anchor="debug.connect">
            <SerialToolbar
              onMonitorStateChange={handleMonitorStateChange}
              onFeedbackClick={() => setFeedbackOpen(true)}
              showMonitorButton={false}
            />
          </div>

          <button type="button" className="workbench-save-button" onClick={() => saveStatus === 'error' ? retrySave() : void saveNow()} disabled={!isDirty || saveStatus === 'saving' || saveStatus === 'conflict'} title="保存项目到账号" aria-label="保存项目"><Save size={16} /><span>保存</span></button>

          <AgentWidget
            compact
            state={agentState}
            message={agentMessage}
            onToggle={() => setAgentOpen((value) => !value)}
          />
        </div>
      </header>

      {saveMessage && <div className="workbench-save-message" role="alert">{saveMessage}{saveStatus === 'error' && <button type="button" onClick={retrySave}>重试保存</button>}{saveStatus === 'conflict' && <button type="button" onClick={() => { void saveCopy().then((id) => { if (id) navigate(`/project?project=${encodeURIComponent(id)}`); }); }}>另存为新项目</button>}</div>}

      {/* Main Content - 课程路线 / 当前步骤 / 设备调试 */}
      <WorkbenchShell
        steps={workbenchSteps}
        activeStep={activeStep}
        onStepSelect={(step) => selectWorkbenchStep(step as WorkbenchStepId)}
        currentStepTitle={currentStep.title}
        agentOpen={agentOpen}
        onToggleAgent={() => setAgentOpen((value) => !value)}
        debugPanelOpen={debugPanelOpen}
        onToggleDebugPanel={toggleDebugPanel}
        stepContent={null}
        debugPanel={null}
        progressLabel={`已完成 ${completedStepIds.length} / ${courseSteps.length} 步`}
      >
        <aside className="course-steps-panel shrink-0 bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="course-steps-panel__header">
            <span className="course-steps-panel__eyebrow">新手引导 · 体验项目</span>
            <strong>{activePublishedCourse?.content.title || '温湿度提醒器'}</strong>
            <span className="course-steps-panel__progress">已完成 {completedStepIds.length} / {courseSteps.length} 步</span>
          </div>
          <nav className="course-steps-nav" aria-label="课程步骤">
            {workbenchSteps.map((item, index) => {
              const Icon = item.icon;
              const active = activeStep === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`course-step ${active ? 'course-step--active' : ''}`}
                  onClick={() => selectWorkbenchStep(item.id)}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="course-step__index">{completedStepIds.includes(item.id) ? <Check size={16} /> : index + 1}</span>
                  <span className="course-step__icon"><Icon size={16} /></span>
                  <span className="course-step__copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  {active && <ChevronRight size={16} className="course-step__arrow" />}
                </button>
              );
            })}
          </nav>
          <div className="course-steps-panel__footer">后续步骤可以预览；执行动作会在满足前置条件后解锁。</div>
        </aside>

        <section className="workbench-center flex-1 flex flex-col min-w-0 min-h-[500px] lg:min-h-0">
          <div className="workbench-stepbar">
            <div>
              <span className="workbench-stepbar__eyebrow">当前步骤</span>
              <h1>{currentStep.title}</h1>
            </div>
            <div className="workbench-stepbar__actions">
              <button type="button" className="workbench-action-button" onClick={() => setAgentOpen((value) => !value)} data-agent-anchor="agent.toggle">
                <Sparkles size={16} /> {agentOpen ? '收起 Agent' : '需要帮助'}
              </button>
              <button type="button" className="workbench-action-button" onClick={toggleDebugPanel} data-agent-anchor="debug.toggle">
                {debugPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                {debugPanelOpen ? '收起调试' : '打开调试'}
              </button>
              {debugPanelPreference !== 'auto' && <button type="button" className="workbench-action-button" onClick={() => setDebugPanelPreference('auto')} title="按课程步骤自动开合调试区"><RotateCcw size={16} /> 跟随步骤</button>}
            </div>
          </div>

          {agentOpen && (
            <AgentOverlay
                state={agentState}
                message={agentMessage}
                targetId={currentStep.agent_anchor || 'agent.toggle'}
                expanded
                onToggle={() => setAgentOpen(false)}
                onAsk={handleAgentQuestion}
                onRequestProposal={() => void requestAgentProposal()}
                proposalBusy={agentProposalBusy}
                proposal={agentProposal}
                onApplyProposal={() => void applyAgentProposal()}
                onUndoProposal={() => void undoAgentProposal()}
                onDismissProposal={() => setAgentProposal(null)}
                conversations={agentConversations}
                activeConversationId={activeAgentConversation?.conversation_id}
                onSelectConversation={(id) => void selectAgentConversation(id)}
                onNewConversation={() => void newAgentConversation()}
                onDeleteConversation={() => void deleteAgentConversation()}
                messages={activeAgentConversation?.messages?.map((item) => ({ role: item.role, content: item.content }))}
            />
          )}

          <div className="workbench-step-card">
            <WorkbenchStepContent
              key={currentStep.id}
              step={currentStep}
              materials={courseMaterials}
              materialsConfirmed={materialsConfirmed}
              onToggleMaterial={(id) => toggleMaterial(id, materialIds)}
              finishedMedia={activePublishedCourse?.content.finished_media || starterFinishedMedia}
              selectedBoard={selectedBoard}
              detectedChipType={detectedChipType}
              monitorState={monitorState}
              wiringComponents={wiringComponents}
              wiringConnections={wiringConnections}
              onQuizPassed={(answerId) => recordLearningEvent('quiz_passed', `${currentStep.id}:${answerId}`, answerId)}
              onChallengeCompleted={() => recordLearningEvent('challenge_completed', currentStep.id, 'user-confirmed')}
              onCourseCompleted={() => recordLearningEvent('course_completed', currentStep.id, 'course-checklist')}
            />
            {currentStep.type === 'intro' && (
              <button type="button" className="primary-step-button" data-agent-anchor="step.overview" onClick={() => selectWorkbenchStep(courseSteps.find((item) => item.type === 'materials')?.id || currentStep.id)}>
                开始准备材料 <ChevronRight size={17} />
              </button>
            )}
            {currentStep.type === 'materials' && (
              <button type="button" className="primary-step-button" data-agent-anchor="step.materials" disabled={!allMaterialsReady} onClick={() => selectWorkbenchStep(courseSteps.find((item) => item.type === 'wiring')?.id || currentStep.id)}>
                {allMaterialsReady ? '下一步：查看接线' : `再确认 ${materialIds.filter((id) => !materialsConfirmed.includes(id)).length} 类材料`}
              </button>
            )}
            {currentStep.type === 'wiring' && (
              <button type="button" className="primary-step-button" data-agent-anchor="step.wiring" disabled title="接线方案尚未完成实物核验">
                实物核验后开放接线指导
              </button>
            )}
            {currentStep.type === 'challenge' && (
              <button type="button" className="primary-step-button" data-agent-anchor="editor.code" onClick={() => selectWorkbenchStep(courseSteps.find((item) => item.type === 'code')?.id || currentStep.id)}>
                打开代码编程 <ChevronRight size={17} />
              </button>
            )}
          </div>

          {(currentStep.type === 'blocks' || currentStep.type === 'code') && (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden min-w-0 min-h-[420px] lg:min-h-0" data-agent-anchor={currentStep.type === 'blocks' ? 'editor.blocks' : 'editor.code'}>
          <EditorTabs
            value={code}
            onChange={setCode}
            maxLength={50000}
            onProjectFilesChange={(files) => {
              const withIds: ProjectFile[] = files.map((f, i) => ({
                id: `file-${Date.now()}-${i}`,
                name: f.name,
                content: f.content,
                type: f.name.endsWith('.ino') ? 'ino' : f.name.endsWith('.h') ? 'h' : 'cpp',
              }));
              setProjectFiles(withIds);
            }}
            onImportProject={(courseData) => {
              if (!courseData?.files || courseData.files.length === 0) return;
              const codeFiles = courseData.files.map((f: any, i: number) => ({
                id: `file-${Date.now()}-${i}`,
                name: f.name,
                content: f.content,
                type: f.name.endsWith('.ino') ? 'ino' : f.name.endsWith('.h') ? 'h' : 'cpp',
              }));
              setProjectFiles(codeFiles);
              useEditorStore.getState().setBlocksXml(null);
              if (courseData.supported_board_ids?.length > 0) {
                useEditorStore.getState().setSelectedBoard(courseData.supported_board_ids[0]);
              }
              const mainFile = codeFiles.find((f: any) => f.type === 'ino') || codeFiles[0];
              if (mainFile) setCode(mainFile.content);
              useEditorStore.getState().setViewMode('code');
              showToast('success', '项目已导入，可以开始编译');
            }}
            onCourseDetailChange={handleCourseDetailChange}
            onConversionWarning={showConversionToast}
            selectedBoardInfo={selectedBoardInfo}
            localFirmwareFiles={localFirmwareFiles}
            localFirmwareAnalysis={localFirmwareAnalysis}
            onLocalFirmwareChange={(files, analysis) => {
              setLocalFirmwareFiles(files);
              setLocalFirmwareAnalysis(analysis);
            }}
          />
          </div>
          )}

          {currentStep.type === 'verify' && (
            <div className="workbench-empty-editor"><TerminalSquare size={24} /><span>完成编译和烧录后，在右侧打开串口开始验证。</span></div>
          )}
        </section>

        {/* Right Panel: Sidebar */}
        <div className={`debug-panel ${debugPanelOpen ? '' : 'debug-panel--collapsed'} w-full lg:w-[320px] shrink-0 flex flex-col gap-4 min-h-0 lg:h-full lg:max-h-full lg:overflow-hidden`}>
          <div className="workbench-device-controls" data-agent-anchor="debug.serial">
            <button type="button" className="debug-monitor-button" disabled={!detectedPort} onClick={() => window.dispatchEvent(new Event('serialtoolbar:toggle-monitor'))}>
              <FileText size={16} />{monitorState.isOpen ? '关闭串口' : '打开串口'}
            </button>
            <label className="debug-baud-rate">波特率
              <select value={monitorState.baudRate} onChange={(event) => window.dispatchEvent(new CustomEvent('serialtoolbar:set-baud-rate', { detail: Number(event.target.value) }))}>
                {[9600, 115200, 230400, 460800, 921600].map((rate) => <option key={rate} value={rate}>{rate}</option>)}
              </select>
            </label>
          </div>
          {!debugPanelOpen && (
            <button type="button" className="debug-panel__restore" onClick={toggleDebugPanel} aria-label="打开设备调试" title="打开设备调试">
              <PanelRightOpen size={18} />
              <span>设备调试</span>
            </button>
          )}
          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isLocalFirmwareMode && (
              <button
                onClick={isCompiling ? handleStopCompile : handleCompile}
                data-agent-anchor="debug.compile"
                disabled={!isCompiling && !code.trim()}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCompiling
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'
                }`}
              >
                {isCompiling ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>停止编译</span>
                  </>
                ) : (
                  <>
                    <Cpu size={18} />
                    <span>编译代码</span>
                  </>
                )}
              </button>
            )}
            <div className="relative flex-1">
              <button
                onClick={isUploading ? handleStopUpload : handleUpload}
                data-agent-anchor="debug.upload"
                disabled={!isUploading && (!detectedPort || (isLocalFirmwareMode ? localFirmwareFiles.length === 0 || uploadProtocol !== 'esptool' : (!compileResult?.success || isUnsupportedUploadProtocol)))}
                className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isUploading
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                    : (isLocalFirmwareMode ? localFirmwareFiles.length > 0 && uploadProtocol === 'esptool' : compileResult?.success && !isUnsupportedUploadProtocol)
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-500'
                }`}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{isStoppingUpload ? '正在停止...' : isLocalFirmwareMode ? '停止烧录' : '停止上传'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} />
                    <span>{isLocalFirmwareMode ? '烧录固件' : '上传到设备'}</span>
                  </>
                )}
              </button>
              {conversionToast && (
                <div className="conversion-toast">
                  <span>{conversionToast}</span>
                </div>
              )}
            </div>
          </div>

          {isUnsupportedUploadProtocol && selectedBoardInfo?.platform === 'arduino-avr' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              <p>这块 Arduino 开发板的在线烧录协议还在适配中，可先下载固件备用。</p>
              <button onClick={handleDownloadHex} disabled={!compileResult?.success} className="mt-2 inline-flex items-center gap-1 text-amber-800 font-semibold disabled:opacity-50">
                <Download size={14} />下载固件备用
              </button>
            </div>
          )}

          {isCompiling && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <LoadingSpinner message="编译中..." size="sm" />
            </div>
          )}

	          {isUploading && (
	            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
	              <ProgressBar
	                progress={uploadProgress}
                message={isStoppingUpload ? '正在安全停止...' : '上传中...'}
                color="green"
	              />
	            </div>
	          )}

	          {isCourseDetail && courseDetailData ? (
            <CourseResourcesPanel
              course={courseDetailData}
              onImport={handleImportCourseProject}
              unlockingPkg={unlockingPkg} setUnlockingPkg={setUnlockingPkg}
              unlockCode={unlockCode} setUnlockCode={setUnlockCode}
              unlockError={unlockError} setUnlockError={setUnlockError}
              onUnlocked={(pkg) => setCourseDetailData((prev: any) => ({ ...prev, locked_resources: prev.locked_resources?.filter((r: string) => r !== pkg) }))}
            />
          ) : (
            // 单一 AI 入口：旧 AIAssistant 已从工作台移除，这里只保留执行日志
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto p-4 min-h-0">
              <h3 className="text-sm font-bold text-slate-800 mb-2">设备调试</h3>
              {logs.length === 0 && monitorState.lines.length === 0
                ? <p className="text-xs text-slate-500">编译、上传的结果和串口输出会显示在这里。</p>
                : <ExecutionLog logs={logs as LogEntry[]} onClear={() => { setLogs([]); setCompileResult(null); }} />}
              {monitorState.lines.length > 0 && (
                <pre className="mt-2 max-h-48 overflow-auto text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{monitorState.lines.slice(-30).join('\n')}</pre>
              )}
            </div>
          )}
        </div>
      </WorkbenchShell>
    </div>
  );
}
