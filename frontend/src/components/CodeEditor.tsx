/**
 * 代码编辑器组件
 * 
 * 提供代码编辑、字符计数、验证等功能
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileCode2,
  Clipboard,
  Trash2,
  AlertTriangle,
  Download,
} from 'lucide-react';

interface CodeFile {
  id: string;
  name: string;
  content: string;
  type: 'ino' | 'cpp' | 'h' | 'c' | 'hpp' | 'other';
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  readOnly?: boolean;
  headerHint?: React.ReactNode;
  /** 多文件标签栏 */
  files?: CodeFile[];
  activeFileId?: string;
  onActiveFileChange?: (fileId: string) => void;
  onFileRename?: (fileId: string, newName: string) => void;
  onFileClose?: (fileId: string) => void;
  onAddFile?: () => void;
  onDownload?: () => void;
  /** Agent 代码行装饰（错误 / 修改建议 / 焦点）：行背景 + 行号旁标记 */
  decorations?: { line: number; kind: 'error' | 'fix' | 'focus'; note?: string }[];
  /** 滚动到某行（nonce 变化触发）；focus=true 时把光标放到行尾 */
  reveal?: { line: number; nonce: number; focus?: boolean } | null;
  /** 为每一行渲染 Agent 锚点 data-lw-anchor="<prefix><行号>"（行文字范围） */
  lineAnchorPrefix?: string;
}

