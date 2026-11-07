/**
 * 模板表单组件
 *
 * 可复用的模板创建/编辑表单，包含：
 * - 元数据表单（名称、描述、分类、标签、支持的开发板、发布状态）
 * - 多文件代码编辑器（添加/删除/重命名文件）
 * - 文件扩展名验证（仅 .ino, .cpp, .h, .c, .hpp, .cc）
 * - 表单验证（字段长度、必填项）
 */

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  Image,
  X,
} from 'lucide-react';
import type { TemplateSourceFile } from '../api/templateApi';
import { ImageCropper } from './ImageCropper';
import { compressImage, validateImageFile } from '../utils/imageUtils';

// ============================================================================
// 类型定义
// ============================================================================

export interface TemplateFormData {
  name: string;
  description: string;
  category: string;
  tags: string[];
  supported_board_ids: string[];
  published: boolean;
  files: TemplateSourceFile[];
  thumbnailFile?: File | null;
  level: number;
  video_url?: string;
}

interface TemplateFormProps {
  initialData?: Partial<TemplateFormData>;
  onSubmit: (data: TemplateFormData) => Promise<void>;
  submitLabel: string;
  loading?: boolean;
  currentThumbnail?: string | null;
  categoryOptions?: string[];
  tagOptions?: string[];
  onCreateCategory?: () => string | null;
  onDeleteCategory?: (category: string) => void;
  onSaveTagOption?: (tag: string) => void;
  onDeleteTagOption?: (tag: string) => void;
  showSourceEditor?: boolean;
  children?: ReactNode;
}

// ============================================================================
// 常量
// ============================================================================

const ALLOWED_EXTENSIONS = ['.ino', '.cpp', '.h', '.c', '.hpp', '.cc'];

// ============================================================================
// 组件
// ============================================================================

