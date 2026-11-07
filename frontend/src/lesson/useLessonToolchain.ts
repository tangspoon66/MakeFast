/**
 * 工作台工具链闭环：板型 → 连接 → 编译 → 烧录 → 串口 → 现象成功。
 * 错误只写在动作处（按钮下方 message）和结果处（串口栏 lines），不弹 toast。
 */
import { useLearnerAuthStore } from '../store/learnerAuthStore';
import { sendTelemetry } from './telemetry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CompilationClient, ApiError } from '../api/compilationClient';
import type { CompileResult } from '../api/types';
import type { ActionMessage } from '../components/lesson/WorkbenchTopBar';
import type { DockLine, DockLineKind } from '../components/lesson/SerialDock';
import type { BoardDocument } from './board';
import type { GraphIssue, ValidationResult } from './connectionGraph';
import { detectBoard, detectNote, detectSerialIssue } from './boardDetect';
import { MockDeviceLink, WebSerialDeviceLink, webSerialSupported, type DeviceLink } from './deviceLink';
import { useLessonStore, type PhaseId, type PhaseState } from './lessonStore';
import { createPhenomenonDetector, looksLikeSensorFailure } from './phenomenon';
import { childCompileMessage, childDeviceMessage, invalidateFrom, normalizeToolchain } from './toolchain';
import { lintFirstLesson, type CompileErr } from './agent/fixes';

type ActionKey = 'board' | 'connect' | 'compile' | 'flash';
const MAX_LINES = 400;

interface Params {
  code: string;
  board: BoardDocument;
  validation: ValidationResult;
  codeIssues: GraphIssue[];
  graphKey: string;
}

