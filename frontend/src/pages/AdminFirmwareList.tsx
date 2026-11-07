/** 管理员固件列表：支持按项目分组或按版本平铺查看。 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Check, ChevronDown, ChevronRight, Edit3, Trash2, Upload, X } from 'lucide-react';
import { AdminClient } from '../api/adminClient';
import type { FirmwareMetadata } from '../api/types';

type ViewMode = 'grouped' | 'flat';
type SortKey = 'created_at' | 'version' | 'download_count' | 'flash_count';

function createdAtValue(item: FirmwareMetadata): number {
  const value = Date.parse(item.created_at || '');
  return Number.isNaN(value) ? 0 : value;
}

function versionParts(version: string): number[] {
  return version.split('.').map(part => Number.parseInt(part, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function AdminFirmwareList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FirmwareMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDescending, setSortDescending] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<FirmwareMetadata | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await AdminClient.getAllFirmware({ page: 1, page_size: 100 });
      setItems(response.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载固件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const sortedItems = useMemo(() => {
    const result = [...items];
    result.sort((a, b) => {
      let difference: number;
      if (sortKey === 'version') difference = compareVersions(a.version, b.version);
      else if (sortKey === 'download_count' || sortKey === 'flash_count') difference = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
      else difference = createdAtValue(a) - createdAtValue(b);
      return sortDescending ? -difference : difference;
    });
    return result;
  }, [items, sortDescending, sortKey]);

  const groups = useMemo(() => {
    const grouped = new Map<string, FirmwareMetadata[]>();
    for (const item of sortedItems) {
      const existing = grouped.get(item.project_name) ?? [];
      existing.push(item);
      grouped.set(item.project_name, existing);
    }
    return [...grouped.entries()];
  }, [sortedItems]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDescending(value => !value);
    else { setSortKey(key); setSortDescending(true); }
  };

  const togglePublish = async (firmware: FirmwareMetadata) => {
    try {
      setBusyId(firmware.firmware_id);
      await AdminClient.togglePublish(firmware.firmware_id, !firmware.published);
      setItems(current => current.map(item => item.firmware_id === firmware.firmware_id ? { ...item, published: !item.published } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新发布状态失败');
    } finally { setBusyId(null); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setBusyId(deleting.firmware_id);
      await AdminClient.deleteFirmware(deleting.firmware_id);
      setItems(current => current.filter(item => item.firmware_id !== deleting.firmware_id));
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除固件失败');
    } finally { setBusyId(null); }
  };

  const actions = (firmware: FirmwareMetadata) => (
    <div className="flex items-center justify-end gap-2">
      <button type="button" title="编辑" onClick={() => navigate(`/admin/firmware/${firmware.firmware_id}/edit`)} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600">
        <Edit3 className="w-4 h-4" />
      </button>
      <button type="button" title={firmware.published ? '取消发布' : '发布'} disabled={busyId === firmware.firmware_id} onClick={() => void togglePublish(firmware)} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-emerald-600">
        {firmware.published ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      </button>
      <button type="button" title="删除" disabled={busyId === firmware.firmware_id} onClick={() => setDeleting(firmware)} className="p-2 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  if (loading) return <div className="min-h-screen bg-[#edf6fb] p-8"><p className="text-slate-600">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-[#edf6fb] p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <button type="button" onClick={() => navigate('/admin')} className="text-sm text-blue-600 hover:underline mb-2">返回仪表板</button>
            <h1 className="text-2xl font-bold text-slate-900">固件管理</h1>
            <p className="text-sm text-slate-500 mt-1">管理已上传的固件包和版本发布状态</p>
          </div>
          <button type="button" onClick={() => navigate('/admin/firmware/upload')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Upload className="w-4 h-4" /> 上传新固件
          </button>
        </header>

        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="关闭错误"><X className="w-4 h-4" /></button></div>}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button type="button" onClick={() => setViewMode('grouped')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'grouped' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>分组视图</button>
            <button type="button" onClick={() => setViewMode('flat')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'flat' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>平铺视图</button>
          </div>
          <span className="text-sm text-slate-500">共 {items.length} 个固件包</span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Archive className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-600">暂无固件包</p>
          </div>
        ) : viewMode === 'grouped' ? (
          <div className="space-y-3">
            {groups.map(([projectName, versions]) => {
              const isExpanded = expanded.has(projectName);
              const latest = [...versions].sort((a, b) => compareVersions(b.version, a.version))[0];
              const toggleGroup = () => setExpanded(current => { const next = new Set(current); if (next.has(projectName)) next.delete(projectName); else next.add(projectName); return next; });
              return <section key={projectName} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="cursor-pointer" onClick={toggleGroup}>
                <button type="button" className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50">
                  <span className="flex items-center gap-3">{isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}<span className="font-semibold text-slate-900">{projectName}</span></span>
                  <span className="text-sm text-slate-500">v{latest.version} · {versions.length} 个版本</span>
                </button>
                </div>
                {isExpanded && <div className="border-t border-slate-100 divide-y divide-slate-100">{versions.map(version => <div key={version.firmware_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><span className="font-medium text-slate-800">v{version.version}</span><span className={`ml-3 text-xs ${version.published ? 'text-emerald-600' : 'text-slate-500'}`}>{version.published ? '已发布' : '草稿'}</span></div>{actions(version)}</div>)}</div>}
              </section>;
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">项目</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"><button type="button" onClick={() => toggleSort('version')}>版本</button></th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">状态</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500"><div onClick={() => toggleSort('download_count')}><button type="button">下载</button></div></th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500"><div onClick={() => toggleSort('flash_count')}><button type="button">烧录</button></div></th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">操作</th>
            </tr></thead><tbody className="divide-y divide-slate-100">{sortedItems.map(firmware => <tr key={firmware.firmware_id} className="hover:bg-slate-50"><td className="px-4 py-4"><div className="font-medium text-slate-900" title={firmware.firmware_id}>{firmware.project_name}</div></td><td className="px-4 py-4 text-sm text-slate-700">v{firmware.version}</td><td className="px-4 py-4"><span className={`text-sm ${firmware.published ? 'text-emerald-600' : 'text-slate-500'}`}>{firmware.published ? '已发布' : '草稿'}</span></td><td className="px-4 py-4 text-right text-sm text-slate-700">{firmware.download_count}</td><td className="px-4 py-4 text-right text-sm text-slate-700">{firmware.flash_count}</td><td className="px-4 py-4">{actions(firmware)}</td></tr>)}</tbody></table>
          </div>
        )}
      </div>

      {deleting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 id="delete-title" className="text-lg font-semibold text-slate-900">确认删除</h2><p className="mt-3 text-sm text-slate-600">确定要删除「{deleting.project_name}」吗？</p><p className="mt-1 text-xs text-slate-500">固件 ID：{deleting.firmware_id}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleting(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">取消</button><button type="button" onClick={() => void confirmDelete()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">确认删除</button></div></div></div>}
    </div>
  );
}

export default AdminFirmwareList;