export function TemplateForm({
  initialData,
  onSubmit,
  submitLabel,
  loading = false,
  currentThumbnail = null,
  categoryOptions = [],
  tagOptions = [],
  onCreateCategory,
  onDeleteCategory,
  onSaveTagOption,
  onDeleteTagOption,
  showSourceEditor = true,
  children,
}: TemplateFormProps) {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || '',
    tags: initialData?.tags || [],
    supported_board_ids: initialData?.supported_board_ids || [],
    published: initialData?.published || false,
    files: initialData?.files || [{ name: 'sketch.ino', content: '' }],
    thumbnailFile: null,
    level: initialData?.level || 1,
    video_url: initialData?.video_url || '',
  });

  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');

  // 验证文件扩展名
  const isValidExtension = (filename: string): boolean => {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name.length < 3 || formData.name.length > 100) {
      newErrors.name = '名称长度需在 3-100 字符之间';
    }
    if (formData.description.length < 10 || formData.description.length > 2000) {
      newErrors.description = '描述长度需在 10-2000 字符之间';
    }
    if (formData.category.length < 2 || formData.category.length > 50) {
      newErrors.category = '请选择或输入分类（2-50 字符）';
    }
    if (formData.supported_board_ids.length === 0) {
      newErrors.supported_board_ids = '请输入至少一个开发板 ID';
    }
    if (showSourceEditor && formData.files.length === 0) {
      newErrors.files = '至少需要一个源文件';
    }
    if (showSourceEditor) {
      for (const file of formData.files) {
        if (!file.name.trim()) {
          newErrors.files = '文件名不能为空';
          break;
        }
        if (!isValidExtension(file.name)) {
          newErrors.files = `不支持的文件扩展名: ${file.name}。允许: ${ALLOWED_EXTENSIONS.join(', ')}`;
          break;
        }
        if (!file.content.trim()) {
          newErrors.files = `文件 ${file.name} 内容不能为空`;
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  // 更新字段
  const updateField = useCallback((field: keyof TemplateFormData, value: string | boolean | number | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const commitTag = (value: string) => {
    const nextTag = value.trim();
    if (!nextTag || formData.tags.includes(nextTag) || formData.tags.length >= 10) {
      setTagInput('');
      return;
    }
    setFormData(prev => ({ ...prev, tags: [...prev.tags, nextTag] }));
    onSaveTagOption?.(nextTag);
    setTagInput('');
  };

  const updateCategory = (value: string) => {
    if (value === '__custom__') {
      const next = onCreateCategory?.();
      if (next) {
        updateField('category', next);
      }
      return;
    }
    updateField('category', value);
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(item => item !== tag) }));
  };

  // 添加空文件（手动编辑用）
  const addFile = () => {
    const newFiles = [...formData.files, { name: 'new_file.cpp', content: '' }];
    setFormData(prev => ({ ...prev, files: newFiles }));
    setActiveFileIndex(newFiles.length - 1);
  };

  // 上传本地文件或文件夹（读取文件内容）
  const handleUploadFiles = async (fileList: FileList) => {
    const newFiles = [...formData.files];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      // 只接受允许的扩展名
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        continue;
      }
      
      // 读取文件内容
      try {
        const content = await file.text();
        // 如果已有同名文件，替换内容
        const existingIndex = newFiles.findIndex(f => f.name === file.name);
        if (existingIndex >= 0) {
          newFiles[existingIndex] = { name: file.name, content };
        } else {
          newFiles.push({ name: file.name, content });
        }
      } catch (err) {
        console.error(`Failed to read file ${file.name}:`, err);
      }
    }
    
    // 如果初始只有一个空的 sketch.ino，移除它
    if (formData.files.length === 1 && !formData.files[0].content.trim() && newFiles.length > 1) {
      const emptyIndex = newFiles.findIndex(f => f.name === 'sketch.ino' && !f.content.trim());
      if (emptyIndex >= 0) {
        newFiles.splice(emptyIndex, 1);
      }
    }
    
    setFormData(prev => ({ ...prev, files: newFiles }));
    setActiveFileIndex(0);
  };

  // 删除文件
  const removeFile = (index: number) => {
    if (formData.files.length <= 1) return;
    const newFiles = formData.files.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, files: newFiles }));
    if (activeFileIndex >= newFiles.length) {
      setActiveFileIndex(newFiles.length - 1);
    }
  };

  // 更新文件名
  const updateFileName = (index: number, name: string) => {
    const newFiles = [...formData.files];
    newFiles[index] = { ...newFiles[index], name };
    setFormData(prev => ({ ...prev, files: newFiles }));
  };

  // 更新文件内容
  const updateFileContent = (index: number, content: string) => {
    const newFiles = [...formData.files];
    newFiles[index] = { ...newFiles[index], content };
    setFormData(prev => ({ ...prev, files: newFiles }));
  };

  // 处理缩略图选择
  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, thumbnail: validation.error! }));
      return;
    }

    // 打开裁切组件
    setImageToCrop(file);
    setShowCropper(true);

    // 清空 input
    e.target.value = '';
  };

  // 裁切完成
  const handleCropComplete = async (croppedFile: File) => {
    setShowCropper(false);
    setImageToCrop(null);

    // 自动压缩（如果还需要的话）
    let finalFile = croppedFile;
    if (finalFile.size > 500 * 1024) {
      finalFile = await compressImage(finalFile, 500 * 1024);
    }

    setFormData(prev => ({ ...prev, thumbnailFile: finalFile }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.thumbnail;
      return newErrors;
    });

    // 生成预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setThumbnailPreview(e.target?.result as string);
    };
    reader.readAsDataURL(finalFile);
  };

  // 取消裁切
  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
  };

  // 移除缩略图
  const handleRemoveThumbnail = () => {
    setFormData(prev => ({ ...prev, thumbnailFile: null }));
    setThumbnailPreview(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 元数据区域 */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">课程信息</h2>

        {/* 名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="例如: WiFi 温度监控课程"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            描述 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="详细描述课程的功能和用途（至少 10 个字符）"
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.description ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
        </div>

        {/* 分类 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            资源分类 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category}
            onChange={e => updateCategory(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.category ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            <option value="">请选择分类</option>
            {categoryOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value="__custom__">新增自定义分类...</option>
          </select>
          {categoryOptions.length > 0 && (
            <div className="mt-2 max-h-20 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-1.5">
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map(option => (
                  <span key={option} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                    {option}
                    {onDeleteCategory && (
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(option)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`删除资源分类 ${option}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
        </div>

        {/* 难度星级 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开发板 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.supported_board_ids.join(', ')}
              onChange={e => updateField(
                'supported_board_ids',
                e.target.value.split(',').map(item => item.trim()).filter(Boolean)
              )}
              placeholder="如: esp32, esp32s3"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.supported_board_ids ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.supported_board_ids && <p className="mt-1 text-sm text-red-600">{errors.supported_board_ids}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              难度星级 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.level}
              onChange={e => updateField('level', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1">★☆☆☆☆ 入门</option>
              <option value="2">★★☆☆☆ 初级</option>
              <option value="3">★★★☆☆ 中级</option>
              <option value="4">★★★★☆ 进阶</option>
              <option value="5">★★★★★ 高级</option>
            </select>
          </div>
        </div>

        {/* 标签 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            补充标签
          </label>
          <div className="rounded-lg border border-gray-300 bg-white px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <div className="flex flex-wrap gap-1.5">
              {formData.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-400 hover:text-red-500"
                    aria-label={`移除标签 ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitTag(tagInput);
                  }
                  if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
                    removeTag(formData.tags[formData.tags.length - 1]);
                  }
                }}
                onBlur={() => commitTag(tagInput)}
                placeholder={formData.tags.length === 0 ? '输入后按回车确认，例如: 传感器' : '继续添加'}
                className="min-w-[180px] flex-1 border-0 px-1 py-0.5 text-sm outline-none"
                disabled={formData.tags.length >= 10}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">最多 10 个。分类不再自动计入标签。</p>
          {tagOptions.length > 0 && (
            <div className="mt-2 max-h-20 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-1.5">
              <div className="flex flex-wrap gap-1.5">
                {tagOptions.map(option => (
                  <span key={option} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={() => commitTag(option)}
                      className="hover:text-blue-600"
                    >
                      {option}
                    </button>
                    {onDeleteTagOption && (
                      <button
                        type="button"
                        onClick={() => onDeleteTagOption(option)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`删除标签 ${option}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* B 站视频链接 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            B 站视频链接
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.video_url}
              onChange={e => updateField('video_url', e.target.value)}
              placeholder="输入 B 站视频链接，例如: https://www.bilibili.com/video/BV..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={async () => {
                if (!formData.video_url) return;
                const bvMatch = formData.video_url.match(/BV[a-zA-Z0-9]{8,15}/);
                if (!bvMatch) return;
                try {
                  // 调用后端公开 API 获取封面
                  const response = await fetch(`/api/templates/bilibili-cover?bvid=${bvMatch[0]}`);
                  const data = await response.json();
                  if (data.cover_url) {
                    // 使用后端代理获取图片（解决防盗链问题）
                    const proxyUrl = `/api/templates/bilibili-cover-image?url=${encodeURIComponent(data.cover_url)}`;
                    // 下载图片并打开裁切对话框
                    const coverResponse = await fetch(proxyUrl);
                    const coverBlob = await coverResponse.blob();
                    const coverFile = new File([coverBlob], 'cover.jpg', { type: 'image/jpeg' });
                    setImageToCrop(coverFile);
                    setShowCropper(true);
                  }
                } catch (e) {
                  console.warn('获取 B 站封面失败:', e);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              自动解析
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">可选，用于显示视频封面和播放器</p>
        </div>

        {/* 发布状态 */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.published}
              onChange={e => updateField('published', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-sm text-gray-700">
            {formData.published ? '已发布（用户可见）' : '草稿（仅管理员可见）'}
          </span>
        </div>

        {/* 缩略图 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            缩略图（可选）
          </label>
          
          {/* 当前缩略图 */}
          {currentThumbnail && !thumbnailPreview && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">当前缩略图：</p>
              <img
                src={currentThumbnail}
                alt="Current thumbnail"
                className="w-32 h-32 object-cover rounded-lg border border-gray-300"
              />
            </div>
          )}

          {/* 新缩略图预览 */}
          {thumbnailPreview && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">新缩略图预览：</p>
              <div className="relative inline-block">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleRemoveThumbnail}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 上传按钮 */}
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
            <Image className="w-5 h-5" />
            <span>{thumbnailPreview ? '更换缩略图' : currentThumbnail ? '更换缩略图' : '上传缩略图'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleThumbnailChange}
              className="hidden"
            />
          </label>
          <p className="mt-2 text-sm text-gray-500">
            支持 PNG、JPEG、WebP 格式，选择后可裁切，自动压缩至 500KB 以内
          </p>
          {errors.thumbnail && <p className="mt-1 text-sm text-red-600">{errors.thumbnail}</p>}
        </div>
      </div>

      {/* 文件编辑器区域 */}
      {showSourceEditor && (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">课程配套资源管理</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              上传文件夹
              <input
                type="file"
                multiple
                accept=".ino,.cpp,.h,.c,.hpp,.cc"
                className="hidden"
                {...({ webkitdirectory: '', directory: '' } as any)}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <label className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              上传文件
              <input
                type="file"
                multiple
                accept=".ino,.cpp,.h,.c,.hpp,.cc"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={addFile}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              新建空文件
            </button>
          </div>
        </div>

        {errors.files && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors.files}</p>
          </div>
        )}

        {/* 文件标签栏 */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-4 overflow-x-auto pb-px">
          {formData.files.map((file, index) => (
            <div
              key={index}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-t-lg cursor-pointer whitespace-nowrap ${
                activeFileIndex === index
                  ? 'bg-gray-100 text-gray-900 border border-b-0 border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setActiveFileIndex(index)}
            >
              <FileText className="w-4 h-4" />
              <span>{file.name}</span>
              {formData.files.length > 1 && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 当前文件编辑 */}
        {formData.files[activeFileIndex] && (
          <div className="space-y-3">
            {/* 文件名输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">文件名</label>
              <input
                type="text"
                value={formData.files[activeFileIndex].name}
                onChange={e => updateFileName(activeFileIndex, e.target.value)}
                placeholder="例如: sketch.ino"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                支持的扩展名: {ALLOWED_EXTENSIONS.join(', ')}
              </p>
            </div>

            {/* 代码编辑器 (textarea with monospace font) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">文件内容</label>
              <textarea
                value={formData.files[activeFileIndex].content}
                onChange={e => updateFileContent(activeFileIndex, e.target.value)}
                placeholder="在此输入代码..."
                rows={20}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed resize-y bg-gray-50"
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {children}

      {/* 提交按钮 */}
      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '保存中...' : submitLabel}
        </button>
      </div>

      {/* 图片裁切弹窗 */}
      {showCropper && imageToCrop && (
        <ImageCropper
          imageFile={imageToCrop}
          aspectRatio={4 / 3}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </form>
  );
}