export function useLessonToolchain({ code, board, validation, codeIssues, graphKey }: Params) {
  const mockMode = useLessonStore((s) => s.mockMode);
  const toolchain = useLessonStore((s) => s.toolchain);
  const phenomenonSuccess = useLessonStore((s) => s.phenomenonSuccess);
  const markPhenomenon = useLessonStore((s) => s.markPhenomenon);

  const [lines, setLines] = useState<DockLine[]>([]);
  const [messages, setMessages] = useState<Partial<Record<ActionKey, ActionMessage | null>>>({});
  const [busy, setBusy] = useState<Partial<Record<ActionKey, boolean>>>({});
  const [flashProgress, setFlashProgress] = useState(0);
  const [listening, setListening] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  /** 插板识别的行内提示（不弹 toast） */
  const [detected, setDetected] = useState<string | null>(null);
  /** 最近一次编译的结构化错误（行号 + 原文），给 Agent 定位代码行 / 生成修改建议 */
  const [compileErrors, setCompileErrors] = useState<CompileErr[]>([]);
  const compileRef = useRef<CompileResult | null>(null);
  const simulatedBuildRef = useRef(false);
  const lineId = useRef(0);
  const flashAbort = useRef<AbortController | null>(null);
  const detector = useRef(createPhenomenonDetector());
  const nanWarned = useRef(false);

  const link: DeviceLink = useMemo(() => (mockMode ? new MockDeviceLink() : new WebSerialDeviceLink()), [mockMode]);

  const update = useCallback((patch: Partial<Record<PhaseId, PhaseState>>) => {
    const s = useLessonStore.getState();
    s.setToolchain(normalizeToolchain({ ...s.toolchain, ...patch }));
  }, []);

  const addLine = useCallback((kind: DockLineKind, text: string, hit = false) => {
    lineId.current += 1;
    const id = lineId.current;
    setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), { id, kind, text, hit }]);
  }, []);
  const say = useCallback((key: ActionKey, msg: ActionMessage | null) => setMessages((m) => ({ ...m, [key]: msg })), []);

  // 切换模拟/真实设备：断开旧设备，连接及之后的阶段重来
  useEffect(() => {
    const s = useLessonStore.getState();
    s.setToolchain(invalidateFrom(s.toolchain, 'connection'));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换设备时同步断开外部设备连接（effect 清理里 disconnect），本地显示随之复位
    setDeviceLabel(null);
    setListening(false);
    compileRef.current = null;
    return () => { void link.disconnect(); };
  }, [link]);

  // 改了程序或连线 → 需要重新编译（之前的固件已过期）
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const s = useLessonStore.getState();
    if (s.toolchain.build.status === 'done' || s.toolchain.build.status === 'error') {
      s.setToolchain(invalidateFrom(s.toolchain, 'build'));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 固件过期提示与外部 store 的工具链状态一起复位
      say('compile', null);
    }
  }, [code, graphKey, say]);

  const confirmBoard = useCallback(() => {
    update({ board: { status: 'done' } });
    say('board', { kind: 'info', text: `已确认：${board.name}。编译时会使用 ${board.toolchain.backendBoardId} 配置。` });
    addLine('info', `开发板：${board.name}`);
    setTimeout(() => say('board', null), 2600);
  }, [board, update, say, addLine]);

  const connect = useCallback(async () => {
    if (busy.connect) return;
    if (toolchain.connection.status === 'done') {
      await link.disconnect();
      setListening(false);
      setDeviceLabel(null);
      setDetected(null);
      update({ connection: { status: 'todo' }, flash: { status: 'todo' }, serial: { status: 'todo' } });
      addLine('info', '已断开设备');
      return;
    }
    if (!mockMode && !webSerialSupported()) {
      update({ connection: { status: 'error' } });
      say('connect', { kind: 'error', text: childDeviceMessage(new Error('not supported')) });
      return;
    }
    say('connect', null);
    setBusy((b) => ({ ...b, connect: true }));
    try {
      const { label, usb } = await link.connect();
      setDeviceLabel(label);
      const note = detectNote(detectBoard(usb), board.id, board.name);
      setDetected(note?.text ?? null);
      if (note?.autoSelect && toolchain.board.status !== 'done') { update({ board: { status: 'done' } }); addLine('info', `开发板：${board.name}（自动识别）`); }
      update({ connection: { status: 'done', message: label } });
      addLine('success', `已连接：${label}`);
    } catch (err) {
      update({ connection: { status: 'error' } });
      say('connect', { kind: 'error', text: childDeviceMessage(err) });
      addLine('error', `连接失败：${childDeviceMessage(err)}`);
    } finally {
      setBusy((b) => ({ ...b, connect: false }));
    }
  }, [busy.connect, toolchain.connection.status, toolchain.board.status, board, link, mockMode, update, say, addLine]);

  const compile = useCallback(async () => {
    if (busy.compile) return;
    say('compile', null);
    // validate：error 阻断编译；warning 允许编译但显示黄色提示
    if (!validation.ok) {
      const text = `连线图里有 ${validation.errors.length} 处要改，先改好再编译：${validation.errors[0].childMessage}`;
      update({ build: { status: 'error' } });
      say('compile', { kind: 'error', text });
      addLine('error', text);
      return;
    }
    if (!code.trim()) {
      update({ build: { status: 'error' } });
      say('compile', { kind: 'error', text: '程序是空的，先在「代码」里写点什么吧。' });
      return;
    }
    const warnings = [...validation.warnings, ...codeIssues];
    setBusy((b) => ({ ...b, compile: true }));
    update({ build: { status: 'current' } });
    addLine('info', '开始编译…（第一次可能需要几十秒）');
    const fail = (errs: CompileErr[], simulated: boolean) => {
      const first = errs[0];
      const text = childCompileMessage(first?.message || '未知错误', first?.line);
      setCompileErrors(errs);
      if (first) sendTelemetry({ kind: 'compile_error', error_text: `${simulated ? '[模拟] ' : ''}第 ${first.line} 行: error: ${first.message}`.slice(0, 900), line: first.line });
      update({ build: { status: 'error' } });
      say('compile', { kind: 'error', text });
      addLine('error', simulated ? `${text}（模拟编译检查）` : text);
      errs.slice(0, 5).forEach((e) => addLine('error', `第 ${e.line} 行：${e.message}`));
    };
    const simulate = (why: string | null) => {
      // 模拟模式：后端不可用 / 未登录时用模拟编译（先做本地语法检查），保证无硬件、无后端也能演示
      const errs = lintFirstLesson(code);
      if (errs.length) { fail(errs, true); return; }
      setCompileErrors([]);
      compileRef.current = { success: true, firmware_id: 'mock-firmware', firmware_size: 291840, firmware_files: [], duration: 1 };
      simulatedBuildRef.current = true;
      update({ build: { status: 'done' } });
      if (why) addLine('warning', `${why}，已使用「模拟编译」（仅模拟模式可用）`);
      else addLine('success', '模拟编译成功！程序没有语法错误（模拟模式，不需要登录）');
      if (warnings[0]?.childMessage) say('compile', { kind: 'warning', text: `模拟编译完成。另外：${warnings[0].childMessage}` });
      else if (why) say('compile', { kind: 'warning', text: `${why}，已用模拟编译继续体验。真实烧录需要启动后端并登录。` });
    };
    try {
      // 模拟模式 + 没登录：不去敲真实编译接口（必然 401），直接本地检查 + 模拟编译
      if (mockMode && !useLearnerAuthStore.getState().isAuthenticated) { simulate(null); return; }
      const result = await CompilationClient.compile(code, board.toolchain.backendBoardId);
      if (result.success) {
        setCompileErrors([]);
        compileRef.current = result;
        simulatedBuildRef.current = false;
        update({ build: { status: 'done' } });
        addLine('success', `编译成功！程序大小 ${result.firmware_size ?? '?'} 字节`);
        if (warnings.length) say('compile', { kind: 'warning', text: `编译成功，但要注意：${warnings[0].childMessage}` });
      } else {
        fail((result.errors || []).filter((e) => e.type !== "warning").map((e) => ({ line: e.line, message: e.message })), false);
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.statusCode : undefined;
      const offline = !(err instanceof ApiError) || !status || status >= 500;
      const needLogin = status === 401 || status === 403;
      const localErrs = offline || needLogin ? lintFirstLesson(code) : [];
      if (localErrs.length) {
        // 真实编译暂不可用时，本地检查到的语法错误照样指出来（离线修改建议依赖它）
        fail(localErrs, true);
      } else if (mockMode && (offline || needLogin)) {
        simulate(needLogin ? '真实编译需要先登录' : '编译服务器没连上');
      } else if (needLogin) {
        const text = '真实编译需要先登录账号（点左上「←」回到主页登录），或者打开「模拟模式」先体验。';
        update({ build: { status: 'error' } });
        say('compile', { kind: 'error', text });
        addLine('error', text);
      } else {
        const text = err instanceof ApiError ? childCompileMessage(err.message) : '连不上编译服务器。请确认后端已启动（见 DELIVERY.md），或打开「模拟模式」。';
        update({ build: { status: 'error' } });
        say('compile', { kind: 'error', text });
        addLine('error', text);
      }
    } finally {
      setBusy((b) => ({ ...b, compile: false }));
    }
  }, [busy.compile, validation, codeIssues, code, board, mockMode, update, say, addLine]);

  const onSerialLine = useCallback((line: string) => {
    const { reading, success } = detector.current.feed(line);
    addLine('serial', line, !!reading);
    if (!reading && looksLikeSensorFailure(line) && !nanWarned.current) {
      nanWarned.current = true;
      addLine('warning', detectSerialIssue(line)?.message ?? '读到了 nan：传感器没回话。');
    }
    if (success && !useLessonStore.getState().phenomenonSuccess) {
      addLine('success', '认出温湿度读数啦！主线完成 🎉');
      update({ serial: { status: 'done' } });
      markPhenomenon('auto_serial');
    }
  }, [addLine, update, markPhenomenon]);

  const startSerial = useCallback(async () => {
    detector.current.reset();
    nanWarned.current = false;
    try {
      await link.startSerial(onSerialLine, board.toolchain.baudRate);
      setListening(true);
      update({ serial: { status: useLessonStore.getState().phenomenonSuccess ? 'done' : 'current' } });
    } catch (err) {
      setListening(false);
      update({ serial: { status: 'error' } });
      addLine('error', `打开串口失败：${childDeviceMessage(err)}`);
    }
  }, [link, onSerialLine, board, update, addLine]);

  const flash = useCallback(async () => {
    if (busy.flash) { flashAbort.current?.abort(); return; }
    say('flash', null);
    if (toolchain.connection.status !== 'done') {
      say('flash', { kind: 'info', text: '先点「连接」让浏览器认识你的小板，再来烧录。' });
      return;
    }
    if (toolchain.build.status !== 'done' || !compileRef.current) {
      say('flash', { kind: 'info', text: '先点「编译」把程序翻译好，再烧录。' });
      return;
    }
    if (!mockMode && simulatedBuildRef.current) {
      say('flash', { kind: 'error', text: '这是模拟编译的结果，不能写进真的小板。请启动后端后重新编译。' });
      return;
    }
    const result = compileRef.current;
    if (!mockMode && (!result.firmware_id || !result.firmware_files?.length)) {
      say('flash', { kind: 'error', text: '编译结果里缺少烧录文件，请重新编译一次。' });
      return;
    }
    setListening(false);
    setBusy((b) => ({ ...b, flash: true }));
    setFlashProgress(0);
    update({ flash: { status: 'current' } });
    addLine('info', '开始烧录…烧录时不要拔 USB');
    const ac = new AbortController();
    flashAbort.current = ac;
    try {
      await link.flash(result.firmware_id || 'mock', result.firmware_files || [], (p) => {
        setFlashProgress(p.percentage);
        if (p.message) addLine('info', `${Math.round(p.percentage)}% ${p.message}`);
      }, ac.signal);
      update({ flash: { status: 'done' } });
      addLine('success', '烧录成功！小板正在重启，马上开始听它说话…');
      await new Promise((r) => setTimeout(r, mockMode ? 400 : 1500));
      await startSerial();
    } catch (err) {
      const text = childDeviceMessage(err);
      update({ flash: { status: 'error' } });
      say('flash', { kind: 'error', text });
      addLine('error', `烧录没成功：${text}`);
    } finally {
      setBusy((b) => ({ ...b, flash: false }));
      flashAbort.current = null;
    }
  }, [busy.flash, toolchain.connection.status, toolchain.build.status, mockMode, link, update, say, addLine, startSerial]);

  useEffect(() => () => { void link.stopSerial(); }, [link]);

  const confirmPhenomenon = useCallback(() => {
    addLine('success', '你确认看到了温湿度 / 听到了蜂鸣，主线完成 🎉');
    update({ serial: { status: 'done' } });
    markPhenomenon('user_confirm');
  }, [addLine, update, markPhenomenon]);

  return {
    lines, clearLines: () => setLines([]),
    messages, dismiss: (k: ActionKey) => say(k, null),
    busy, flashProgress, listening, deviceLabel, detected, compileErrors,
    confirmBoard, connect, compile, flash, startSerial, confirmPhenomenon,
    canConfirmPhenomenon: !phenomenonSuccess && toolchain.flash.status === 'done',
  };
}
