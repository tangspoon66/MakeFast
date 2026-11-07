/**
 * 管理员课程信息编辑页面
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { ArrowLeft, FileText, Folder, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { TemplateForm } from '../components/TemplateForm';
import type { TemplateFormData } from '../components/TemplateForm';
import { templateApi } from '../api/templateApi';
import type { PackageInfo } from '../api/templateApi';
import { AdminClient } from '../api/adminClient';

const SAVED_CATEGORIES_KEY = 'makefast-course-categories';
const SAVED_COURSE_TAGS_KEY = 'makefast-course-tags';
const SAVED_PACKAGE_TYPES_KEY = 'makefast-package-types';
const CATEGORY_OPTION_PAGE_SIZE = 50;
const CATEGORY_OPTION_MAX_PAGES = 4;
const PACKAGE_TYPE_OPTIONS = [
  { value: 'source_package', label: '源代码' },
  { value: '3d_model', label: '3D打印模型' },
  { value: 'document', label: '文档资料' },
  { value: 'wiring_diagram', label: '接线图' },
  { value: 'bom', label: '材料清单' },
  { value: 'slide', label: '课件' },
  { value: 'case', label: '外壳/结构件' },
  { value: 'dataset', label: '数据文件' },
];

const normalizePackageType = (value: string) => {
  return value.trim().replace(/\s+/g, '_');
};

const readSavedPackageTypes = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_PACKAGE_TYPES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const builtInValues = new Set(PACKAGE_TYPE_OPTIONS.map(option => option.value));
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(item => normalizePackageType(item))
      .filter(item => item && item !== 'custom' && !builtInValues.has(item));
  } catch {
    return [];
  }
};

const savePackageTypeOption = (type: string, existing: string[]): string[] => {
  const value = normalizePackageType(type);
  if (!value || value === 'custom') return existing;
  const builtInValues = new Set(PACKAGE_TYPE_OPTIONS.map(option => option.value));
  if (builtInValues.has(value)) return existing;
  const next = Array.from(new Set([value, ...existing])).slice(0, 40);
  try {
    localStorage.setItem(SAVED_PACKAGE_TYPES_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage failures.
  }
  return next;
};

const getPackageTypeLabel = (value: string, customTypes: string[] = []) => {
  return PACKAGE_TYPE_OPTIONS.find(option => option.value === value)?.label
    || customTypes.find(option => option === value)
    || value;
};

const detectPackageType = (file: File) => {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';

  if (['.ino', '.cpp', '.h', '.hpp', '.c', '.cc', '.py', '.js', '.ts', '.json', '.yaml', '.yml'].includes(ext)) {
    return 'source_package';
  }
  if (['.stl', '.obj', '.3mf', '.step', '.stp', '.fbx', '.glb', '.gltf', '.scad'].includes(ext)) {
    return '3d_model';
  }
  if (['.pdf', '.doc', '.docx', '.md', '.txt', '.rtf'].includes(ext)) {
    return 'document';
  }
  if (['.ppt', '.pptx', '.key'].includes(ext)) {
    return 'slide';
  }
  if (['.xls', '.xlsx', '.csv', '.tsv', '.jsonl'].includes(ext)) {
    return 'dataset';
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext) || name.includes('wiring') || name.includes('接线')) {
    return 'wiring_diagram';
  }
  if (name.includes('bom') || name.includes('材料') || name.includes('清单')) {
    return 'bom';
  }
  if (name.includes('case') || name.includes('shell') || name.includes('外壳') || name.includes('结构')) {
    return 'case';
  }

  return 'document';
};

const getFilePath = (file: File) => {
  return ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/^\/+/, '');
};

const buildPackageZip = async (tag: string, files: Array<{ file: File; path: string }>) => {
  const zip = new JSZip();
  for (const item of files) {
    zip.file(item.path || item.file.name, item.file);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], `${tag}.zip`, { type: 'application/zip' });
};

const readSavedList = (key: string): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const saveList = (key: string, values: string[], limit: number) => {
  const next = Array.from(new Set(values.map(item => item.trim()).filter(Boolean))).slice(0, limit);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore localStorage failures.
  }
  return next;
};

export function AdminTemplateEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<TemplateFormData> | null>(null);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(() => readSavedList(SAVED_CATEGORIES_KEY));
  const [tagOptions, setTagOptions] = useState<string[]>(() => readSavedList(SAVED_COURSE_TAGS_KEY));
  const [customPackageTypes, setCustomPackageTypes] = useState<string[]>(() => readSavedPackageTypes());
  const [lockedResources, setLockedResources] = useState<string[]>([]);
  const [unlockCode, setUnlockCode] = useState('');

  const loadPackageList = async (templateId: string) => {
    setResourceLoading(true);
    try {
      setPackages(await templateApi.listPackages(templateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载课程配套资源失败');
    } finally {
      setResourceLoading(false);
    }
  };

  useEffect(() => {
    const loadTemplate = async () => {
      if (!id) return;
      try {
        setPageLoading(true);
        setError(null);
        const detail = await templateApi.adminGetDetail(id);
        setInitialData({
          name: detail.name,
          description: detail.description,
          category: detail.category,
          tags: detail.tags,
          supported_board_ids: detail.supported_board_ids,
          published: detail.published,
          files: detail.files,
          level: detail.level || 1,
          video_url: detail.video_url || '',
        });
        setLockedResources(detail.locked_resources || []);
        setUnlockCode(detail.unlock_code || '');

        if (detail.has_thumbnail) {
          setCurrentThumbnail(`/api/templates/${id}/thumbnail?t=${Date.now()}`);
        }
        await loadPackageList(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载课程数据失败');
      } finally {
        setPageLoading(false);
      }
    };

    loadTemplate();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      try {
        const [firmwares, firstTemplatePage] = await Promise.all([
          AdminClient.getAllFirmware(),
          templateApi.adminList({ page_size: CATEGORY_OPTION_PAGE_SIZE }),
        ]);
        if (cancelled) return;

        const pages = [firstTemplatePage];
        const totalPages = Math.min(firstTemplatePage.total_pages || 1, CATEGORY_OPTION_MAX_PAGES);
        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await templateApi.adminList({ page, page_size: CATEGORY_OPTION_PAGE_SIZE });
          if (cancelled) return;
          pages.push(nextPage);
        }
        const templates = pages.flatMap(page => page.templates || []);
        const categories = [
          ...readSavedList(SAVED_CATEGORIES_KEY),
          ...(firmwares.items || []).map(item => item.tags?.[0]).filter(Boolean),
          ...templates.map(item => item.category).filter(Boolean),
        ] as string[];
        const tags = [
          ...readSavedList(SAVED_COURSE_TAGS_KEY),
          ...(firmwares.items || []).flatMap(item => item.tags || []),
          ...templates.flatMap(item => item.tags || []),
        ] as string[];
        setCategoryOptions(saveList(SAVED_CATEGORIES_KEY, categories, 30));
        setTagOptions(saveList(SAVED_COURSE_TAGS_KEY, tags, 50));
      } catch {
        // 选项复用失败不阻塞编辑。
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const createCategory = () => {
    const value = (window.prompt('请输入新的资源分类名称') || '').trim();
    if (!value) return null;
    setCategoryOptions(prev => saveList(SAVED_CATEGORIES_KEY, [value, ...prev], 30));
    return value;
  };

  const deleteCategory = (category: string) => {
    if (!window.confirm(`确定删除资源分类“${category}”吗？`)) return;
    setCategoryOptions(prev => saveList(SAVED_CATEGORIES_KEY, prev.filter(item => item !== category), 30));
  };

  const saveTagOption = (tag: string) => {
    setTagOptions(prev => saveList(SAVED_COURSE_TAGS_KEY, [tag, ...prev], 50));
  };

  const deleteTagOption = (tag: string) => {
    if (!window.confirm(`确定删除标签“${tag}”吗？`)) return;
    setTagOptions(prev => saveList(SAVED_COURSE_TAGS_KEY, prev.filter(item => item !== tag), 50));
  };

  const handleSubmit = async (data: TemplateFormData) => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const tags = Array.from(new Set(data.tags.map(t => t.trim()).filter(Boolean))).slice(0, 10);

      await templateApi.update(id, {
        name: data.name,
        description: data.description,
        category: data.category,
        tags,
        supported_board_ids: data.supported_board_ids,
        published: data.published,
        files: data.files,
        level: data.level,
        video_url: data.video_url,
        locked_resources: lockedResources.filter(tag => packages.some(pkg => pkg.tag === tag)),
        unlock_code: lockedResources.length > 0 ? unlockCode.trim() : '',
      });

      if (data.thumbnailFile) {
        await templateApi.uploadThumbnail(id, data.thumbnailFile);
      }

      navigate('/admin/resources');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新课程失败');
    } finally {
      setLoading(false);
    }
  };

  const createCustomPackageType = () => {
    const label = window.prompt('请输入新的资源类型名称');
    const normalized = normalizePackageType(label || '');
    if (!normalized) return null;

    setCustomPackageTypes(prev => savePackageTypeOption(normalized, prev));
    return normalized;
  };

  const deleteCustomPackageType = (type: string) => {
    const target = normalizePackageType(type);
    if (!target) return;
    if (!window.confirm(`确定删除资源类型“${target}”吗？已使用这个类型的资源会保留原类型。`)) return;

    const nextTypes = customPackageTypes.filter(item => item !== target);
    setCustomPackageTypes(nextTypes);
    try {
      localStorage.setItem(SAVED_PACKAGE_TYPES_KEY, JSON.stringify(nextTypes));
    } catch {
      // Ignore localStorage failures.
    }
  };

  const uploadNewPackages = async (fileList: FileList | null) => {
    if (!id || !fileList || fileList.length === 0) return;
    try {
      setResourceLoading(true);
      const files = Array.from(fileList);
      const groups = files.reduce<Record<string, Array<{ file: File; path: string }>>>((nextGroups, file) => {
        const tag = detectPackageType(file);
        nextGroups[tag] = [...(nextGroups[tag] || []), { file, path: getFilePath(file) }];
        return nextGroups;
      }, {});
      for (const [tag, items] of Object.entries(groups)) {
        const displayName = items.length === 1
          ? items[0].file.name
          : (items[0].path.split('/')[0] || getPackageTypeLabel(tag, customPackageTypes));
        await templateApi.uploadPackage(id, await buildPackageZip(tag, items), tag, displayName);
      }
      await loadPackageList(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传资源失败');
    } finally {
      setResourceLoading(false);
    }
  };

  const deletePackage = async (tag: string) => {
    if (!id || !window.confirm(`确定删除资源“${tag}”吗？`)) return;
    try {
      setResourceLoading(true);
      await templateApi.deletePackage(id, tag);
      setLockedResources(prev => prev.filter(item => item !== tag));
      await loadPackageList(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除资源失败');
    } finally {
      setResourceLoading(false);
    }
  };

  const updatePackageTag = async (oldTag: string, value: string) => {
    if (!id) return;
    let nextTag = value;
    if (value === '__custom__') {
      nextTag = createCustomPackageType() || oldTag;
    }
    nextTag = normalizePackageType(nextTag);
    if (!nextTag || nextTag === oldTag) return;
    try {
      setResourceLoading(true);
      await templateApi.renamePackage(id, oldTag, nextTag);
      setLockedResources(prev => prev.map(tag => tag === oldTag ? nextTag : tag));
      await loadPackageList(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名资源失败');
    } finally {
      setResourceLoading(false);
    }
  };

  const togglePackageLocked = (tag: string) => {
    setLockedResources(prev => (
      prev.includes(tag)
        ? prev.filter(item => item !== tag)
        : [...prev, tag]
    ));
  };

  const renamePackageFile = async (pkg: PackageInfo) => {
    if (!id) return;
    const filename = (window.prompt('请输入新的文件名或文件夹名', pkg.filename) || '').trim();
    if (!filename || filename === pkg.filename) return;
    try {
      setResourceLoading(true);
      await templateApi.renamePackageFile(id, pkg.tag, filename);
      await loadPackageList(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名文件失败');
    } finally {
      setResourceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/admin/resources')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回课程列表</span>
        </button>

        <h1 className="text-3xl font-bold text-slate-900 mb-6">课程信息编辑</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {pageLoading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">加载课程数据...</p>
          </div>
        )}

        {!pageLoading && initialData && (
          <>
            <TemplateForm
              initialData={initialData}
              onSubmit={handleSubmit}
              submitLabel="保存修改"
              loading={loading}
              currentThumbnail={currentThumbnail}
              categoryOptions={categoryOptions}
              tagOptions={tagOptions}
              onCreateCategory={createCategory}
              onDeleteCategory={deleteCategory}
              onSaveTagOption={saveTagOption}
              onDeleteTagOption={deleteTagOption}
              showSourceEditor={false}
            >

            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">课程配套资源管理</h2>
                  <p className="mt-1 text-sm text-slate-500">已上传的资源会优先显示；需要修改时，删除旧资源后重新上传即可。</p>
                </div>
                {resourceLoading && <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />}
              </div>

              {packages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  暂无额外配套资源
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[150px_minmax(0,1fr)_90px_82px_150px_86px] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                    <div>资源类型</div>
                    <div>文件名</div>
                    <div>大小</div>
                    <div>是否上锁</div>
                    <div>口令</div>
                    <div className="text-right">操作</div>
                  </div>
                  {packages.map(pkg => (
                    <div key={pkg.tag} className="grid grid-cols-[150px_minmax(0,1fr)_90px_82px_150px_86px] items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm">
                      <select
                        value={pkg.tag}
                        onChange={(e) => updatePackageTag(pkg.tag, e.target.value)}
                        className="min-w-0 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                        title={getPackageTypeLabel(pkg.tag, customPackageTypes)}
                      >
                        {PACKAGE_TYPE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                        {customPackageTypes.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                        {!PACKAGE_TYPE_OPTIONS.some(option => option.value === pkg.tag) && !customPackageTypes.includes(pkg.tag) && (
                          <option value={pkg.tag}>{pkg.tag}</option>
                        )}
                        <option value="__custom__">新增自定义类型...</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => renamePackageFile(pkg)}
                        className="min-w-0 truncate text-left text-slate-700 hover:text-blue-700"
                        title="点击重命名文件"
                      >
                        <FileText className="mr-1 inline h-4 w-4 text-slate-400" />
                        {pkg.filename}
                      </button>
                      <div className="text-xs text-slate-500">{(pkg.size / 1024).toFixed(1)} KB</div>
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={lockedResources.includes(pkg.tag)}
                          onChange={() => togglePackageLocked(pkg.tag)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        上锁
                      </label>
                      <input
                        type="text"
                        value={lockedResources.includes(pkg.tag) ? unlockCode : ''}
                        onChange={(e) => setUnlockCode(e.target.value)}
                        disabled={!lockedResources.includes(pkg.tag)}
                        placeholder="口令"
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => deletePackage(pkg.tag)}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-end gap-2">
                <label className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <Plus className="mr-1 inline h-3.5 w-3.5" />
                  上传文件
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      uploadNewPackages(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700">
                  <Folder className="mr-1 inline h-3.5 w-3.5" />
                  上传文件夹
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    {...({ webkitdirectory: '', directory: '' } as any)}
                    onChange={(e) => {
                      uploadNewPackages(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {customPackageTypes.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs text-slate-500">自定义资源类型</div>
                  <div className="max-h-20 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {customPackageTypes.map(type => (
                        <span key={type} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                          {type}
                          <button
                            type="button"
                            onClick={() => deleteCustomPackageType(type)}
                            className="text-slate-400 hover:text-red-500"
                            aria-label={`删除自定义类型 ${type}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            </TemplateForm>
          </>
        )}
      </div>
    </div>
  );
}
