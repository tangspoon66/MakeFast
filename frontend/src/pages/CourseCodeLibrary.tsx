/**
 * 课程库 - 用户端统一资源浏览页面
 *
 * 功能：
 * - 合并固件库和模板库为统一视图
 * - 显示所有已发布资源（源代码 + 固件）
 * - 每个卡片显示类型徽章（源代码 / 固件）
 * - 源代码类型："打开项目"按钮 → 加载到编辑器
 * - 固件类型："一键烧录"按钮 → 导航到固件详情页
 * - 筛选：按类型、分类、开发板、搜索
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateApi } from '../api/templateApi';
import { FirmwareClient } from '../api/firmwareClient';
import type { TemplateListItem } from '../api/templateApi';
import type { FirmwareMetadata } from '../api/types';
import {
  Search,
  FunnelIcon,
  RefreshCw,
  FileText,
  Cpu,
  Code2,
  X,
  Star,
  Folder,
  ArrowLeft,
  Pin,
} from 'lucide-react';
import type { CourseFolder } from '../api/types';

type ResourceType = 'all' | 'firmware' | 'source_code';

/** 渲染星级 */
function StarRating({ level, size = 14 }: { level?: number; size?: number }) {
  if (!level) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(n =>
        n <= level ? (
          <Star key={n} size={size} fill="#f59e0b" color="#f59e0b" />
        ) : (
          <Star key={n} size={size} color="#d1d5db" />
        )
      )}
    </span>
  );
}

interface UnifiedResource {
  id: string;
  name: string;
  description: string;
  type: 'firmware' | 'source_code';
  category: string;
  tags: string[];
  supported_board_ids: string[];
  created_at: string;
  // 固件特有
  firmware_id?: string;
  // 模板特有
  level?: number;
  has_thumbnail?: boolean;
  cover_url?: string;
  pinned?: boolean;
}