export function CodeEditor({
  value,
  onChange,
  maxLength = 50000,
  placeholder = '在这里输入你的 Arduino 代码...',
  readOnly = false,
  headerHint,
  files,
  activeFileId,
  onActiveFileChange,
  onFileRename,
  onFileClose,
  onAddFile,
  onDownload,
  decorations,
  reveal,
  lineAnchorPrefix,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [metrics, setMetrics] = useState({ lh: 22.4, padTop: 16, padLeft: 16, ch: 8.4 });

  // 量一次行高 / 字宽，用于代码行装饰和锚点定位
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || typeof window === 'undefined') return;
    const cs = window.getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 22.4;
    const padTop = parseFloat(cs.paddingTop) || 16;
    const padLeft = parseFloat(cs.paddingLeft) || 16;
    let ch = 8.4;
    try {
      const ctx = /jsdom/i.test(navigator.userAgent) ? null : document.createElement('canvas').getContext('2d');
      if (ctx) { ctx.font = `${cs.fontSize} ${cs.fontFamily}`; ch = ctx.measureText('0000000000').width / 10 || ch; }
    } catch { /* jsdom 无 canvas */ }
    setMetrics({ lh, padTop, padLeft, ch });
  }, []);

  // 揭示某一行：滚到中间；需要时把光标放到行尾
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !reveal) return;
    const { lh } = metrics;
    ta.scrollTop = Math.max(0, (reveal.line - 1) * lh - ta.clientHeight / 2 + lh);
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    if (reveal.focus) {
      const ls = value.split('\n');
      const pos = ls.slice(0, reveal.line).join('\n').length;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos;
    }
  }, [reveal?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动保存：代码变更后 1 秒保存到 localStorage
  useEffect(() => {
    if (!value) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('esp-editor-autosave', value);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus(null);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [value]);

  // 撤销/重做历史
  const historyRef = useRef<string[]>([value]);
  const historyIdxRef = useRef(0);
  const lastPushRef = useRef(0);
  const ignoreNextRef = useRef(false);

  // 将当前值推入历史（防抖 500ms）
  const pushHistory = useCallback((v: string, force = false) => {
    if (ignoreNextRef.current) { ignoreNextRef.current = false; return; }
    const now = Date.now();
    const last = historyRef.current[historyIdxRef.current];
    if (last === v) return;
    const debounce = !force && now - lastPushRef.current < 500;
    if (debounce && historyIdxRef.current > 0) {
      historyRef.current[historyIdxRef.current] = v;
    } else {
      // 截断当前位置之后的历史
      historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
      historyRef.current.push(v);
      historyIdxRef.current = historyRef.current.length - 1;
    }
    lastPushRef.current = now;
  }, []);

  // 对外 onChange 包装
  const handleChange = useCallback((newValue: string) => {
    pushHistory(newValue);
    onChange(newValue);
  }, [onChange, pushHistory]);

  // 监听外部 value 变化（如 AI 部署），推入历史栈
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      pushHistory(value, true);
      prevValueRef.current = value;
    }
  }, [value, pushHistory]);

  // 同步行号滚动
  const handleScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
      setScroll({ top: textareaRef.current.scrollTop, left: textareaRef.current.scrollLeft });
    }
  };

  // 计算代码统计信息
  const stats = {
    chars: value.length,
    lines: value.split('\n').length,
    percentage: Math.round((value.length / maxLength) * 100)
  };

  const lineList = value.split('\n');
  const decoMap = new Map((decorations || []).map((d) => [d.line, d]));

  // 判断是否接近限制
  const isNearLimit = stats.percentage >= 80;
  const isOverLimit = value.length > maxLength;

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const meta = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl+S → 保存到本地缓存
    if (meta && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      try {
        localStorage.setItem('esp-editor-autosave', value);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus(null);
      }
      return;
    }

    // Cmd/Ctrl+Z → 撤销
    if (meta && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (historyIdxRef.current > 0) {
        historyIdxRef.current--;
        ignoreNextRef.current = true;
        const prev = historyRef.current[historyIdxRef.current];
        onChange(prev);
        // 恢复光标到末尾
        setTimeout(() => {
          if (textareaRef.current) {
            const pos = prev.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos;
          }
        }, 0);
      }
      return;
    }

    // Cmd/Ctrl+Shift+Z → 重做
    if ((meta && e.shiftKey && e.key === 'z') || (meta && !e.shiftKey && e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      if (historyIdxRef.current < historyRef.current.length - 1) {
        historyIdxRef.current++;
        ignoreNextRef.current = true;
        const next = historyRef.current[historyIdxRef.current];
        onChange(next);
        setTimeout(() => {
          if (textareaRef.current) {
            const pos = next.length;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos;
          }
        }, 0);
      }
      return;
    }

    // Cmd/Ctrl+/ → 切换行注释
    if (meta && e.key === '/') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEndIndex = value.indexOf('\n', end);
      const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
      const block = value.slice(lineStart, lineEnd);
      const lines = block.split('\n');
      const shouldUncomment = lines.every(line => line.trim() === '' || line.trimStart().startsWith('//'));
      const nextBlock = lines.map(line => {
        if (line.trim() === '') return line;
        if (!shouldUncomment) return `// ${line}`;
        const indent = line.match(/^\s*/)?.[0] || '';
        return indent + line.slice(indent.length).replace(/^\/\/\s?/, '');
      }).join('\n');
      const newValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
      handleChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + nextBlock.length;
      }, 0);
      return;
    }

    // Tab 键缩进
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end && value.slice(start, end).includes('\n')) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const selected = value.slice(lineStart, end);
        const lines = selected.split('\n');
        const nextSelected = e.shiftKey
          ? lines.map(line => line.startsWith('  ') ? line.slice(2) : line.startsWith('\t') ? line.slice(1) : line).join('\n')
          : lines.map(line => `  ${line}`).join('\n');
        const newValue = value.slice(0, lineStart) + nextSelected + value.slice(end);
        handleChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart + nextSelected.length;
        }, 0);
        return;
      }

      if (e.shiftKey) return;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);

      handleChange(newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };
  
  // 清空代码
  const handleClear = () => {
    if (confirm('确定要清空所有代码吗？')) {
      handleChange('');
      textareaRef.current?.focus();
    }
  };
  
  // 复制代码
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };
  
  return (
    <div className="code-editor flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Sub Toolbar - 文件标签 + 操作按钮 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 py-2 bg-white border-b border-slate-100 gap-3 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          {files && files.length > 0 ? (
            <>
              {files.map((f) => {
                const isActive = f.id === activeFileId;
                const isRenaming = renamingId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => onActiveFileChange?.(f.id)}
                    onDoubleClick={() => { setRenamingId(f.id); setRenameValue(f.name); }}
                    title="双击重命名"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-white border border-slate-200 text-slate-800 font-bold shadow-sm border-b-2 border-b-blue-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 font-medium hover:bg-slate-100'
                    }`}
                  >
                    <FileCode2 size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                    {isRenaming ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => { if (renameValue.trim() && renameValue !== f.name) onFileRename?.(f.id, renameValue.trim()); setRenamingId(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { if (renameValue.trim() && renameValue !== f.name) onFileRename?.(f.id, renameValue.trim()); setRenamingId(null); }
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="px-1 border border-indigo-500 rounded text-xs bg-white outline-none"
                        style={{ width: Math.max(60, renameValue.length * 8 + 16) }}
                      />
                    ) : (
                      <span className="text-xs whitespace-nowrap">{f.name}</span>
                    )}
                    <span
                      className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onFileClose?.(f.id); }}
                      title="关闭文件"
                    >×</span>
                  </div>
                );
              })}
              {onAddFile && (
                <button onClick={onAddFile} className="w-8 h-8 flex items-center justify-center border border-dashed border-slate-300 rounded-md text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-colors ml-1" title="新建文件">
                  +
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm text-slate-800 font-bold shadow-sm border-b-2 border-b-blue-500">
              <FileCode2 size={14} className="text-blue-500" />
              <span className="text-xs">sketch.ino</span>
            </div>
          )}
        </div>

        {/* 头部中间提示区（如代码转换错误） */}
        {headerHint && (
          <div className="code-editor__header-hint">
            {headerHint}
          </div>
        )}

        {/* 工具栏 */}
        <div className="flex items-center gap-2 shrink-0">
          {onDownload && (
            <button
              onClick={onDownload}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white shadow-sm"
              title="下载项目"
            >
              <Download size={14} />
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!value}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white shadow-sm"
            title="复制代码"
          >
            <Clipboard size={14} />
          </button>
          <button
            onClick={handleClear}
            disabled={!value}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors bg-white shadow-sm"
            title="清空代码"
          >
            <Trash2 size={14} />
          </button>
          <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-tight ml-2 ${
            isOverLimit ? 'bg-red-100 text-red-600' :
            isNearLimit ? 'bg-amber-100 text-amber-600' :
            'bg-slate-100 text-slate-600'
          }`}>
            {stats.chars.toLocaleString()} / {maxLength.toLocaleString()}
          </div>
        </div>

        {/* 复制成功提示 */}
        {copySuccess && (
          <div className="absolute top-12 right-4 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 text-xs font-medium shadow-sm z-10 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            已复制到剪贴板
          </div>
        )}
      </div>

      {/* 代码编辑区 - 暗色主题 */}
      <div className="flex-1 bg-[#0d1117] relative flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex text-sm overflow-hidden relative">
          {/* 行号 */}
          <div className="w-12 shrink-0 bg-[#0d1117] border-r border-slate-800 flex flex-col text-slate-500 font-mono items-end pr-3 py-4 select-none overflow-hidden" ref={gutterRef}>
            {Array.from({ length: stats.lines }, (_, i) => {
              const deco = decoMap.get(i + 1);
              return (
                <div key={i} className={`leading-[1.6] relative ${deco ? `ce-gutter--${deco.kind}` : ''}`} data-gutter-line={i + 1}>
                  {deco && <span className="ce-gutter__mark" aria-label={deco.kind === 'fix' ? '这一行有修改建议' : deco.kind === 'error' ? '这一行有错误' : '看这一行'}>{deco.kind === 'fix' ? '💡' : deco.kind === 'error' ? '●' : '▸'}</span>}
                  {i + 1}
                </div>
              );
            })}
          </div>

          {/* 文本编辑器 */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            readOnly={readOnly}
            className="flex-1 bg-transparent text-[#e6edf3] font-mono p-4 relative z-[1] leading-[1.6] resize-none outline-none border-0 overflow-y-auto"
            placeholder={placeholder}
            spellCheck={false}
            wrap="off"
            onScroll={handleScroll}
          />

          {/* Agent 代码行装饰 + 行锚点（不拦截输入） */}
          {(lineAnchorPrefix || (decorations && decorations.length > 0)) && (
            <div className="ce-deco" aria-hidden="true" style={{ left: 48 }}>
              <div style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
                {(decorations || []).map((d, di) => (
                  <div key={`d-${d.line}-${d.kind}-${di}`} className={`ce-deco__line ce-deco__line--${d.kind}`}
                    style={{ top: metrics.padTop + (d.line - 1) * metrics.lh, height: metrics.lh }} />
                ))}
                {lineAnchorPrefix && lineList.slice(0, 600).map((text, i) => (
                  <span key={`a-${i}`} className="ce-deco__anchor" data-lw-anchor={`${lineAnchorPrefix}${i + 1}`}
                    style={{ top: metrics.padTop + i * metrics.lh, height: metrics.lh, left: metrics.padLeft - 4,
                      width: Math.max(24, text.replace(/\t/g, '  ').length * metrics.ch + 8) }} />
                ))}
              </div>
            </div>
          )}

          {/* 焦点指示器 */}
          {isFocused && (
            <div className="absolute top-2 right-3 flex items-center gap-1.5 bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span>编辑中</span>
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="h-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-3 text-xs text-slate-500 font-semibold font-mono shrink-0">
          <div className="flex gap-4">
            <span>{stats.lines} 行</span>
            <span>{stats.chars} 字符</span>
            {saveStatus && (
              <span className={saveStatus === 'saved' ? 'text-emerald-500' : 'text-slate-400'}>
                {saveStatus === 'saved' ? '已保存' : '保存中...'}
              </span>
            )}
            {isOverLimit && (
              <span className="text-red-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                超出限制 {(stats.chars - maxLength).toLocaleString()} 字符
              </span>
            )}
          </div>
          <div className="flex gap-4">
            <span>Tab 缩进</span>
            <span>⇧Tab 反缩进</span>
            <span>⌘/ 注释</span>
            <span>⌘S 保存</span>
            <span>⌘Z 撤销</span>
            <span>⌘⇧Z 重做</span>
          </div>
        </div>
      </div>
    </div>
  );
}
