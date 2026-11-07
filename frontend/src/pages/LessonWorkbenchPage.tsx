/**
 * 第一课工作台（/editor 与 /workbench）。
 * 布局（冻结）：顶栏 项目/板型 → 连接 → 编译 → 烧录(最右主按钮)；左 课程步骤（可折叠）；
 * 中 积木|代码 + 「连线图」；底 串口（可拖拽）；右下 课程 Agent（唯一 AI 入口）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mascotMood } from '../lesson/mascotMood';
import { EVENT_REACTIONS, type ToolchainEvent } from '../lesson/guideScript';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLearnerAuthStore } from '../store/learnerAuthStore';
import '../styles/lesson.css';
import { useLessonStore } from '../lesson/lessonStore';
import { getLesson } from '../lesson/lessonRegistry';
import { effectiveTier, useAgeTier } from '../lesson/ageTier';
import { stepCopy } from '../lesson/tierCopy';
import { DemoDirector } from '../components/lesson/DemoDirector';
import { useEditorStore } from '../store/editorStore';
import { WorkbenchTopBar, type TopAction } from '../components/lesson/WorkbenchTopBar';
import { CourseStepsPanel } from '../components/lesson/CourseStepsPanel';
import { EditorPane } from '../components/lesson/EditorPane';
import { SerialDock } from '../components/lesson/SerialDock';
import { useLessonToolchain } from '../lesson/useLessonToolchain';
import { LessonErrorBoundary } from '../components/lesson/LessonErrorBoundary';
import { QuizModal } from '../components/lesson/QuizModal';
import { BADGES } from '../lesson/quiz';
import { fetchPublishedCourses } from '../catalog/publishedCourses';
import { fetchLatestSession, patchSession, startSession, syncProfile } from '../lesson/learner/sync';
import { LessonAgentDock, type CoachReaction } from '../components/lesson/LessonAgentDock';
import { useLearnerSensing } from '../lesson/learner/useLearnerSensing';
import { diagnose } from '../lesson/learner/diagnose';
import { perfFromEvents } from '../lesson/learner/profile';
import { bumpDifficulty } from '../lesson/learner/store';
import { STEP_SUGGESTIONS } from '../lesson/coursePack';
import type { ChatContextPayload } from '../components/lesson/agent/AgentChatPanel';
import { WiringDiagramPanel } from '../components/lesson/WiringDiagramPanel';
import { getBoard } from '../lesson/board';
import { checkCodeAgainstGraph, validateGraph } from '../lesson/connectionGraph';
import { FIRST_LESSON_CODE_BINDINGS, FIRST_LESSON_COMPONENTS, FIRST_LESSON_GRAPH, rewire } from '../lesson/coursePack';
import { SERIAL_MIN } from '../components/lesson/SerialDock';
import { describeAnchor, navigateTo, registerPrereqHandler, registerResolver, registerRevealer, uiSnapshot } from '../lesson/agent/anchors';
import { useWorkbenchUi, type LineDecoration } from '../lesson/agent/workbenchUi';
import { explainFix, applyCodeFix, parseFixSuggestions, ruleFixes, lintFirstLesson, validateFix, type FixSuggestion } from '../lesson/agent/fixes';
import { blockElement, getActiveWorkspace, getBlockFieldValue, revealBlock, setBlockFieldValue, clearBlockOutline } from '../blockly/workspaceBridge';
import type { FixMode } from '../components/lesson/agent/FixHintCard';
import type { FixView } from '../components/lesson/LessonAgentDock';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fixKey = (f: FixSuggestion) => `${f.target}:${f.line ?? f.blockId}:${f.field ?? ''}:${f.before}=>${f.after}`;
const fixAnchor = (f: FixSuggestion) => (f.target === 'block' ? `block.${f.blockId}${f.field ? `.field.${f.field}` : ''}` : `code.line.${f.insert ? Math.max(1, (f.line ?? 1) - 1) : f.line}`);
interface FixFlow { key: string; mode: FixMode; fix: FixSuggestion; undo?: { code?: string; block?: { blockId: string; field: string; value: string } } }

const BOARD = getBoard('xiao-esp32-s3')!;

export function LessonWorkbenchPage() {
  const [params] = useSearchParams();
  const pack = getLesson(params.get('course'));
  const [titleOverride, setTitleOverride] = useState<{ id: string; title: string } | null>(null);
  const lessonTitle = titleOverride?.id === pack.id ? titleOverride.title : pack.title;
  useEffect(() => {
    void syncProfile();
    // 先看后端有没有这门课更靠前的进度（本地是空白时才恢复），再开新会话
    void fetchLatestSession(pack.id).then((remote) => {
      const st = useLessonStore.getState();
      if (remote && st.coursePackId === pack.id && st.guideStepIndex === 0 && !st.phenomenonSuccess && remote.stepIndex > 0) {
        st.setGuideStep(Math.min(remote.stepIndex, pack.guide.length - 1));
        if (remote.mainlineCompleted) st.markPhenomenon('user_confirm');
      }
    }).finally(() => { void startSession(pack.id); });
  }, [pack.id, pack.guide.length]);
  useEffect(() => { void fetchPublishedCourses().then((p) => { const fl = p?.find((c) => c.slug === pack.id); if (fl?.title) setTitleOverride({ id: pack.id, title: String(fl.title).slice(0, 40) }); }); }, [pack.id]);
  const navigate = useNavigate();
  const lesson = useLessonStore();
  const { setSurface, dispatchAgent } = lesson;
  const freeMode = params.get('mode') === 'free';
  const { isAuthenticated, checkSession } = useLearnerAuthStore();
  const [authReady, setAuthReady] = useState(!freeMode);
  useEffect(() => {
    if (!freeMode) return;
    let cancelled = false;
    void checkSession().finally(() => { if (!cancelled) setAuthReady(true); });
    return () => { cancelled = true; };
  }, [freeMode, checkSession]);
  useEffect(() => {
    if (!freeMode || !authReady) return;
    if (!isAuthenticated) navigate('/login', { replace: true, state: { from: '/workbench?mode=free' } });
  }, [freeMode, authReady, isAuthenticated, navigate]);
  const steps = pack.guide;

  const tier = effectiveTier(useAgeTier((st) => st.tier));
  const stepIndex = Math.min(lesson.guideStepIndex, steps.length - 1);
  const step = steps[stepIndex];
  // 真正接线步（有 wiringAnchor）自动全屏；「认识作品」只高亮侧栏。换步跟随；本步内手动/Esc 只改 wiringFs
  const [wiringFs, setWiringFs] = useState(() => !freeMode && step.highlight === 'wiring.panel' && !!step.wiringAnchor);
  useEffect(() => {
    setWiringFs(!freeMode && step.highlight === 'wiring.panel' && !!step.wiringAnchor);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 换步骤是外部导航事件，全屏跟随接线步
  }, [step.id, step.highlight, step.wiringAnchor, freeMode]);

  const code = useEditorStore((s) => s.code);
  const setCode = useEditorStore((s) => s.setCode);
  const [serialHeight, setSerialHeight] = useState(180);
  const editorTab = useWorkbenchUi((st) => st.editorTab);
  const setDecorations = useWorkbenchUi((st) => st.setDecorations);

  // ── C3：Agent 导航的前置条件 / 揭示 / 动态锚点 ──
  useEffect(() => {
    const L = () => useLessonStore.getState();
    const offs = [
      registerPrereqHandler('steps.expand', () => { if (L().stepsCollapsed) L().toggleSteps(); }),
      registerPrereqHandler('wiring.expand', () => { if (L().wiringCollapsed) L().toggleWiring(); }),
      registerPrereqHandler('editor.tab.code', () => useWorkbenchUi.getState().setEditorTab('code')),
      registerPrereqHandler('editor.tab.blocks', async () => {
        useWorkbenchUi.getState().setEditorTab('blocks');
        for (let i = 0; i < 60 && !getActiveWorkspace(); i++) await sleep(50);
      }),
      registerPrereqHandler('serial.open', () => setSerialHeight((h) => (h <= SERIAL_MIN + 4 ? 200 : h))),
      registerRevealer('code.line.', (id) => { useWorkbenchUi.getState().revealLine(Number(id.slice('code.line.'.length))); return true; }),
      registerRevealer('block.', (id) => revealBlock(id)),
      registerResolver('block.', blockElement),
      registerResolver('pin.', (id) => { const pin = id.slice('pin.'.length); return document.querySelector(`[data-board-pin="${CSS.escape(pin)}"] circle`) ?? document.querySelector(`[data-board-pin="${CSS.escape(pin)}"]`); }),
      registerResolver('serial.line.', (id) => document.querySelector(`[data-serial-line="${id.slice('serial.line.'.length)}"]`)),
    ];
    return () => { offs.forEach((off) => off()); clearBlockOutline(); };
  }, []);

  // surface：课程工作台 GUIDING；自由创作 create（IDLE，仅求助/报错时答疑）
  useEffect(() => {
    setSurface(freeMode ? 'create' : 'workbench');
    return () => setSurface('catalog');
  }, [setSurface, freeMode]);

  // 进课：换课时把上一课的程序存起来、换成这节课的会话和程序；同一课首次进入填入课包程序（不覆盖学生已有修改）
  useEffect(() => {
    const st = useLessonStore.getState();
    const current = useEditorStore.getState().code;
    if (st.coursePackId !== pack.id) {
      try { localStorage.setItem(`makefast.code.${st.coursePackId}`, current); } catch { /* 忽略 */ }
      st.switchCourse(pack.id);
      let saved: string | null = null;
      try { saved = localStorage.getItem(`makefast.code.${pack.id}`); } catch { /* 忽略 */ }
      setCode(saved || pack.code);
    } else if (!current.trim() || current.includes('使用 AI 助手写代码')) setCode(pack.code);
  }, [pack.id, pack.code, setCode]);

  const doneIds = useMemo(() => {
    const done = new Set<string>();
    for (const s of steps) {
      const c = s.completesWhen;
      if (!c) continue;
      if (c === 'phenomenon' ? lesson.phenomenonSuccess : lesson.toolchain[c].status === 'done') done.add(s.id);
    }
    steps.forEach((s, i) => { if (!s.completesWhen && i < stepIndex) done.add(s.id); });
    return done;
  }, [steps, lesson.toolchain, lesson.phenomenonSuccess, stepIndex]);
  useEffect(() => {
    patchSession({ step_index: stepIndex, done_steps: [...doneIds], mainline_completed: lesson.phenomenonSuccess || undefined,
      toolchain: Object.fromEntries(Object.entries(lesson.toolchain).map(([k, v]) => [k, String(v.status)])) });
  }, [stepIndex, doneIds, lesson.phenomenonSuccess, lesson.toolchain]);

  // 连线图 + 校验（真源 board.json）
  const graph = lesson.graphSnapshot || FIRST_LESSON_GRAPH;
  const validation = useMemo(() => validateGraph(graph, BOARD, FIRST_LESSON_COMPONENTS), [graph]);
  const codeIssues = useMemo(() => checkCodeAgainstGraph(code, graph, BOARD, FIRST_LESSON_CODE_BINDINGS), [code, graph]);

  const tc = useLessonToolchain({ code, board: BOARD, validation, codeIssues, graphKey: JSON.stringify(graph.edges) });

  // ── Agent 反应：把工具链事件绑定到吉祥物情绪 + 气泡 ──
  const errorText = [tc.messages.connect, tc.messages.compile, tc.messages.flash].find((m) => m?.kind === 'error')?.text || null;
  const busyAny = !!(tc.busy.connect || tc.busy.compile || tc.busy.flash);
  const [reactionEvt, setReactionEvt] = useState<ToolchainEvent | null>(null);
  const [justSucceeded, setJustSucceeded] = useState(false);
  const prevRef = useRef({ c: tc.busy.connect, b: tc.busy.compile, f: tc.busy.flash, l: tc.listening, p: lesson.phenomenonSuccess, e: errorText });
  useEffect(() => {
    const prev = prevRef.current;
    const T0 = useLessonStore.getState().toolchain;
    let evt: ToolchainEvent | null = null;
    if (errorText && errorText !== prev.e) evt = 'error';
    else if (lesson.phenomenonSuccess && !prev.p) evt = 'phenomenon';
    else if (tc.busy.flash && !prev.f) evt = 'flash.start';
    else if (!tc.busy.flash && prev.f && T0.flash.status === 'done') evt = 'flash.done';
    else if (tc.busy.compile && !prev.b) evt = 'compile.start';
    else if (!tc.busy.compile && prev.b && T0.build.status === 'done') evt = 'compile.done';
    else if (tc.busy.connect && !prev.c) evt = 'connect.start';
    else if (!tc.busy.connect && prev.c && T0.connection.status === 'done') evt = 'connect.done';
    else if (tc.listening && !prev.l && !lesson.phenomenonSuccess) evt = 'serial.listening';
    prevRef.current = { c: tc.busy.connect, b: tc.busy.compile, f: tc.busy.flash, l: tc.listening, p: lesson.phenomenonSuccess, e: errorText };
    if (!evt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 工具链忙/完成是外部状态的“边沿”，只能在提交后比较前后值得到
    setReactionEvt(evt);
    const ok = evt.endsWith('.done');
    if (ok) setJustSucceeded(true);
    const t1 = setTimeout(() => setJustSucceeded(false), 1800);
    const t2 = setTimeout(() => setReactionEvt((cur) => (cur === evt ? null : cur)), evt === 'error' ? 8000 : 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [tc.busy.connect, tc.busy.compile, tc.busy.flash, tc.listening, lesson.phenomenonSuccess, errorText]);
  const mood = mascotMood({
    state: lesson.agent.state, busy: busyAny, error: !!errorText, justSucceeded,
    listening: tc.listening && !lesson.phenomenonSuccess, stepKind: step.kind,
  });

  // ── R10 学习状态感知 + 困难诊断 ──
  const guiding = lesson.agent.state !== 'IDLE';
  useEffect(() => {
    if (freeMode && errorText) dispatchAgent({ type: 'ASK_HELP' });
  }, [freeMode, errorText, dispatchAgent]);
  const sensing = useLearnerSensing(step.id, step.highlight === 'wiring.panel' ? 120 : 60, guiding);
  const prevMsgRef = useRef<Record<string, string | undefined>>({});
  useEffect(() => {
    const map = { connect: 'connect', compile: 'compile', flash: 'flash' } as const;
    for (const k of Object.keys(map) as (keyof typeof map)[]) {
      const m = tc.messages[k];
      const sig = m?.kind === 'error' ? m.text : undefined;
      if (sig && sig !== prevMsgRef.current[k]) sensing.log(`${map[k]}.fail` as 'compile.fail', { text: sig });
      prevMsgRef.current[k] = sig;
    }
  }, [tc.messages, sensing]);
  useEffect(() => { if (reactionEvt?.endsWith('.done')) sensing.log(reactionEvt === 'compile.done' ? 'compile.ok' : reactionEvt === 'flash.done' ? 'flash.ok' : 'connect.ok'); }, [reactionEvt, sensing]);
  useEffect(() => { if (lesson.phenomenonSuccess) sensing.log('phenomenon.ok'); }, [lesson.phenomenonSuccess, sensing]);
  const [rewires, setRewires] = useState(0);
  const nanCount = tc.lines.filter((l) => /nan/i.test(l.text)).length;
  const rawErrors = tc.lines.filter((l) => l.kind === 'error').slice(-5).map((l) => l.text).join('\n');
  const diagnosis = useMemo(() => (errorText ? diagnose({
    compileError: tc.messages.compile?.kind === 'error' ? `${tc.messages.compile.text}\n${rawErrors}` : null,
    flashError: tc.messages.flash?.kind === 'error' ? tc.messages.flash.text : null,
    connectError: tc.messages.connect?.kind === 'error' ? tc.messages.connect.text : null,
    wiringErrors: tc.messages.compile?.kind === 'error' && !validation.ok ? validation.errors.length : 0,
    serialNanCount: nanCount, rewireCount: rewires,
  }) : nanCount >= 3 ? diagnose({ serialNanCount: nanCount }) : null), [errorText, tc.messages, rawErrors, validation, nanCount, rewires]);
  useEffect(() => { if (diagnosis) bumpDifficulty(diagnosis.category); }, [diagnosis?.category]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── C4：代码 / 积木修改建议 ──
  const gpioOfEdge = useCallback((edgeId: string) => {
    const e = graph.edges.find((x) => x.id === edgeId);
    return BOARD.pins.find((p) => p.id === e?.to.port)?.gpio;
  }, [graph]);
  const wiringGpio = useMemo(() => ({ DHT_PIN: gpioOfEdge('dht-data'), BUZZER_PIN: gpioOfEdge('bz-s') }), [gpioOfEdge]);
  const [blockPins, setBlockPins] = useState<{ DHT_PIN?: string; BUZZER_PIN?: string }>({});
  if (editorTab !== 'blocks' && Object.keys(blockPins).length) setBlockPins({});
  useEffect(() => {
    if (editorTab !== 'blocks') return;
    const t = setTimeout(() => setBlockPins({ DHT_PIN: getBlockFieldValue('dht_setup', 'PIN'), BUZZER_PIN: getBlockFieldValue('buzzer_setup', 'PIN') }), 60);
    return () => clearTimeout(t);
  }, [editorTab, code]);
  const [compileAttempted, setCompileAttempted] = useState(false);
  if (tc.busy.compile && !compileAttempted) setCompileAttempted(true);
  const buildFailed = lesson.toolchain.build.status === 'error';
  const errorFixes = useMemo(() => (buildFailed ? ruleFixes({ code, errors: tc.compileErrors }) : []), [buildFailed, code, tc.compileErrors]);
  const warnFixes = useMemo(() => ruleFixes({ code, wiringGpio, blocksOpen: editorTab === 'blocks', blockPins }), [code, wiringGpio, editorTab, blockPins]);
  const [llmFix, setLlmFix] = useState<FixSuggestion | null>(null);
  const llmValid = llmFix && validateFix(llmFix, code).ok ? llmFix : null;
  const candidates = useMemo(() => [
    ...(llmValid ? [llmValid] : []),
    ...errorFixes,
    ...warnFixes.filter((f) => f.target === 'block' || compileAttempted),
  ], [llmValid, errorFixes, warnFixes, compileAttempted]);
  const [flow, setFlow] = useState<FixFlow | null>(null);
  const [dismissedFixes, setDismissedFixes] = useState<string[]>([]);
  const candidate = candidates.find((f) => !dismissedFixes.includes(fixKey(f))) || null;
  const candKey = candidate ? fixKey(candidate) : null;
  const detectedKeys = candidates.map(fixKey).join('|');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 修改建议状态机跟随检测结果（含计时自动收起），按检测键变化推进
    setFlow((cur) => {
      if (cur?.mode === 'self') {
        return detectedKeys.split('|').includes(cur.key) ? cur : { ...cur, mode: 'resolved' };
      }
      // 已改好 / 已解决的卡片：出现新的问题时立刻换成新建议
      if (cur?.mode === 'applied' || cur?.mode === 'resolved') return candidate && candKey !== cur.key ? { key: candKey!, mode: 'offer', fix: candidate } : cur;
      if (!candidate) return null;
      return cur?.key === candKey ? cur : { key: candKey!, mode: 'offer', fix: candidate };
    });
  }, [candKey, detectedKeys]); // eslint-disable-line react-hooks/exhaustive-deps
  // 新建议出现：切到对应标签、滚到那一行 / 居中那块积木
  useEffect(() => {
    if (flow?.mode === 'offer') void navigateTo(fixAnchor(flow.fix), { coach: false });
  }, [flow?.key, flow?.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (flow?.mode !== 'resolved' && flow?.mode !== 'applied') return;
    if (flow.mode === 'resolved') sensing.log('help.request', { text: `fix.self_resolved:${flow.fix.title}` });
    const t = setTimeout(() => setFlow((cur) => (cur && cur.key === flow.key && cur.mode === flow.mode ? null : cur)), flow.mode === 'resolved' ? 7000 : 15000);
    return () => clearTimeout(t);
  }, [flow?.key, flow?.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // 代码行装饰：报错行（红）+ 建议行（黄）
  useEffect(() => {
    const d: LineDecoration[] = [];
    if (buildFailed) tc.compileErrors.forEach((e) => { if (e.line) d.push({ line: e.line, kind: 'error' }); });
    if (flow && flow.fix.target === 'code_line' && flow.mode !== 'resolved') {
      const n = Number(fixAnchor(flow.fix).slice('code.line.'.length));
      for (let i = d.length - 1; i >= 0; i--) if (d[i].line === n) d.splice(i, 1);
      d.push({ line: n, kind: flow.mode === 'applied' ? 'focus' : 'fix' });
    }
    setDecorations(d);
  }, [buildFailed, tc.compileErrors, flow, setDecorations]);
  useEffect(() => () => setDecorations([]), [setDecorations]);

  const fixView: FixView | null = flow ? {
    fix: flow.fix, mode: flow.mode, anchor: fixAnchor(flow.fix),
    reasoning: explainFix(flow.fix, { errors: tc.compileErrors, wiringGpio }),
    onSelf: () => {
      setFlow((cur) => (cur ? { ...cur, mode: 'self' } : cur));
      if (flow.fix.target === 'code_line') {
        const n = Number(fixAnchor(flow.fix).slice('code.line.'.length));
        useWorkbenchUi.setState({ reveal: { line: n, nonce: Date.now(), focus: true } });
      } else void navigateTo(fixAnchor(flow.fix), { coach: false });
    },
    onApply: () => {
      const f = flow.fix;
      if (f.target === 'code_line') {
        if (!validateFix(f, code).ok) { setFlow(null); setLlmFix(null); return; }
        const prev = code;
        setCode(applyCodeFix(code, f));
        setFlow({ ...flow, mode: 'applied', undo: { code: prev } });
      } else if (f.blockId && f.field) {
        const prevVal = getBlockFieldValue(f.blockId, f.field);
        if (prevVal === undefined || !setBlockFieldValue(f.blockId, f.field, f.after)) { setFlow(null); return; }
        setFlow({ ...flow, mode: 'applied', undo: { block: { blockId: f.blockId, field: f.field, value: prevVal } } });
      }
      sensing.log('hint.shown', { level: 'do' });
      if (llmFix) setLlmFix(null);
    },
    onUndo: () => {
      const f = flow.fix;
      let again = false;
      if (flow.undo?.code !== undefined) {
        setCode(flow.undo.code);
        // 撤销后立刻重新做本地检查：问题还在就马上把同一条建议再摆出来
        const errs = lintFirstLesson(flow.undo.code);
        again = validateFix(f, flow.undo.code).ok && (f.source === 'llm' || ruleFixes({ code: flow.undo.code, errors: errs, wiringGpio }).some((x) => fixKey(x) === flow.key) || errs.length > 0);
      }
      if (flow.undo?.block) { setBlockFieldValue(flow.undo.block.blockId, flow.undo.block.field, flow.undo.block.value); again = true; }
      setFlow(again ? { key: flow.key, mode: 'offer', fix: f } : null);
    },
    onClose: () => { setDismissedFixes((d) => [...d, flow.key]); setFlow(null); if (llmFix) setLlmFix(null); },
    onRecompile: () => { setFlow(null); void navigateTo('topbar.compile', { title: '点「编译」再试一次', text: '改好了就重新编译，看看还有没有红色提示。' }); },
  } : null;
  const showFixFromChat = useCallback((raw: unknown) => {
    const list = parseFixSuggestions(raw, 'llm').filter((f) => validateFix(f, useEditorStore.getState().code).ok);
    if (!list.length) return false;
    setDismissedFixes((d) => d.filter((k) => k !== fixKey(list[0])));
    setLlmFix(list[0]);
    setFlow(null);
    return true;
  }, []);

  // 诊断 → 精确锚点（具体代码行 / 那根线 / 模拟模式开关）
  const preciseDiagnosis = useMemo(() => {
    if (!diagnosis) return null;
    let anchor = diagnosis.anchor;
    if (diagnosis.category === 'syntax') {
      const n = tc.compileErrors.find((e) => e.line)?.line;
      if (flow) anchor = fixAnchor(flow.fix); else if (n) anchor = `code.line.${n}`;
    } else if (diagnosis.category === 'wiring') {
      const edge = validation.errors.find((e) => e.edgeId)?.edgeId;
      anchor = edge ? `wire.${edge}` : nanCount >= 3 ? 'wire.dht-data' : 'wiring.panel';
    } else if (diagnosis.category === 'library' && !lesson.mockMode) anchor = 'topbar.mock';
    if (anchor === diagnosis.anchor) return diagnosis;
    const label = anchor.startsWith('code.line.') ? `第 ${anchor.slice(10)} 行` : anchor.startsWith('wire.') ? '那根线' : describeAnchor(anchor)?.label?.replace(/[「」]/g, '') || diagnosis.anchorLabel;
    return { ...diagnosis, anchor, anchorLabel: label };
  }, [diagnosis, tc.compileErrors, flow, validation, nanCount, lesson.mockMode]);

  const PIN_FOR: Record<string, string> = { dht: 'D0', buzzer: 'D1' };
  const stepAnchor = step.wiringAnchor && PIN_FOR[step.wiringAnchor] ? `pin.${PIN_FOR[step.wiringAnchor]}` : step.highlight;
  const REACTION_ANCHOR: Partial<Record<ToolchainEvent, string>> = {
    'connect.start': 'topbar.connect', 'connect.done': 'topbar.connect', 'compile.start': 'topbar.compile', 'compile.done': 'topbar.compile',
    'flash.start': 'topbar.flash', 'flash.done': 'topbar.flash', 'serial.listening': 'serial', phenomenon: 'serial',
  };
  const reaction: CoachReaction | null = reactionEvt ? { ...EVENT_REACTIONS[reactionEvt], anchor: REACTION_ANCHOR[reactionEvt] } : null;

  const goTo = useCallback((anchor: string) => {
    const d = preciseDiagnosis && preciseDiagnosis.anchor === anchor ? preciseDiagnosis : null;
    void navigateTo(anchor, d ? { title: d.title, text: d.steps.map((x, i) => `${i + 1}. ${x}`).join('\n'), tone: 'warning' } : {});
  }, [preciseDiagnosis]);

  const hintText = useCallback(() => {
    const level = sensing.nextHintLevel();
    if (level === 'nudge') return `想一想：要做到「${step.success}」，先要做什么呢？看看我高亮的地方 👀`;
    if (level === 'hint') return `提示：${step.do}\n💡 因为${step.why}`;
    if (level === 'show') return diagnosis ? `照着做：\n${diagnosis.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : `照着做：${step.do}\n做好之后你会看到：${step.success}`;
    return step.highlight === 'wiring.panel' ? '还是不行的话，可以在「连线图」点「恢复课程推荐接法」，我帮你把线接回推荐的位置（需要你自己点确认哦）。' : `我已经帮你把要点的地方高亮了，点一下「${diagnosis?.anchorLabel || '高亮的按钮'}」试试，我在旁边陪你 🐱`;
  }, [sensing, step, diagnosis]);

  const chatContext: ChatContextPayload = {
    course_id: pack.metaId, course_title: lessonTitle,
    step: { id: step.id, title: step.title, ...stepCopy(step, tier) },
    age_tier: tier,
    board_summary: `${BOARD.name}：` + BOARD.pins.slice(0, 14).map((p) => p.id).join(' '),
    wiring_summary: graph.edges.map((e) => `${graph.nodes.find((n) => n.id === e.from.nodeId)?.label ?? e.from.nodeId} ${e.from.port} → 小板 ${e.to.port}`).join('；'),
    validation: [...validation.errors, ...validation.warnings].map((v) => v.childMessage),
    code_excerpt: code.slice(0, 4000),
    serial_tail: tc.lines.slice(-20).map((l) => l.text),
    last_error: errorText, faq: pack.faq,
  };

  const goStep = useCallback((i: number) => lesson.setGuideStep(Math.max(0, Math.min(steps.length - 1, i))), [lesson, steps.length]);

  // 当前步骤由工具链自动完成时，自动前进到下一步（引导跟着孩子走，不需要答题）
  const stepAutoDone = !!step.completesWhen && doneIds.has(step.id);
  useEffect(() => {
    if (!stepAutoDone || stepIndex >= steps.length - 1) return;
    const t = setTimeout(() => useLessonStore.getState().setGuideStep(stepIndex + 1), 900);
    return () => clearTimeout(t);
  }, [stepAutoDone, stepIndex, steps.length]);

  // 课后小练习：surface=quiz 时 Agent 进入 QUIET_HELP
  const [quizOpen, setQuizOpen] = useState(false);
  const openQuiz = useCallback(() => {
    if (freeMode) return;
    setQuizOpen(true);
    if (useLessonStore.getState().phenomenonSuccess) {
      setSurface('quiz');
      useLessonStore.getState().setQuizStatus('in_progress');
    }
  }, [setSurface, freeMode]);
  const closeQuiz = useCallback(() => { setQuizOpen(false); setSurface(freeMode ? 'create' : 'workbench'); }, [setSurface, freeMode]);
  const quizLabel = lesson.quizStatus === 'passed' ? '再看看课后小练习' : '开始课后小练习';

  const T = lesson.toolchain;
  const board: TopAction = {
    status: T.board.status, label: BOARD.name.replace('Seeed Studio ', ''),
    message: tc.messages.board, onClick: tc.confirmBoard,
  };
  const connect: TopAction = {
    status: T.connection.status,
    label: T.connection.status === 'done' ? (tc.deviceLabel ? `已连接 · ${tc.deviceLabel}` : '已连接') : '连接',
    busy: tc.busy.connect, busyLabel: '正在连接…',
    message: tc.messages.connect, onDismissMessage: () => tc.dismiss('connect'), onClick: () => void tc.connect(),
  };
  const compile: TopAction = {
    status: T.build.status, label: '编译', busy: tc.busy.compile, busyLabel: '编译中…', disabled: tc.busy.compile,
    message: tc.messages.compile, onDismissMessage: () => tc.dismiss('compile'), onClick: () => void tc.compile(),
  };
  const flash: TopAction = {
    status: T.flash.status, label: '烧录', busy: tc.busy.flash, busyLabel: `烧录中 ${Math.round(tc.flashProgress)}%（点击停止）`,
    progress: tc.flashProgress,
    message: tc.messages.flash, onDismissMessage: () => tc.dismiss('flash'), onClick: () => void tc.flash(),
  };

  return (
    <div className="lw" data-testid="lesson-workbench">
      <WorkbenchTopBar detectNote={tc.detected}
        title={freeMode ? '自由创作' : lessonTitle}
        onBack={() => navigate('/home')}
        mockMode={lesson.mockMode}
        onMockModeChange={lesson.setMockMode}
        board={board}
        connect={connect}
        compile={compile}
        flash={flash}
        highlight={lesson.agent.state === 'GUIDING' ? step.highlight : null}
      />
      <div className="lw-body">
        {freeMode ? (
          <aside className="lw-course" data-testid="free-create-panel" aria-label="自由创作">
            <div className="lw-course__head"><div><h2>自由创作</h2><small>没有强制步骤，有问题再叫小铁猫</small></div></div>
            <div className="lw-course__list" style={{ padding: 14, fontSize: 13, lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 10px' }}>在这里随便接线、写程序、编译试试。小铁猫不会主动打断你；点右下角可以提问，编译出错时它也会来帮忙。</p>
              <button type="button" className="lw-btn lw-btn--sm" onClick={() => navigate('/dashboard')}>我的作品</button>
            </div>
          </aside>
        ) : (
        <CourseStepsPanel title={lessonTitle} steps={steps} activeIndex={stepIndex} doneIds={doneIds}
          collapsed={freeMode || lesson.stepsCollapsed} onToggle={lesson.toggleSteps} onSelect={goStep}
          footer={
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <button type="button" className={`lw-btn lw-btn--sm ${lesson.phenomenonSuccess ? 'lw-btn--primary' : ''}`} onClick={openQuiz}
                title={lesson.phenomenonSuccess ? '' : '完成主线后解锁'} data-testid="open-quiz">
                {lesson.phenomenonSuccess ? '📝 ' + quizLabel : '🔒 课后小练习（完成主线后解锁）'}
              </button>
              {lesson.badges.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="已获得徽章">
                  {lesson.badges.map((b) => <span key={b} className="lw-pill lw-pill--warning" title={BADGES[b].desc}>{BADGES[b].icon} {BADGES[b].name}</span>)}
                </div>
              )}
              <button type="button" className="lw-btn lw-btn--sm lw-btn--ghost" onClick={() => { if (window.confirm('重新开始本课？进度和徽章会清空，你写的程序会保留。')) lesson.resetLesson(); }}>↺ 重新开始本课</button>
            </div>
          } />        )}

        <div className="lw-center">
          <LessonErrorBoundary label="编辑区">
            <EditorPane code={code} onCodeChange={setCode} highlighted={lesson.agent.state === 'GUIDING' && step.highlight === 'editor'} />
          </LessonErrorBoundary>
          <WiringDiagramPanel
            graph={graph}
            board={BOARD}
            components={FIRST_LESSON_COMPONENTS}
            validation={validation}
            codeIssues={codeIssues}
            activeAnchor={lesson.agent.state === 'GUIDING' ? step.wiringAnchor : null}
            highlighted={lesson.agent.state === 'GUIDING' && step.highlight === 'wiring.panel'}
            collapsed={lesson.wiringCollapsed}
            onToggle={lesson.toggleWiring}
            fullscreen={wiringFs}
            onFullscreenChange={setWiringFs}
            onRewire={(edgeId, pinId) => { setRewires((n) => n + 1); const g = rewire(graph, edgeId, pinId); lesson.setGraphSnapshot(g); sensing.log('wiring.change', { edgeId, errors: validateGraph(g, BOARD, FIRST_LESSON_COMPONENTS).errors.length }); }}
            onReset={() => lesson.setGraphSnapshot(null)}
            isDefault={!lesson.graphSnapshot}
          />
        </div>
      </div>
      <SerialDock
        lines={tc.lines}
        height={serialHeight}
        onHeightChange={setSerialHeight}
        connected={T.connection.status === 'done'}
        listening={tc.listening}
        mockMode={lesson.mockMode}
        phenomenonSuccess={lesson.phenomenonSuccess}
        canConfirm={tc.canConfirmPhenomenon}
        onConfirmPhenomenon={tc.confirmPhenomenon}
        onClear={tc.clearLines}
        highlighted={lesson.agent.state === 'GUIDING' && step.highlight === 'serial'}
      />
      <LessonAgentDock
        greeting={!freeMode && stepIndex === 0 && !lesson.phenomenonSuccess ? pack.greeting[tier] : undefined}
        state={lesson.agent.state}
        step={step}
        stepIndex={stepIndex}
        stepCount={steps.length}
        stepDone={doneIds.has(step.id)}
        bottomOffset={serialHeight + 26}
        warning={errorText}
        mood={mood}
        reaction={reaction}
        stepAnchor={stepAnchor}
        diagnosis={preciseDiagnosis}
        stuck={sensing.stuck}
        fix={fixView}
        onShowFix={showFixFromChat}
        uiSnapshot={() => uiSnapshot({ editor_tab: useWorkbenchUi.getState().editorTab, step_id: step.id, mock_mode: lesson.mockMode })}
        chatContext={chatContext}
        suggestions={[...(errorText ? ['刚才的错误是什么意思？'] : []), ...(STEP_SUGGESTIONS[step.id] || [])]}
        onPrev={() => goStep(stepIndex - 1)}
        onNext={() => goStep(stepIndex + 1)}
        onAskHelp={() => dispatchAgent({ type: 'ASK_HELP' })}
        onCloseHelp={() => dispatchAgent({ type: 'CLOSE_HELP' })}
        onOpenQuiz={openQuiz}
        quizLabel={quizLabel}
        onGoTo={goTo}
        onHint={hintText}
        onDismissStep={sensing.dismissStep}
        onDismissStuck={sensing.dismissStuck}
        onAcceptStuck={() => sensing.clearStuck()}
        onChatAsk={(q, cat) => sensing.log('help.request', { text: `${cat}:${q.slice(0, 40)}` })}
      />
      {params.get('demo') === '1' && (
        <DemoDirector code={pack.code} quiz={pack.quiz} onExit={() => navigate(`/workbench?course=${pack.id}`)} />
      )}
      {quizOpen && (
        <QuizModal
          spec={pack.quiz}
          courseId={pack.metaId}
          locked={!lesson.phenomenonSuccess}
          badges={lesson.badges}
          autoObserved={lesson.phenomenonSource === 'auto_serial'}
          onSubmit={(g) => lesson.recordQuiz({ mcqCorrect: g.mcqCorrect, practicalOk: g.practicalOk, passed: g.passed })}
          onClose={closeQuiz}
          onBackToCatalog={() => navigate('/courses')}
          lessonPerf={perfFromEvents(sensing.events(), sensing.maxHintLevel(), lesson.phenomenonSuccess)}
        />
      )}
    </div>
  );
}