export function CourseCodeLibrary() {
  const navigate = useNavigate();

  // 数据
  const [resources, setResources] = useState<UnifiedResource[]>([]);
  const [filteredResources, setFilteredResources] = useState<UnifiedResource[]>([]);
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CourseFolder | null>(null);

  // UI 状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选
  const [typeFilter, setTypeFilter] = useState<ResourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [boardFilter, setBoardFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 可用的分类和开发板（从数据中提取）
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableBoards, setAvailableBoards] = useState<string[]>([]);

  // 加载所有已发布资源
  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 并行请求固件和模板
      const [firmwares, templateResponse, folderResponse] = await Promise.all([
        FirmwareClient.getFirmwareList(),
        templateApi.list({ page_size: 50 }),
        templateApi.listCourseFolders(),
      ]);

      // 转换固件
      const firmwareResources: UnifiedResource[] = (firmwares.items || []).map((fw: FirmwareMetadata) => ({
        id: fw.firmware_id,
        name: fw.project_name,
        description: fw.description,
        type: 'firmware' as const,
        category: fw.tags.length > 0 ? fw.tags[0] : '未分类',
        tags: fw.tags,
        supported_board_ids: fw.supported_board_ids,
        created_at: fw.created_at,
        firmware_id: fw.firmware_id,
        has_thumbnail: fw.has_thumbnail,
        pinned: false,
      }));

      // 转换模板
      const templateResources: UnifiedResource[] = templateResponse.templates.map((tpl: TemplateListItem) => ({
        id: tpl.template_id,
        name: tpl.name,
        description: tpl.description,
        type: 'source_code' as const,
        category: tpl.category,
        tags: tpl.tags,
        supported_board_ids: tpl.supported_board_ids,
        created_at: tpl.created_at,
        level: tpl.level,
        has_thumbnail: tpl.has_thumbnail,
        cover_url: tpl.cover_url,
        pinned: tpl.pinned,
      }));

      const allResources = [...firmwareResources, ...templateResources].sort(
        (a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      );

      setResources(allResources);
      setFolders(folderResponse || []);

      // 提取可用分类和开发板
      const categories = [...new Set(allResources.map(r => r.category).filter(Boolean))];
      const boards = [...new Set(allResources.flatMap(r => r.supported_board_ids))];
      setAvailableCategories(categories);
      setAvailableBoards(boards);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // 应用筛选
  useEffect(() => {
    let filtered = [...resources];

    if (selectedFolder) {
      const order = new Map(selectedFolder.items.map((item, index) => [item.template_id, index]));
      filtered = filtered
        .filter(resource => order.has(resource.id))
        .sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
    }

    // 类型筛选
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter);
    }

    // 搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.name.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    // 分类筛选
    if (categoryFilter) {
      filtered = filtered.filter(r => r.category === categoryFilter);
    }

    // 开发板筛选
    if (boardFilter) {
      filtered = filtered.filter(r => r.supported_board_ids.includes(boardFilter));
    }

    setFilteredResources(filtered);
  }, [resources, selectedFolder, typeFilter, searchQuery, categoryFilter, boardFilter]);

  // 打开项目（源代码）
  const handleOpenProject = async (resource: UnifiedResource) => {
    const confirmed = window.confirm(
      '加载项目将覆盖编辑器中的现有代码。是否继续？'
    );
    if (!confirmed) return;

    try {
      const detail = await templateApi.getDetail(resource.id);
      // 记录打开项目统计（fire-and-forget）
      templateApi.logOpen(resource.id).catch(() => {});
      navigate('/', {
        state: {
          templateFiles: detail.files,
          boardId: detail.supported_board_ids.length > 0
            ? detail.supported_board_ids[0]
            : undefined,
        },
      });
    } catch (err) {
      alert(`加载项目失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 一键烧录（固件）
  const handleFlash = (resource: UnifiedResource) => {
    navigate(`/firmware/${resource.firmware_id}`);
  };

  // 清除所有筛选
  const clearFilters = () => {
    setTypeFilter('all');
    setSearchQuery('');
    setCategoryFilter('');
    setBoardFilter('');
  };

  const hasActiveFilters = typeFilter !== 'all' || searchQuery || categoryFilter || boardFilter;
  const visibleFolders = selectedFolder ? [] : folders;

  return (
    <div className="min-h-screen bg-[#edf6fb] p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          {selectedFolder ? (
            <button
              onClick={() => setSelectedFolder(null)}
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              返回课程库
            </button>
          ) : null}
          <h1 className="text-3xl font-bold text-slate-900">{selectedFolder?.name || '课程库'}</h1>
          <p className="mt-1 text-slate-600">{selectedFolder?.description || '浏览课程资源，快速开始你的 ESP 开发'}</p>
        </div>

        {/* 搜索和筛选栏 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索资源名称、描述或标签..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 类型筛选 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setTypeFilter('source_code')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  typeFilter === 'source_code'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                源代码
              </button>
              <button
                onClick={() => setTypeFilter('firmware')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  typeFilter === 'firmware'
                    ? 'bg-orange-100 text-orange-700 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                固件
              </button>
            </div>

            {/* 更多筛选按钮 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              筛选
            </button>
          </div>

          {/* 展开的筛选面板 */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-4">
              {/* 分类筛选 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">分类</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部分类</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 开发板筛选 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">开发板</label>
                <select
                  value={boardFilter}
                  onChange={(e) => setBoardFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部开发板</option>
                  {availableBoards.map(board => (
                    <option key={board} value={board}>{board}</option>
                  ))}
                </select>
              </div>

              {/* 清除筛选 */}
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    清除筛选
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 结果统计 */}
        <div className="mb-4 text-sm text-slate-600">
          共 {filteredResources.length} 个资源
          {hasActiveFilters && ` (已筛选，共 ${resources.length} 个)`}
        </div>

        {/* 内容区域 */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">加载资源列表中...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">加载失败</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadResources}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              <span>重试</span>
            </button>
          </div>
        )}

        {!loading && !error && filteredResources.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">暂无资源</h3>
            <p className="text-slate-600">
              {hasActiveFilters
                ? '没有找到符合筛选条件的资源，请尝试调整筛选条件'
                : '资源库中暂无可用的课程资源'}
            </p>
          </div>
        )}

        {/* 资源卡片网格 */}
        {!loading && !error && visibleFolders.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 text-sm font-semibold text-slate-700">课程文件夹</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {visibleFolders.map(folder => (
                <button
                  key={folder.folder_id}
                  type="button"
                  onClick={() => setSelectedFolder(folder)}
                  className="group relative aspect-[4/3] overflow-visible rounded-lg text-left"
                >
                  <div className="absolute left-3 top-2 h-full w-full rounded-lg bg-slate-200 shadow-sm transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  <div className="absolute left-1.5 top-4 h-full w-full rounded-lg bg-slate-300 shadow-sm transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  <div className="absolute inset-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow hover:shadow-md">
                    {folder.cover_url ? (
                      <img src={folder.cover_url} alt={folder.name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <Folder className="h-12 w-12 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-3 pt-10">
                      <div className="flex items-center gap-2">
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-white drop-shadow">{folder.name}</h3>
                        {folder.pinned && <Pin className="h-4 w-4 text-amber-300" />}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-white/80">{folder.items.length} 个课程</span>
                        {folder.category && (
                          <span className="rounded bg-black/40 px-1.5 py-0.5 text-xs font-medium text-amber-200">{folder.category}</span>
                        )}
                      </div>
                      {folder.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {folder.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] leading-none text-white/90">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && filteredResources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredResources.map((resource) => {
              const thumbnailUrl = resource.has_thumbnail
                ? (resource.type === 'firmware'
                  ? `/api/firmware/${resource.id}/thumbnail`
                  : `/api/templates/${resource.id}/thumbnail`)
                : resource.cover_url || null;

              return (
                <div
                  key={`${resource.type}-${resource.id}`}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-slate-200 overflow-hidden flex flex-col cursor-pointer"
                  onClick={() => resource.type === 'source_code' ? handleOpenProject(resource) : handleFlash(resource)}
                >
                  {/* 图片区域 - 4:3 比例 */}
                  <div className="relative" style={{ paddingBottom: '75%' }}>
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={resource.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        {resource.type === 'source_code' ? (
                          <Code2 className="w-12 h-12 text-gray-400" />
                        ) : (
                          <Cpu className="w-12 h-12 text-gray-400" />
                        )}
                      </div>
                    )}

                    {/* 渐变遮罩层 + 标题 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
                      <h3 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-md">
                        {resource.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <StarRating level={resource.level} size={12} />
                        <span className="text-xs text-amber-200 bg-black/40 px-1.5 py-0.5 rounded font-medium">{resource.category}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {resource.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-white/15 text-white/90 rounded text-[10px] leading-none">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
