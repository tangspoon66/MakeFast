/**
 * 课程资源库管理 - 管理员统一资源列表
 *
 * 功能：
 * - 合并固件管理和模板管理为统一视图
 * - 显示所有资源（源代码 / 固件）在一个表格中
 * - 每行显示：名称、类型徽章、分类、发布状态、创建时间、操作
 * - 操作：编辑、删除（移至回收站）、发布切换
 * - 回收站：查看已删除资源、恢复、永久删除、清空
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PencilIcon,
  Trash2,
  Plus,
  Copy,
  Undo2,
  AlertTriangle,
  Folder,
  Pin,
  ArrowUp,
  ArrowDown,
  Image,
  Search,
} from 'lucide-react';
import { templateApi } from '../api/templateApi';
import { AdminClient } from '../api/adminClient';
import type { TemplateListItem } from '../api/templateApi';
import type { CourseFolder, FirmwareMetadata } from '../api/types';
import { ImageCropper } from '../components/ImageCropper';

type ResourceType = 'firmware' | 'source_code';

interface UnifiedResource {
  id: string;
  name: string;
  description: string;
  type: ResourceType;
  category: string;
  published: boolean;
  created_at: string;
  tags: string[];
  supported_board_ids: string[];
  pinned?: boolean;
}

interface TrashItem {
  id: string;
  name: string;
  type: ResourceType;
  deleted_at: string;
}

export function AdminResourceList() {
  const navigate = useNavigate();

  // 视图切换：'resources' | 'folders' | 'trash'
  const [view, setView] = useState<'resources' | 'folders' | 'trash'>('resources');

  // 资源列表状态
  const [resources, setResources] = useState<UnifiedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    resource: UnifiedResource | null;
  }>({ show: false, resource: null });

  // 回收站状态
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CourseFolder | null>(null);
  const [folderCourseSearch, setFolderCourseSearch] = useState('');
  const [folderCoverFile, setFolderCoverFile] = useState<File | null>(null);
  const [folderCoverPreview, setFolderCoverPreview] = useState('');
  const [folderCoverToCrop, setFolderCoverToCrop] = useState<File | null>(null);
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    cover_url: '',
    pinned: false,
    published: false,
    template_ids: [] as string[],
  });

  // 加载所有资源
  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);

      const [firmwares, templateResponse] = await Promise.all([
        AdminClient.getAllFirmware(),
        templateApi.adminList({ page_size: 50 }),
      ]);

      const firmwareResources: UnifiedResource[] = (firmwares.items || [])
        .filter((fw: FirmwareMetadata) => !fw.project_name.startsWith('firmware_'))
        .map((fw: FirmwareMetadata) => ({
          id: fw.firmware_id,
          name: fw.project_name,
          description: fw.description,
          type: 'firmware' as ResourceType,
          category: fw.tags.length > 0 ? fw.tags[0] : '未分类',
          published: fw.published,
          created_at: fw.created_at,
        tags: fw.tags,
        supported_board_ids: fw.supported_board_ids,
        pinned: false,
      }));

      const templateResources: UnifiedResource[] = templateResponse.templates.map((tpl: TemplateListItem) => ({
        id: tpl.template_id,
        name: tpl.name,
        description: tpl.description,
        type: 'source_code' as ResourceType,
        category: tpl.category,
        published: tpl.published,
        created_at: tpl.created_at,
        tags: tpl.tags,
        supported_board_ids: tpl.supported_board_ids,
        pinned: tpl.pinned,
      }));

      const allResources = [...firmwareResources, ...templateResources].sort(
        (a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      );

      setResources(allResources);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载回收站数据
  const loadTrash = async () => {
    try {
      setTrashLoading(true);
      setTrashError(null);

      const [templateRes, firmwareRes] = await Promise.all([
        templateApi.getTrashed(),
        AdminClient.getTrashedFirmware(),
      ]);

      const templateItems: TrashItem[] = (templateRes.trashed || []).map(
        (tpl: TemplateListItem) => ({
          id: tpl.template_id,
          name: tpl.name,
          type: 'source_code' as ResourceType,
          deleted_at: tpl.deleted_at || '',
        })
      );

      const firmwareItems: TrashItem[] = (firmwareRes.items || [])
        .filter((fw: FirmwareMetadata) => !fw.project_name.startsWith('firmware_'))
        .map(
          (fw: FirmwareMetadata) => ({
            id: fw.firmware_id,
            name: fw.project_name,
            type: 'firmware' as ResourceType,
            deleted_at: fw.deleted_at || '',
          })
        );

      const allItems = [...templateItems, ...firmwareItems].sort(
        (a, b) =>
          new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
      );

      setTrashItems(allItems);
    } catch (err) {
      setTrashError(err instanceof Error ? err.message : '加载回收站失败');
    } finally {
      setTrashLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const loadFolders = async () => {
    setFolderLoading(true);
    try {
      const items = await AdminClient.listCourseFolders();
      setFolders(items || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : '加载课程文件夹失败');
    } finally {
      setFolderLoading(false);
    }
  };

  // 切换到回收站时加载数据
  useEffect(() => {
    if (view === 'trash') {
      loadTrash();
    }
    if (view === 'folders') {
      loadFolders();
    }
  }, [view]);

  const templateResources = resources.filter(resource => resource.type === 'source_code');
  const folderCategories = Array.from(new Set(templateResources.map(resource => resource.category).filter(Boolean)));
  const folderTags = Array.from(new Set(templateResources.flatMap(resource => resource.tags || []).filter(Boolean)));
  const folderSearchResults = templateResources
    .filter(resource => {
      const query = folderCourseSearch.trim().toLowerCase();
      if (!query) return false;
      return (
        resource.name.toLowerCase().includes(query)
        || resource.description.toLowerCase().includes(query)
        || resource.category.toLowerCase().includes(query)
        || resource.tags.some(tag => tag.toLowerCase().includes(query))
      );
    })
    .slice(0, 20);

  const resetFolderForm = () => {
    setEditingFolder(null);
    setFolderForm({
      name: '',
      description: '',
      category: '',
      tags: '',
      cover_url: '',
      pinned: false,
      published: false,
      template_ids: [],
    });
    setFolderCourseSearch('');
    setFolderCoverFile(null);
    setFolderCoverPreview('');
    setFolderCoverToCrop(null);
  };

  const openFolderEditor = (folder?: CourseFolder) => {
    if (!folder) {
      resetFolderForm();
      return;
    }
    setEditingFolder(folder);
    setFolderForm({
      name: folder.name,
      description: folder.description,
      category: folder.category,
      tags: folder.tags.join(', '),
      cover_url: folder.cover_url,
      pinned: folder.pinned,
      published: folder.published,
      template_ids: folder.items.map(item => item.template_id),
    });
    setFolderCourseSearch('');
    setFolderCoverFile(null);
    setFolderCoverPreview(folder.cover_url || '');
    setFolderCoverToCrop(null);
  };

  const saveFolder = async () => {
    if (!folderForm.name.trim()) {
      alert('请输入文件夹名称');
      return;
    }
    const payload = {
      name: folderForm.name.trim(),
      description: folderForm.description.trim(),
      category: folderForm.category.trim(),
      tags: folderForm.tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 10),
      cover_url: folderForm.cover_url.trim(),
      pinned: folderForm.pinned,
      published: folderForm.published,
      template_ids: folderForm.template_ids,
    };
    try {
      let savedFolder: CourseFolder;
      if (editingFolder) {
        savedFolder = await AdminClient.updateCourseFolder(editingFolder.folder_id, payload);
      } else {
        savedFolder = await AdminClient.createCourseFolder(payload);
      }
      if (folderCoverFile) {
        await AdminClient.uploadCourseFolderCover(savedFolder.folder_id, folderCoverFile);
      }
      resetFolderForm();
      await loadFolders();
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存课程文件夹失败');
    }
  };

  const handleFolderCoverSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    setFolderCoverToCrop(file);
  };

  const handleFolderCoverCrop = (file: File) => {
    setFolderCoverToCrop(null);
    setFolderCoverFile(file);
    setFolderCoverPreview(URL.createObjectURL(file));
  };

  const addFolderCoursesBy = (predicate: (resource: UnifiedResource) => boolean) => {
    const matchedIds = templateResources.filter(predicate).map(resource => resource.id);
    if (matchedIds.length === 0) return;
    setFolderForm(prev => ({
      ...prev,
      template_ids: Array.from(new Set([...prev.template_ids, ...matchedIds])),
    }));
  };

  const removeFolderCourse = (templateId: string) => {
    setFolderForm(prev => ({
      ...prev,
      template_ids: prev.template_ids.filter(id => id !== templateId),
    }));
  };

  const toggleTemplatePinned = async (resource: UnifiedResource) => {
    if (resource.type !== 'source_code') return;
    try {
      await templateApi.update(resource.id, { pinned: !resource.pinned });
      await loadResources();
    } catch (err) {
      alert(err instanceof Error ? err.message : '置顶失败');
    }
  };

  const deleteFolder = async (folder: CourseFolder) => {
    if (!confirm(`确定删除课程文件夹“${folder.name}”吗？课程本身不会被删除。`)) return;
    try {
      await AdminClient.deleteCourseFolder(folder.folder_id);
      await loadFolders();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除课程文件夹失败');
    }
  };

  const moveFolder = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= folders.length) return;
    const next = [...folders];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setFolders(next);
    try {
      const updated = await AdminClient.reorderCourseFolders(next.map(folder => folder.folder_id));
      setFolders(updated || next);
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存排序失败');
      await loadFolders();
    }
  };

  // 切换发布状态
  const handleTogglePublish = async (resource: UnifiedResource) => {
    try {
      if (resource.type === 'firmware') {
        await AdminClient.togglePublish(resource.id, !resource.published);
      } else {
        await templateApi.togglePublish(resource.id, !resource.published);
      }
      await loadResources();
    } catch (err) {
      alert(err instanceof Error ? err.message : '切换发布状态失败');
    }
  };

  // 删除资源（软删除）
  const handleDelete = async () => {
    if (!deleteConfirm.resource) return;
    try {
      if (deleteConfirm.resource.type === 'firmware') {
        await AdminClient.deleteFirmware(deleteConfirm.resource.id);
      } else {
        await templateApi.delete(deleteConfirm.resource.id);
      }
      setDeleteConfirm({ show: false, resource: null });
      await loadResources();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除资源失败');
    }
  };

  // 编辑资源
  const handleEdit = (resource: UnifiedResource) => {
    if (resource.type === 'firmware') {
      navigate(`/admin/firmware/${resource.id}/edit`);
    } else {
      navigate(`/admin/templates/${resource.id}/edit`);
    }
  };

  // 复制资源
  const handleCopy = async (resource: UnifiedResource) => {
    if (resource.type === 'firmware') {
      alert('固件暂不支持复制');
      return;
    }
    try {
      await templateApi.copy(resource.id);
      await loadResources();
    } catch (err) {
      alert(err instanceof Error ? err.message : '复制失败');
    }
  };

  // 恢复资源
  const handleRestore = async (item: TrashItem) => {
    setActionLoading(item.id);
    try {
      if (item.type === 'source_code') {
        await templateApi.restoreTrash(item.id);
      } else {
        await AdminClient.restoreFirmware(item.id);
      }
      await loadTrash();
      await loadResources();
    } catch (err) {
      alert(err instanceof Error ? err.message : '恢复失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 永久删除
  const handlePermanentDelete = async (item: TrashItem) => {
    if (!confirm(`确定要永久删除「${item.name}」吗？此操作不可逆。`)) return;
    setActionLoading(item.id);
    try {
      if (item.type === 'source_code') {
        await templateApi.permanentDelete(item.id);
      } else {
        await AdminClient.permanentDeleteFirmware(item.id);
      }
      await loadTrash();
    } catch (err) {
      alert(err instanceof Error ? err.message : '永久删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 清空回收站
  const handleEmptyTrash = async () => {
    setEmptyConfirm(false);
    setActionLoading('__empty__');
    try {
      const [templateRes, firmwareRes] = await Promise.all([
        templateApi.emptyTrash(),
        AdminClient.emptyFirmwareTrash(),
      ]);
      const total = (templateRes.deleted_count || 0) + (firmwareRes.deleted_count || 0);
      alert(`已永久删除 ${total} 个项目`);
      await loadTrash();
    } catch (err) {
      alert(err instanceof Error ? err.message : '清空回收站失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (dateString: string): number => {
    const deletedDate = new Date(dateString);
    const expireDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return Math.max(0, Math.ceil((expireDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="max-w-7xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回仪表板</span>
        </button>

        {/* 标题和操作 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">课程资源库管理</h1>
            {/* 视图切换标签 */}
            <div className="flex bg-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setView('resources')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'resources'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                资源列表
              </button>
              <button
                onClick={() => setView('folders')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  view === 'folders'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Folder className="w-4 h-4" />
                课程文件夹
              </button>
              <button
                onClick={() => setView('trash')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  view === 'trash'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                回收站
              </button>
            </div>
          </div>
          {view === 'resources' && (
            <button
              onClick={() => navigate('/admin/resources/upload')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              上传课程
            </button>
          )}
        </div>

        {/* ================================================================ */}
        {/* 资源列表视图 */}
        {/* ================================================================ */}
        {view === 'resources' && (
          <>
            {loading && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-slate-600">加载中...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800">{error}</p>
                <button
                  onClick={loadResources}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  重试
                </button>
              </div>
            )}

            {!loading && !error && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-[#edf6fb] px-6 py-3 border-b border-slate-200">
                  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-700 text-center">
                    <div className="col-span-3 text-left">名称</div>
                    <div className="col-span-1">类型</div>
                    <div className="col-span-2">分类</div>
                    <div className="col-span-2">状态</div>
                    <div className="col-span-2">创建时间</div>
                    <div className="col-span-2">操作</div>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {resources.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-500">
                      暂无资源，点击"上传课程"添加第一个课程
                    </div>
                  ) : (
                    resources.map(resource => (
                      <div
                        key={`${resource.type}-${resource.id}`}
                        className="px-6 py-4 hover:bg-[#edf6fb] transition-colors"
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-3">
                            <h3 className="font-medium text-slate-900 truncate">{resource.name}</h3>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{resource.description}</p>
                          </div>
                          <div className="col-span-1 text-center">
                            {resource.type === 'source_code' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                源代码
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                固件
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {resource.category}
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <button
                              onClick={() => handleTogglePublish(resource)}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                resource.published
                                  ? 'bg-green-500 text-white shadow-sm hover:bg-green-600'
                                  : 'bg-blue-600 text-white shadow-md hover:bg-blue-700 animate-pulse'
                              }`}
                            >
                              {resource.published ? '✓ 已发布' : '▶ 发布'}
                            </button>
                          </div>
                          <div className="col-span-2 text-center text-sm text-slate-600">
                            {formatDate(resource.created_at)}
                          </div>
                          <div className="col-span-2 flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleTemplatePinned(resource)}
                              disabled={resource.type !== 'source_code'}
                              className={`p-2 rounded-lg transition-colors ${
                                resource.pinned
                                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                  : resource.type === 'source_code'
                                    ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                    : 'text-slate-300 cursor-not-allowed'
                              }`}
                              title={resource.type === 'source_code' ? (resource.pinned ? '取消置顶' : '置顶') : '固件暂不支持置顶'}
                            >
                              <Pin className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEdit(resource)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="编辑"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleCopy(resource)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="复制"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ show: true, resource })}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'folders' && (
          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
            <div className="bg-white rounded-lg shadow p-5 h-fit">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                {editingFolder ? '编辑课程文件夹' : '新建课程文件夹'}
              </h2>
              <div className="space-y-3">
                <input
                  value={folderForm.name}
                  onChange={(e) => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="文件夹名称"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <textarea
                  value={folderForm.description}
                  onChange={(e) => setFolderForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简介"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={folderForm.category}
                    onChange={(e) => setFolderForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="分类"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    value={folderForm.tags}
                    onChange={(e) => setFolderForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="标签，逗号分隔"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">文件夹封面</div>
                  <div className="flex items-center gap-3">
                    <div className="aspect-[4/3] w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {folderCoverPreview ? (
                        <img src={folderCoverPreview} alt="文件夹封面预览" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Image className="h-7 w-7 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                      <Image className="h-4 w-4" />
                      上传并裁切
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          handleFolderCoverSelect(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-700">选择课程</div>

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 text-xs text-slate-500">按分类添加</div>
                      <div className="max-h-20 overflow-y-auto rounded-md bg-white p-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {folderCategories.length === 0 ? (
                            <span className="text-xs text-slate-400">暂无分类</span>
                          ) : folderCategories.map(category => (
                            <button
                              key={category}
                              type="button"
                              onClick={() => addFolderCoursesBy(resource => resource.category === category)}
                              className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs text-slate-500">按标签添加</div>
                      <div className="max-h-20 overflow-y-auto rounded-md bg-white p-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {folderTags.length === 0 ? (
                            <span className="text-xs text-slate-400">暂无标签</span>
                          ) : folderTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => addFolderCoursesBy(resource => resource.tags.includes(tag))}
                              className="rounded border border-teal-100 bg-teal-50 px-2 py-1 text-xs text-teal-700 hover:bg-teal-100"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          value={folderCourseSearch}
                          onChange={(e) => setFolderCourseSearch(e.target.value)}
                          placeholder="按名称搜索后添加课程"
                          className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm"
                        />
                      </div>
                      {folderCourseSearch.trim() && (
                        <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-100 bg-white p-1.5">
                          {folderSearchResults.length === 0 ? (
                            <div className="px-2 py-1 text-xs text-slate-400">没有匹配课程</div>
                          ) : folderSearchResults.map(resource => (
                            <button
                              key={resource.id}
                              type="button"
                              onClick={() => addFolderCoursesBy(item => item.id === resource.id)}
                              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <span className="min-w-0 truncate">{resource.name}</span>
                              <span className="text-xs text-blue-600">
                                {folderForm.template_ids.includes(resource.id) ? '已添加' : '添加'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={folderForm.pinned}
                      onChange={(e) => setFolderForm(prev => ({ ...prev, pinned: e.target.checked }))}
                    />
                    置顶
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={folderForm.published}
                      onChange={(e) => setFolderForm(prev => ({ ...prev, published: e.target.checked }))}
                    />
                    发布
                  </label>
                </div>
                {folderForm.template_ids.length > 1 && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <div className="mb-2 text-xs font-medium text-slate-500">文件夹内课程排序</div>
                    <div className="space-y-1">
                      {folderForm.template_ids.map((templateId, index) => {
                        const course = templateResources.find(item => item.id === templateId);
                        return (
                          <div key={templateId} className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs">
                            <span className="min-w-0 flex-1 truncate">{course?.name || templateId}</span>
                            <button
                              type="button"
                              onClick={() => removeFolderCourse(templateId)}
                              className="p-1 text-slate-400 hover:text-red-600"
                              title="移出文件夹"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFolderForm(prev => {
                                const ids = [...prev.template_ids];
                                if (index > 0) [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                                return { ...prev, template_ids: ids };
                              })}
                              className="p-1 text-slate-500 hover:text-blue-600"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFolderForm(prev => {
                                const ids = [...prev.template_ids];
                                if (index < ids.length - 1) [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                                return { ...prev, template_ids: ids };
                              })}
                              className="p-1 text-slate-500 hover:text-blue-600"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  {editingFolder && (
                    <button onClick={resetFolderForm} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">
                      取消
                    </button>
                  )}
                  <button onClick={saveFolder} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                    {editingFolder ? '保存文件夹' : '新建文件夹'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-[#edf6fb] px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold text-slate-800">文件夹列表</div>
                {folderLoading && <span className="text-sm text-slate-500">加载中...</span>}
              </div>
              <div className="divide-y divide-slate-100">
                {folders.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-500">暂无课程文件夹</div>
                ) : folders.map((folder, index) => (
                  <div key={folder.folder_id} className="px-5 py-4 hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-20 shrink-0">
                        <div className="absolute left-2 top-1 h-14 w-16 rounded-md bg-slate-200" />
                        <div className="absolute left-1 top-2 h-14 w-16 rounded-md bg-slate-300" />
                        <div className="absolute inset-y-3 left-0 h-14 w-16 overflow-hidden rounded-md bg-slate-100 shadow">
                          {folder.cover_url ? (
                            <img src={folder.cover_url} alt={folder.name} className="h-full w-full object-cover" />
                          ) : (
                            <Folder className="m-4 h-8 w-8 text-slate-400" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-900">{folder.name}</h3>
                          {folder.pinned && <Pin className="h-4 w-4 text-amber-500" />}
                          <span className={`rounded-full px-2 py-0.5 text-xs ${folder.published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                            {folder.published ? '已发布' : '草稿'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{folder.description || '暂无简介'}</p>
                        <p className="mt-1 text-xs text-slate-400">{folder.items.length} 个课程 · {folder.category || '未分类'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveFolder(index, -1)} className="p-2 text-slate-500 hover:text-blue-600" title="上移">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => moveFolder(index, 1)} className="p-2 text-slate-500 hover:text-blue-600" title="下移">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => openFolderEditor(folder)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="编辑">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteFolder(folder)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="删除">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* 回收站视图 */}
        {/* ================================================================ */}
        {view === 'trash' && (
          <>
            {trashItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                回收站中的项目将在 30 天后自动清除。
              </div>
            )}

            {trashLoading && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-slate-600">加载中...</p>
              </div>
            )}

            {trashError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800">{trashError}</p>
                <button
                  onClick={loadTrash}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  重试
                </button>
              </div>
            )}

            {!trashLoading && !trashError && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {trashItems.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">回收站为空</p>
                    <p className="text-gray-400 text-sm mt-1">
                      删除的资源将会出现在这里，30 天内可恢复
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 清空回收站按钮 */}
                    <div className="bg-[#edf6fb] px-6 py-3 border-b border-slate-200 flex justify-end">
                      <button
                        onClick={() => setEmptyConfirm(true)}
                        disabled={actionLoading === '__empty__'}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {actionLoading === '__empty__' ? '清空中...' : '清空回收站'}
                      </button>
                    </div>

                    <div className="divide-y divide-gray-200">
                      {trashItems.map((item) => {
                        const daysRemaining = getDaysRemaining(item.deleted_at);
                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            className="px-6 py-4 hover:bg-[#edf6fb] transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-medium text-slate-900 truncate">{item.name}</h3>
                                  {item.type === 'source_code' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 flex-shrink-0">
                                      源代码
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 flex-shrink-0">
                                      固件
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-4 text-sm text-slate-500">
                                  <span>删除时间: {formatDate(item.deleted_at)}</span>
                                  {daysRemaining <= 0 ? (
                                    <span className="text-red-500 flex items-center gap-1">
                                      <AlertTriangle className="w-4 h-4" />
                                      已过期，即将自动清除
                                    </span>
                                  ) : (
                                    <span>{daysRemaining} 天后自动清除</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                <button
                                  onClick={() => handleRestore(item)}
                                  disabled={actionLoading === item.id}
                                  className="flex items-center gap-1.5 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                                >
                                  <Undo2 className="w-4 h-4" />
                                  {actionLoading === item.id ? '...' : '恢复'}
                                </button>
                                <button
                                  onClick={() => handlePermanentDelete(item)}
                                  disabled={actionLoading === item.id}
                                  className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {actionLoading === item.id ? '...' : '永久删除'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 删除确认对话框 */}
      {deleteConfirm.show && deleteConfirm.resource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">移至回收站</h3>
              <p className="text-slate-600 mb-2">
                确定要删除以下资源吗？资源将移至回收站，30 天内可恢复。
              </p>
              <div className="bg-[#edf6fb] rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">资源名称：</span>
                  {deleteConfirm.resource.name}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-medium">类型：</span>
                  {deleteConfirm.resource.type === 'source_code' ? '源代码' : '固件'}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-medium">分类：</span>
                  {deleteConfirm.resource.category}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm({ show: false, resource: null })}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  移至回收站
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 清空回收站确认对话框 */}
      {emptyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">清空回收站</h3>
              <p className="text-slate-600 mb-2">
                确定要永久删除回收站中的所有项目吗？
              </p>
              <p className="text-sm text-red-600 mb-6">
                此操作不可逆，共 {trashItems.length} 个项目将被永久删除。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setEmptyConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleEmptyTrash}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  确认清空
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {folderCoverToCrop && (
        <ImageCropper
          imageFile={folderCoverToCrop}
          aspectRatio={4 / 3}
          onCrop={handleFolderCoverCrop}
          onCancel={() => setFolderCoverToCrop(null)}
        />
      )}
    </div>
  );
}
