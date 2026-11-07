/**
 * 开发板管理页面
 * 管理员可拖拽排序、添加、编辑、删除、恢复开发板，安装平台核心
 * 按 chip family 分组展示，序号与用户端下拉框一致
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AdminClient } from '../api/adminClient';
import type { BoardConfigFull, BoardSearchResult } from '../api/types';
import {
  Cpu,
  Plus,
  PencilIcon,
  Trash2,
  XCircle,
  Search,
  RefreshCw,
  Download,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const PLATFORM_OPTIONS = [
  { value: 'esp32', label: 'ESP32' },
  { value: 'esp8266', label: 'ESP8266' },
  { value: 'arduino-avr', label: 'Arduino AVR' },
];

const FORMAT_OPTIONS = [
  { value: 'bin', label: 'bin' },
  { value: 'hex', label: 'hex' },
];

const UPLOAD_PROTOCOL_OPTIONS = [
  { value: 'esptool', label: 'ESP esptool' },
  { value: 'stk500v1', label: 'Arduino STK500v1 (Uno/Nano)' },
  { value: 'stk500v2', label: 'Arduino STK500v2 (Mega)' },
  { value: 'avr109', label: 'Arduino AVR109 (Leonardo/Micro)' },
  { value: 'none', label: '暂不支持在线烧录' },
];

const RESET_METHOD_OPTIONS = [
  { value: 'dtr-rts', label: 'DTR/RTS 自动复位' },
  { value: 'touch-1200bps', label: '1200bps 触发复位' },
  { value: 'none', label: '不自动复位' },
];

const EMPTY_BOARD: Omit<BoardConfigFull, 'builtin' | 'overridden'> = {
  board_id: '', name: '', fqbn: '', description: '',
  platform: 'esp32', flashable: true, bootloader_addr: 0x0,
  output_format: 'bin', chip_family: '',
  upload_protocol: 'esptool', upload_speed: 115200, reset_method: 'dtr-rts',
  created_at: null,
};

// ── 分组工具（模块级，避免闭包 TDZ）──
const FAMILY_TO_LABEL: Record<string, string> = {
  esp32: 'ESP32 系列',
  'esp32-s2': 'ESP32-S 系列', 'esp32-s3': 'ESP32-S 系列',
  'esp32-c3': 'ESP32-C 系列', 'esp32-c6': 'ESP32-C 系列',
  'esp32-h2': 'ESP32-H2 系列',
  esp8266: 'ESP8266 系列',
  avr: 'Arduino 系列',
};
const getGroupLabel = (cf: string) => {
  if (!cf) return '其他';
  return FAMILY_TO_LABEL[cf] || cf;  // 未知系列直接用原名作为分组标签
};

const labelToFamily: Record<string, string> = {
  'ESP32 系列': 'esp32', 'ESP32-S 系列': 'esp32-s3', 'ESP32-C 系列': 'esp32-c3',
  'ESP32-H2 系列': 'esp32-h2', 'ESP8266 系列': 'esp8266', 'Arduino 系列': 'avr',
};

const standardGroups = [
  { label: 'ESP32 系列', familyKey: 'esp32' },
  { label: 'ESP32-S 系列', familyKey: 'esp32-s3' },
  { label: 'ESP32-C 系列', familyKey: 'esp32-c3' },
  { label: 'ESP32-H2 系列', familyKey: 'esp32-h2' },
  { label: 'ESP8266 系列', familyKey: 'esp8266' },
  { label: 'Arduino 系列', familyKey: 'avr' },
  { label: '其他', familyKey: '' },
];

export function AdminBoardManager() {
  const [boards, setBoards] = useState<BoardConfigFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_BOARD);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 搜索
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<BoardSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // 拖拽状态
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<{ label: string; side: 'top' | 'bottom' } | null>(null);
  const dragOverPosRef = useRef<{ label: string; side: 'top' | 'bottom' } | null>(null);

  const loadBoards = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await AdminClient.getBoards();
      setBoards(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载开发板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBoards(); }, []);

  // 是否已修改排序（用于离开提示）
  const [orderDirty, setOrderDirty] = useState(false);

  // 离开页面提示
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (orderDirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [orderDirty]);

  // 保存排序
  const saveOrder = async () => {
    const ids = boards.map(b => b.board_id);
    const boardUpdates = boards.map(b => ({
      board_id: b.board_id,
      chip_family: b.chip_family || '',
    }));
    const result = await AdminClient.reorderBoards(ids, boardUpdates);
    showMsg(result.success ? 'success' : 'error', result.message);
    if (result.success) {
      setOrderDirty(false);
      await loadBoards();
      // 通知用户端下拉框刷新
      window.dispatchEvent(new CustomEvent('boards-updated'));
    }
  };

  // 标记排序已修改
  const markDirty = () => setOrderDirty(true);

  // 整组拖放处理（提取到 JSX 外避免 parser 问题）
  const handleGroupDragOver = (e: React.DragEvent, label: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const side: 'top' | 'bottom' = e.clientY < mid ? 'top' : 'bottom';
    const pos = { label, side };
    dragOverPosRef.current = pos;
    setDragOverPos(pos);
  };

  const handleGroupDrop = (e: React.DragEvent, group: typeof groups[0], _gi: number) => {
    e.preventDefault();
    const pos = dragOverPosRef.current;
    if (!dragId || !pos) { setDragId(null); setDragOverId(null); setDragOverPos(null); dragOverPosRef.current = null; return; }
    if (dragId.startsWith('__grp__')) {
      const srcLabel = dragId.replace('__grp__', '');
      if (srcLabel === group.label) { setDragId(null); setDragOverId(null); setDragOverPos(null); dragOverPosRef.current = null; return; }
      const insertBefore = pos.side === 'top';
      // 移动 boards 数组：将 src 组所有板子移到 tgt 组前/后
      setBoards(prev => {
        const srcBoards = prev.filter(b => getGroupLabel(b.chip_family || '') === srcLabel);
        const others = prev.filter(b => !srcBoards.includes(b));
        const tgtBoards = prev.filter(b => getGroupLabel(b.chip_family || '') === group.label);
        if (tgtBoards.length === 0) {
          // 目标组为空：插到末尾
          return [...others, ...srcBoards];
        }
        const tgtIdx = others.findIndex(b => b.board_id === tgtBoards[0].board_id);
        const insertIdx = insertBefore ? tgtIdx : tgtIdx + tgtBoards.length;
        return [...others.slice(0, insertIdx), ...srcBoards, ...others.slice(insertIdx)];
      });
      markDirty();
    } else {
      const targetFamily = group.label === '其他' ? '' : (group.familyKey || group.label);
      setBoards(prev => prev.map(b => (b.board_id === dragId ? { ...b, chip_family: targetFamily } : b)));
      markDirty();
    }
    setDragId(null);
    setDragOverId(null);
    setDragOverPos(null);
    dragOverPosRef.current = null;
  };

  // 整组上移
  const moveGroupUp = (groupLabel: string) => {
    setBoards(prev => {
      const src = prev.filter(b => getGroupLabel(b.chip_family || '') === groupLabel);
      if (src.length === 0) return prev;
      const others = prev.filter(b => !src.includes(b));
      const firstSrcIdx = prev.findIndex(b => b.board_id === src[0].board_id);
      if (firstSrcIdx <= 0) return prev;
      // 找到上一组
      const prevLabel = getGroupLabel(prev[firstSrcIdx - 1].chip_family || '');
      const prevGroup = others.filter(b => getGroupLabel(b.chip_family || '') === prevLabel);
      const insertIdx = others.findIndex(b => b.board_id === prevGroup[0].board_id);
      return [...others.slice(0, insertIdx), ...src, ...others.slice(insertIdx)];
    });
    markDirty();
  };

  // 整组下移
  const moveGroupDown = (groupLabel: string) => {
    setBoards(prev => {
      const src = prev.filter(b => getGroupLabel(b.chip_family || '') === groupLabel);
      if (src.length === 0) return prev;
      const others = prev.filter(b => !src.includes(b));
      const lastSrcIdx = prev.findIndex(b => b.board_id === src[src.length - 1].board_id);
      if (lastSrcIdx >= prev.length - 1) return prev;
      // 找到下一组
      const nextLabel = getGroupLabel(prev[lastSrcIdx + 1].chip_family || '');
      const nextGroup = others.filter(b => getGroupLabel(b.chip_family || '') === nextLabel);
      const lastNextIdx = others.findIndex(b => b.board_id === nextGroup[nextGroup.length - 1].board_id);
      return [...others.slice(0, lastNextIdx + 1), ...src, ...others.slice(lastNextIdx + 1)];
    });
    markDirty();
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // ── 拖拽处理 ──
  const handleDragStart = (e: React.DragEvent, boardId: string) => {
    setDragId(boardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', boardId);
  };

  const handleDragOver = (e: React.DragEvent, boardId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (boardId !== dragId) setDragOverId(boardId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    // 分组拖拽不处理，交给 group 级 handler
    if (dragId.startsWith('__grp__')) return;
    // 只在同组内排序，跨组交给 group 级 handler
    const srcBoard = boards.find(b => b.board_id === dragId);
    const tgtBoard = boards.find(b => b.board_id === targetId);
    if (srcBoard && tgtBoard && getGroupLabel(srcBoard.chip_family || '') === getGroupLabel(tgtBoard.chip_family || '')) {
      e.stopPropagation();
      setBoards(prev => {
        const next = [...prev];
        const fromIdx = next.findIndex(b => b.board_id === dragId);
        const toIdx = next.findIndex(b => b.board_id === targetId);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
      markDirty();
    }
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
    setDragOverPos(null);
    dragOverPosRef.current = null;
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_BOARD);
    setShowForm(true);
    setSearchKeyword('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const openEdit = (b: BoardConfigFull) => {
    setEditingId(b.board_id);
    setForm({
      board_id: b.board_id, name: b.name, fqbn: b.fqbn,
      description: b.description, platform: b.platform,
      flashable: b.flashable, bootloader_addr: b.bootloader_addr,
      output_format: b.output_format, chip_family: b.chip_family,
      upload_protocol: b.upload_protocol || 'esptool',
      upload_speed: b.upload_speed || 115200,
      reset_method: b.reset_method || 'dtr-rts',
      created_at: b.created_at,
    });
    setShowForm(true);
    setSearchKeyword('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const setField = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm(f => ({ ...f, [key]: val }));
    };

  const doSearch = useCallback(async (kw: string) => {
    setSearchKeyword(kw);
    if (kw.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const results = await AdminClient.searchBoards(kw.trim());
    setSearchResults(results);
    setSearching(false);
  }, []);

  const pickSearchResult = (r: BoardSearchResult) => {
    setForm(f => ({
      ...f,
      board_id: r.board_id,
      name: r.name,
      fqbn: r.fqbn,
      platform: r.platform || f.platform,
      flashable: r.flashable ?? f.flashable,
      bootloader_addr: r.bootloader_addr ?? f.bootloader_addr,
      output_format: r.output_format || f.output_format,
      chip_family: r.chip_family || f.chip_family,
      upload_protocol: r.upload_protocol || f.upload_protocol,
      upload_speed: r.upload_speed || f.upload_speed,
      reset_method: r.reset_method || f.reset_method,
    }));
    setSearchResults([]);
    setSearchKeyword('');
    setShowSearch(false);
  };

  const handleDeploy = async () => {
    if (!form.fqbn) { showMsg('error', '请先填写 FQBN'); return; }
    setDeploying(true);
    setDeployLog([]);
    const logRef: string[] = [];
    const result = await AdminClient.deployBoard(form.fqbn, (line) => {
      logRef.push(line);
      setDeployLog([...logRef]);
    });
    setDeploying(false);
    showMsg(result.success ? 'success' : 'error', result.message);
  };

  const handleSave = async () => {
    const normalizedBoardId = form.board_id.trim().toLowerCase();
    const normalizedForm = {
      ...form,
      board_id: normalizedBoardId,
      name: form.name.trim(),
      fqbn: form.fqbn.trim(),
      description: form.description.trim(),
      chip_family: form.chip_family.trim(),
    };
    if (!normalizedForm.board_id || !normalizedForm.name || !normalizedForm.fqbn) {
      showMsg('error', 'board_id、名称、FQBN 为必填项'); return;
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalizedForm.board_id)) {
      showMsg('error', 'board_id 只能包含小写字母、数字、横线和下划线');
      return;
    }
    setSaving(true);
    const result = await AdminClient.saveBoard(normalizedForm);
    setSaving(false);
    if (result.success) {
      showMsg('success', result.message);
      setShowForm(false);
      loadBoards();
    } else {
      showMsg('error', result.message);
    }
  };

  const handleDelete = async (b: BoardConfigFull) => {
    const label = b.builtin ? `内置开发板「${b.name}」（可恢复）` : `开发板「${b.name}」（不可恢复）`;
    if (!confirm(`确定要删除${label}吗？`)) return;
    const result = await AdminClient.deleteBoard(b.board_id);
    showMsg(result.success ? 'success' : 'error', result.message);
    if (result.success) loadBoards();
  };

  const handleReset = async (b: BoardConfigFull) => {
    if (!confirm(`确定将「${b.name}」恢复为默认配置吗？`)) return;
    const result = await AdminClient.resetBoard(b.board_id);
    showMsg(result.success ? 'success' : 'error', result.message);
    if (result.success) loadBoards();
  };

  // ── 按 chip family 分组 ──
  // board_id → config
  const boardMap = new Map(boards.map(b => [b.board_id, b]));
  // 每个 label 下的 board IDs（按 boards 数组顺序）
  const labelToBoards = new Map<string, string[]>();
  for (const b of boards) {
    const label = getGroupLabel(b.chip_family || '');
    if (!labelToBoards.has(label)) labelToBoards.set(label, []);
    labelToBoards.get(label)!.push(b.board_id);
  }
  // 补上空组
  for (const sg of standardGroups) {
    if (!labelToBoards.has(sg.label)) labelToBoards.set(sg.label, []);
  }

  // 分组显示顺序：从 boards 数组提取首次出现的标签顺序
  const naturalOrder: string[] = [];
  for (const b of boards) {
    const label = getGroupLabel(b.chip_family || '');
    if (!naturalOrder.includes(label)) naturalOrder.push(label);
  }
  // 补上未出现的标准分组
  for (const sg of standardGroups) {
    if (!naturalOrder.includes(sg.label)) naturalOrder.push(sg.label);
  }

  // 构建 groups 数组
  const groups: { label: string; boardIds: string[]; familyKey: string }[] = naturalOrder.map(label => ({
    label,
    boardIds: labelToBoards.get(label) || [],
    familyKey: labelToFamily[label] || (label === '其他' ? '' : label),
  }));

  // 全局序号
  let globalNum = 0;

  return (
    <div className="min-h-screen bg-[#edf6fb]">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">开发板管理</h1>
            <span className="text-sm text-slate-500">({boards.length} 块)</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveOrder} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
              orderDirty
                ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                : 'bg-white border border-slate-200 text-slate-400'
            }`}>
              {orderDirty ? '保存排序' : '保存排序'}
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" />添加开发板
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {msg && (
          <div className={`mb-4 p-4 rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">加载中...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : (
          <div className="space-y-4">
            {groups.map((group, gi) => {
              const topLine = dragOverPos && dragOverPos.label === group.label && dragOverPos.side === 'top';
              const bottomLine = dragOverPos && dragOverPos.label === group.label && dragOverPos.side === 'bottom';
              return (
                <div key={group.label}>
                  {topLine && <div className="h-0.5 bg-blue-500 rounded-full mx-2 mb-2 shadow-[0_0_8px_rgba(59,130,246,.5)]" />}
                  <div
                    className="bg-white rounded-xl shadow-sm border-2 border-slate-200 overflow-hidden"
                    onDragOver={e => handleGroupDragOver(e, group.label)}
                    onDragLeave={() => setDragOverPos(null)}
                    onDrop={e => handleGroupDrop(e, group, gi)}
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <div draggable onDragStart={e => { e.stopPropagation(); setDragId('__grp__' + group.label); e.dataTransfer.effectAllowed = 'move'; }} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <span className={`w-2 h-2 rounded-full ${group.label === '其他' ? 'bg-slate-400' : 'bg-blue-500'}`} />
                      <h2 className="text-sm font-bold text-slate-700">{group.label}</h2>
                      <span className="text-xs text-slate-400">({group.boardIds.length})</span>
                      <div className="flex items-center gap-0.5 ml-auto">
                        <button onClick={() => moveGroupUp(group.label)} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="整组上移">
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveGroupDown(group.label)} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="整组下移">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.boardIds.map(bid => {
                        const b = boardMap.get(bid);
                        if (!b) return null;
                        globalNum++;
                        const num = globalNum;
                        return (
                          <div key={b.board_id} draggable
                            onDragStart={e => handleDragStart(e, b.board_id)}
                            onDragOver={e => handleDragOver(e, b.board_id)}
                            onDrop={e => handleDrop(e, b.board_id)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 px-4 py-2 transition-colors ${dragOverId === b.board_id ? 'shadow-[inset_0_2px_0_0_rgba(59,130,246,0.6)]' : ''} ${dragId === b.board_id ? 'opacity-40' : 'hover:bg-[#edf6fb]'}`}
                          >
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="w-7 text-center shrink-0">
                              <span className="text-xs font-bold text-slate-400">{num}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">{b.name}</div>
                              <div className="text-xs text-slate-400 font-mono truncate">{b.board_id}</div>
                            </div>
                            <div className="hidden lg:block text-xs text-slate-400 font-mono truncate max-w-[240px]" title={b.fqbn}>{b.fqbn}</div>
                            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                              {b.overridden ? <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">已修改</span>
                                : b.builtin ? <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">内置</span>
                                : <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">自定义</span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => openEdit(b)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                                <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(b)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="删除">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {b.overridden && (
                                <button onClick={() => handleReset(b)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="恢复默认">
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {bottomLine && <div className="h-0.5 bg-blue-500 rounded-full mx-2 mt-2 shadow-[0_0_8px_rgba(59,130,246,.5)]" />}
                </div>
              );
            })}

            {boards.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                暂无开发板
              </div>
            )}
          </div>
        )}
      </main>

      {/* 编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? '编辑开发板' : '添加开发板'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">搜索开发板（自动回填）</label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchKeyword}
                          onChange={e => { doSearch(e.target.value); setShowSearch(true); }}
                          onFocus={() => searchResults.length > 0 && setShowSearch(true)}
                          placeholder="输入关键字搜索（如 esp32c3）..."
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                    {searching && <div className="text-xs text-slate-400 mt-1">搜索中...</div>}
                    {showSearch && searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.slice(0, 10).map(r => (
                          <button
                            key={r.fqbn}
                            onClick={() => pickSearchResult(r)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-slate-900">{r.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{r.fqbn}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={deploying || !form.fqbn}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 w-full justify-center font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                {deploying ? '部署中...' : '自动部署：安装平台核心'}
              </button>

              {deployLog.length > 0 && (
                <div className="bg-slate-900 text-emerald-400 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
                  {deployLog.map((l, i) => (
                    <div key={i} className="leading-relaxed">{l}</div>
                  ))}
                  {deploying && <div className="text-slate-500 mt-0.5">⏳ 正在执行...</div>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">board_id *</label>
                <input value={form.board_id} onChange={setField('board_id')} disabled={!!editingId}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 outline-none focus:border-blue-400" placeholder="如 esp32s3-custom" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">名称 *</label>
                <input value={form.name} onChange={setField('name')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">FQBN *</label>
                <input value={form.fqbn} onChange={setField('fqbn')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:border-blue-400" placeholder="如 esp32:esp32:esp32s3:CDCOnBoot=cdc" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                <textarea value={form.description} onChange={setField('description')} rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">平台</label>
                  <select value={form.platform} onChange={setField('platform')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400">
                    {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">输出格式</label>
                  <select value={form.output_format} onChange={setField('output_format')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400">
                    {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">bootloader 地址</label>
                  <input
                    value={form.bootloader_addr != null ? `0x${form.bootloader_addr.toString(16)}` : ''}
                    onChange={e => setForm(f => ({ ...f, bootloader_addr: e.target.value ? parseInt(e.target.value, 16) : null }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:border-blue-400" placeholder="如 0x0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">芯片系列</label>
                  <input value={form.chip_family} onChange={setField('chip_family')} list="chip-families"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400" placeholder="选择或输入系列名称" />
                  <datalist id="chip-families">
                    {[...new Set(boards.map(b => b.chip_family).filter(Boolean)), ...Object.keys(FAMILY_TO_LABEL)].map(cf => (
                      <option key={cf} value={cf} />
                    ))}
                  </datalist>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.flashable} onChange={e => setForm(f => ({ ...f, flashable: e.target.checked }))} className="rounded" />
                支持 Web Serial 烧录
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">烧录协议</label>
                  <select value={form.upload_protocol} onChange={setField('upload_protocol')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400">
                    {UPLOAD_PROTOCOL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">烧录波特率</label>
                  <input
                    type="number"
                    value={form.upload_speed}
                    onChange={e => setForm(f => ({ ...f, upload_speed: Number(e.target.value) || 115200 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">复位方式</label>
                  <select value={form.reset_method} onChange={setField('reset_method')} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400">
                    {RESET_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
