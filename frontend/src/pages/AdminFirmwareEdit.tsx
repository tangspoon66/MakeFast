/**
 * 固件编辑页面 - 管理员
 * 
 * 功能：
 * - 编辑固件元数据
 * - 更新缩略图
 * - 保存更改
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Image, X } from 'lucide-react';
import { AdminClient } from '../api/adminClient';
import { CompilationClient } from '../api/compilationClient';
import type { FirmwareMetadata, BoardInfo } from '../api/types';

export function AdminFirmwareEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<FirmwareMetadata | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);

  // 表单状态
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [published, setPublished] = useState(false);

  // 缩略图状态
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null);

  // 验证错误
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 加载固件数据和开发板列表
  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError('固件 ID 无效');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 并行加载固件数据和开发板列表
        const [firmwareList, boardsResponse] = await Promise.all([
          AdminClient.getAllFirmware(),
          CompilationClient.getBoards()
        ]);

        // 查找当前固件
        const currentFirmware = firmwareList.items.find(f => f.firmware_id === id);
        if (!currentFirmware) {
          setError('固件不存在');
          setLoading(false);
          return;
        }

        setFirmware(currentFirmware);
        setBoards(boardsResponse.boards);

        // 预填充表单
        setProjectName(currentFirmware.project_name);
        setDescription(currentFirmware.description);
        setVersion(currentFirmware.version);
        setSelectedBoards(currentFirmware.supported_board_ids);
        setTags(currentFirmware.tags);
        setPublished(currentFirmware.published);

        // 加载当前缩略图
        if (currentFirmware.has_thumbnail) {
          setCurrentThumbnail(`/api/firmware/${id}/thumbnail?t=${Date.now()}`);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load firmware data:', err);
        setError(err instanceof Error ? err.message : '加载固件数据失败');
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (projectName.length < 3 || projectName.length > 100) {
      errors.projectName = '项目名称长度必须在 3-100 个字符之间';
    }

    if (description.length < 10 || description.length > 2000) {
      errors.description = '描述长度必须在 10-2000 个字符之间';
    }

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(version)) {
      errors.version = '版本号必须符合语义化版本格式（如 1.0.0）';
    }

    if (selectedBoards.length === 0) {
      errors.selectedBoards = '至少选择一个支持的开发板';
    }

    if (tags.length > 5) {
      errors.tags = '最多只能添加 5 个标签';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 处理缩略图选择
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('缩略图必须是 PNG、JPEG 或 WebP 格式');
      return;
    }

    // 验证文件大小（500KB）
    if (file.size > 500 * 1024) {
      setError('缩略图大小不能超过 500KB');
      return;
    }

    setThumbnailFile(file);
    setError(null);

    // 生成预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setThumbnailPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 移除缩略图预览
  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  // 添加标签
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    
    if (!trimmedTag) return;

    if (tags.length >= 5) {
      setError('最多只能添加 5 个标签');
      return;
    }

    if (tags.includes(trimmedTag)) {
      setError('标签已存在');
      return;
    }

    const tagRegex = /^[a-zA-Z0-9_-]{2,20}$/;
    if (!tagRegex.test(trimmedTag)) {
      setError('标签只能包含字母、数字、下划线和连字符，长度 2-20 个字符');
      return;
    }

    setTags([...tags, trimmedTag]);
    setTagInput('');
    setError(null);
  };

  // 移除标签
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // 切换开发板选择
  const handleToggleBoard = (boardId: string) => {
    if (selectedBoards.includes(boardId)) {
      setSelectedBoards(selectedBoards.filter(id => id !== boardId));
    } else {
      setSelectedBoards([...selectedBoards, boardId]);
    }
  };

  // 保存更改
  const handleSave = async () => {
    if (!id) return;

    // 验证表单
    if (!validateForm()) {
      setError('请修正表单中的错误');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 更新元数据
      await AdminClient.updateFirmwareMetadata(id, {
        project_name: projectName,
        description,
        version,
        supported_board_ids: selectedBoards,
        tags,
        published
      });

      // 如果有新缩略图，上传
      if (thumbnailFile) {
        await AdminClient.uploadThumbnail(id, thumbnailFile);
      }

      // 导航回固件列表
      navigate('/admin/resources');
    } catch (err) {
      console.error('Failed to save firmware:', err);
      setError(err instanceof Error ? err.message : '保存失败');
      setSaving(false);
    }
  };

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-[#edf6fb] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-slate-500">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !firmware) {
    return (
      <div className="min-h-screen bg-[#edf6fb] p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/admin/resources')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回固件列表</span>
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/admin/resources')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回固件列表</span>
        </button>

        <h1 className="text-3xl font-bold text-slate-900 mb-4">编辑固件</h1>
        <p className="text-slate-600 mb-8">固件 ID: {id}</p>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
            {/* 项目名称 */}
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-slate-700 mb-2">
                项目名称 *
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.projectName ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="输入项目名称（3-100 个字符）"
              />
              {validationErrors.projectName && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.projectName}</p>
              )}
            </div>

            {/* 描述 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                描述 *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.description ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="输入项目描述（10-2000 个字符）"
              />
              {validationErrors.description && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
              )}
            </div>

            {/* 版本 */}
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-slate-700 mb-2">
                版本 *
              </label>
              <input
                type="text"
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.version ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="例如: 1.0.0"
              />
              {validationErrors.version && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.version}</p>
              )}
            </div>

            {/* 支持的开发板 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                支持的开发板 *
              </label>
              <div className="border border-slate-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                {boards.map((board) => (
                  <label key={board.id} className="flex items-center gap-2 py-2 hover:bg-[#edf6fb] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBoards.includes(board.id)}
                      onChange={() => handleToggleBoard(board.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-900">{board.name}</span>
                    <span className="text-xs text-slate-500">({board.id})</span>
                  </label>
                ))}
              </div>
              {validationErrors.selectedBoards && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.selectedBoards}</p>
              )}
            </div>

            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                标签（最多 5 个）
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入标签并按回车"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              {validationErrors.tags && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.tags}</p>
              )}
            </div>

            {/* 缩略图 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                缩略图（可选）
              </label>
              
              {/* 当前缩略图 */}
              {currentThumbnail && !thumbnailPreview && (
                <div className="mb-4">
                  <p className="text-sm text-slate-600 mb-2">当前缩略图：</p>
                  <img
                    src={currentThumbnail}
                    alt="Current thumbnail"
                    className="w-32 h-32 object-cover rounded-lg border border-slate-300"
                  />
                </div>
              )}

              {/* 新缩略图预览 */}
              {thumbnailPreview && (
                <div className="mb-4">
                  <p className="text-sm text-slate-600 mb-2">新缩略图预览：</p>
                  <div className="relative inline-block">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-32 h-32 object-cover rounded-lg border border-slate-300"
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
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer">
                <Image className="w-5 h-5" />
                <span>{thumbnailPreview ? '更换缩略图' : currentThumbnail ? '更换缩略图' : '上传缩略图'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleThumbnailChange}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-sm text-slate-500">
                支持 PNG、JPEG、WebP 格式，最大 500KB，推荐尺寸 400x400
              </p>
            </div>

            {/* 发布状态 */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">发布固件（用户可见）</span>
              </label>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存更改'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/resources')}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
