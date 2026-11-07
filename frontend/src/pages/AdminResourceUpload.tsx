/**
 * 课程资源上传页面 - 管理员统一上传
 *
 * 功能：
 * - 两种模式切换：上传项目文件夹（源代码）/ 上传固件（.bin ZIP）
 * - 共享元数据表单：名称、描述、分类（自由文本）、标签、支持的开发板、发布状态
 * - 源代码模式：复用 TemplateForm 的 webkitdirectory 文件夹上传逻辑
 * - 固件模式：复用 AdminFirmwareUpload 的 ZIP 上传逻辑
 * - 提交时调用对应的 API
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DragEvent } from 'react';
import JSZip from 'jszip';
import {
  ArrowLeft,
  Download,
  UploadCloud,
  FileText,
  Folder,
  X,
  CircleCheck,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { templateApi } from '../api/templateApi';
import { AdminClient } from '../api/adminClient';
import type { TemplateSourceFile } from '../api/templateApi';
import { ImageCropper } from '../components/ImageCropper';
import { compressImage, validateImageFile } from '../utils/imageUtils';

type UploadMode = 'source_code' | 'firmware';
type PackageFileItem = { file: File; tag: string; path: string };

const ALLOWED_EXTENSIONS = ['.ino', '.cpp', '.h', '.c', '.hpp', '.cc'];
const SAVED_CATEGORIES_KEY = 'makefast-course-categories';
const SAVED_PACKAGE_TYPES_KEY = 'makefast-package-types';
const SAVED_COURSE_TAGS_KEY = 'makefast-course-tags';
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

const readSavedCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(SAVED_CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const saveCategoryOption = (category: string, existing: string[]): string[] => {
  const value = category.trim();
  if (!value) return existing;
  const next = Array.from(new Set([value, ...existing])).slice(0, 30);
  try {
    localStorage.setItem(SAVED_CATEGORIES_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage failures.
  }
  return next;
};

const readSavedPackageTypes = (): string[] => {
  try {
    const raw = localStorage.getItem(SAVED_PACKAGE_TYPES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
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

const readSavedCourseTags = (): string[] => {
  try {
    const raw = localStorage.getItem(SAVED_COURSE_TAGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const saveCourseTagOptions = (tags: string[], existing: string[]): string[] => {
  const cleanTags = tags.map(tag => tag.trim()).filter(Boolean);
  if (cleanTags.length === 0) return existing;
  const next = Array.from(new Set([...cleanTags, ...existing])).slice(0, 50);
  try {
    localStorage.setItem(SAVED_COURSE_TAGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage failures.
  }
  return next;
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

const normalizePackageType = (value: string) => {
  return value.trim().replace(/\s+/g, '_');
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

export function AdminResourceUpload() {
  const navigate = useNavigate();

  // 模式
  const [mode, setMode] = useState<UploadMode>('source_code');

  // 共享元数据
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>(() => readSavedCategories());
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagOptions, setTagOptions] = useState<string[]>(() => readSavedCourseTags());
  const [supportedBoardIds, setSupportedBoardIds] = useState('');
  const [published, setPublished] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // 源代码模式 - 文件列表
  const [sourceFiles, setSourceFiles] = useState<TemplateSourceFile[]>([]);

  // 固件模式 - ZIP 文件
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const zipInputRef = useRef<HTMLInputElement>(null);

  // 课程文档相关
  const [article, setArticle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mdParsed, setMdParsed] = useState(false);
  const [mdParsing, setMdParsing] = useState(false);
  const [bilibiliCoverUrl, setBilibiliCoverUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [unlockCode, setUnlockCode] = useState('');
  const [lockedResources, setLockedResources] = useState<string[]>([]);

  // 附件包列表: { file: File, tag: string, path: string }[]
  const [packageFiles, setPackageFiles] = useState<PackageFileItem[]>([]);
  const [customPackageTypes, setCustomPackageTypes] = useState<string[]>(() => readSavedPackageTypes());

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 图片裁切状态
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadCategoryOptions = async () => {
      try {
        const [firmwares, firstTemplatePage] = await Promise.all([
          AdminClient.getAllFirmware(),
          templateApi.adminList({ page_size: CATEGORY_OPTION_PAGE_SIZE }),
        ]);
        if (cancelled) return;

        const templatePages = [firstTemplatePage];
        const totalPages = Math.min(
          firstTemplatePage.total_pages || 1,
          CATEGORY_OPTION_MAX_PAGES
        );
        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await templateApi.adminList({
            page,
            page_size: CATEGORY_OPTION_PAGE_SIZE,
          });
          if (cancelled) return;
          templatePages.push(nextPage);
        }

        const templates = templatePages.flatMap(page => page.templates || []);

        const remoteCategories = [
          ...(firmwares.items || []).map(item => item.tags?.[0]).filter(Boolean),
          ...templates.map(item => item.category).filter(Boolean),
        ] as string[];
        const remoteTags = [
          ...(firmwares.items || []).flatMap(item => item.tags || []),
          ...templates.flatMap(item => item.tags || []),
        ].filter(Boolean) as string[];
        const merged = Array.from(new Set([...readSavedCategories(), ...remoteCategories])).slice(0, 50);
        setCategoryOptions(merged);
        setTagOptions(prev => saveCourseTagOptions(remoteTags, prev));
        try {
          localStorage.setItem(SAVED_CATEGORIES_KEY, JSON.stringify(merged.slice(0, 30)));
        } catch {
          // Ignore localStorage failures.
        }
      } catch {
        // 分类复用只是辅助功能，加载失败不阻塞上传。
      }
    };

    loadCategoryOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const commitCategory = (value: string) => {
    const nextCategory = value.trim();
    if (!nextCategory) return;
    setCategory(nextCategory);
    setCategoryOptions(prev => saveCategoryOption(nextCategory, prev));
  };

  const createCustomCategory = () => {
    const label = window.prompt('请输入新的资源分类名称');
    const nextCategory = (label || '').trim();
    if (!nextCategory) return;
    commitCategory(nextCategory);
  };

  const updateCategory = (value: string) => {
    if (value === '__custom__') {
      createCustomCategory();
      return;
    }
    setCategory(value);
  };

  const deleteCategoryOption = (option: string) => {
    if (!window.confirm(`确定删除资源分类“${option}”吗？`)) return;
    const nextOptions = categoryOptions.filter(item => item !== option);
    setCategoryOptions(nextOptions);
    if (category === option) {
      setCategory('');
    }
    try {
      localStorage.setItem(SAVED_CATEGORIES_KEY, JSON.stringify(nextOptions.slice(0, 30)));
    } catch {
      // Ignore localStorage failures.
    }
  };

  const commitTag = (value: string) => {
    const nextTag = value.trim();
    if (!nextTag || tags.includes(nextTag) || tags.length >= 10) {
      setTagInput('');
      return;
    }
    const nextTags = [...tags, nextTag];
    setTags(nextTags);
    setTagOptions(prev => saveCourseTagOptions([nextTag], prev));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(item => item !== tag));
  };

  const deleteTagOption = (option: string) => {
    if (!window.confirm(`确定删除标签“${option}”吗？`)) return;
    const nextOptions = tagOptions.filter(item => item !== option);
    setTagOptions(nextOptions);
    try {
      localStorage.setItem(SAVED_COURSE_TAGS_KEY, JSON.stringify(nextOptions));
    } catch {
      // Ignore localStorage failures.
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
    if (!window.confirm(`确定删除资源类型“${target}”吗？已添加的文件会改为“文档资料”。`)) return;

    const nextTypes = customPackageTypes.filter(item => item !== target);
    setCustomPackageTypes(nextTypes);
    try {
      localStorage.setItem(SAVED_PACKAGE_TYPES_KEY, JSON.stringify(nextTypes));
    } catch {
      // Ignore localStorage failures.
    }
    setPackageFiles(prev => prev.map(pkg => pkg.tag === target ? { ...pkg, tag: 'document' } : pkg));
    setLockedResources(prev => prev.filter(tag => tag !== target));
  };

  const updatePackageTag = (index: number, nextTag: string) => {
    const normalizedNext = nextTag === '__custom__'
      ? createCustomPackageType()
      : normalizePackageType(nextTag);
    if (!normalizedNext) return;

    setPackageFiles(prev => prev.map((pkg, i) => i === index ? { ...pkg, tag: normalizedNext } : pkg));
    setLockedResources(prev => {
      const oldTag = packageFiles[index]?.tag;
      if (!oldTag || !prev.includes(oldTag)) return prev;
      return Array.from(new Set(prev.map(tag => tag === oldTag ? normalizedNext : tag)));
    });
  };

  const addPackageFiles = (fileList: FileList | File[]) => {
    const nextFiles = Array.from(fileList).map(file => ({
      file,
      tag: detectPackageType(file),
      path: getFilePath(file),
    }));
    if (nextFiles.length === 0) return;
    setPackageFiles(prev => [...prev, ...nextFiles]);
    setError(null);
  };

  const buildPackageZip = async (tag: string, files: PackageFileItem[]) => {
    const zip = new JSZip();
    files.forEach(item => {
      zip.file(item.path || item.file.name, item.file);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    return new File([blob], `${tag}.zip`, { type: 'application/zip' });
  };

  // 处理文件夹上传（源代码模式）
  const handleFolderUpload = async (fileList: FileList) => {
    // 先把 FileList 转为普通数组（避免 live 对象在 await 后失效）
    const filesArray: File[] = Array.from(fileList);
    const newFiles: TemplateSourceFile[] = [];

    console.log(`[FolderUpload] Total files received: ${filesArray.length}`);

    for (const file of filesArray) {
      const fileName = file.name;
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

      console.log(`[FolderUpload] Processing: name="${fileName}", ext="${ext}", size=${file.size}`);

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        console.log(`[FolderUpload] Skipping: ${fileName}`);
        continue;
      }

      try {
        const content = await file.text();
        const existingIndex = newFiles.findIndex(f => f.name === fileName);
        if (existingIndex >= 0) {
          newFiles[existingIndex] = { name: fileName, content };
        } else {
          newFiles.push({ name: fileName, content });
        }
      } catch (err) {
        console.error(`Failed to read file ${fileName}:`, err);
      }
    }

    console.log(`[FolderUpload] Valid files: ${newFiles.length}`, newFiles.map(f => f.name));

    if (newFiles.length === 0 && filesArray.length > 0) {
      alert(`未找到代码文件。文件夹中共 ${filesArray.length} 个文件，请确保包含 .ino/.cpp/.h/.c 文件。`);
    }

    setSourceFiles(newFiles);
  };

  // 拖拽处理（固件模式）
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const zip = files.find(f => f.name.endsWith('.zip'));
    if (zip) {
      setZipFile(zip);
    } else {
      setError('请上传 .zip 格式的文件');
    }
  };

  // 下载课程文档模板
  const handleDownloadTemplate = () => {
    const template = `---
title: "课程名称"
category: "入门教程"
level: 3
tags: ["ESP32", "Arduino"]
boards: ["esp32"]
cover: "BVxxxxxxxxxx"
video_bilibili: "https://www.bilibili.com/video/BVxxxxxxxxxx"
video_douyin: ""
video_xiaohongshu: ""
---

# 课程名称

> 一句话简介：通过本项目你将学会...

## 项目介绍

在这里写项目的详细介绍。包括：
- 项目背景和目的
- 使用的硬件（ESP32、传感器等）
- 实现的功能

## 材料清单

| 材料 | 数量 | 说明 |
|------|------|------|
| ESP32 开发板 | 1 | |
| 面包板 | 1 | |
| 杜邦线 | 若干 | |

## 电路连接

| ESP32 引脚 | 外设 | 说明 |
|-----------|------|------|
| GPIO13 | LED | 板载 LED |
| 5V | 传感器 VCC | 供电 |

## 关键代码说明

\`\`\`cpp
void setup() {
  // 初始化代码
}

void loop() {
  // 主循环代码
}
\`\`\`

## 运行效果

描述项目运行后的预期效果。

## 常见问题

1. **上传失败？** 检查串口是否被占用...
2. **编译报错？** 确认开发板型号选择正确...

## 扩展挑战

1. 尝试修改延时时间观察效果变化
2. 尝试添加更多传感器
`;
    const blob = new Blob([template], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'course-template.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 处理 MD 文档上传解析
  const handleMdUpload = async (file: File) => {
    setMdParsing(true);
    setError(null);
    try {
      const result = await templateApi.parseMd(file);
      if (result.success) {
        // 自动填充表单
        if (result.title) setName(result.title);
        if (result.description) setDescription(result.description);
        if (result.category) {
          setCategory(result.category);
          setCategoryOptions(prev => saveCategoryOption(result.category, prev));
        }
        if (result.tags) {
          const parsedTags = result.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
          setTags(parsedTags);
          setTagOptions(prev => saveCourseTagOptions(parsedTags, prev));
        }
        if (result.boards) setSupportedBoardIds(result.boards);
        if (result.article) setArticle(result.article);
        if (result.level) setLevel(result.level);

        // 处理视频链接
        if (result.video_bilibili) setVideoUrl(result.video_bilibili);
        else if (result.video_douyin) setVideoUrl(result.video_douyin);
        else if (result.video_xiaohongshu) setVideoUrl(result.video_xiaohongshu);

        // 如果 cover 是 BV 号，获取 B 站封面
        if (result.cover && result.cover.startsWith('BV')) {
          try {
            const coverResult = await templateApi.getBilibiliCover(result.cover);
            if (coverResult.cover_url) {
              setBilibiliCoverUrl(coverResult.cover_url);
            }
          } catch (e) {
            console.warn('获取 B 站封面失败:', e);
          }
        }

        setMdParsed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MD 文档解析失败');
    } finally {
      setMdParsing(false);
    }
  };

  // 处理封面图片选择（打开裁切）
  const handleCoverImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || '图片格式不支持');
      return;
    }

    setImageToCrop(file);
    setShowCropper(true);
    e.target.value = '';
  };

  // 裁切完成
  const handleCropComplete = async (croppedFile: File) => {
    setShowCropper(false);
    setImageToCrop(null);

    // 自动压缩
    let finalFile = croppedFile;
    if (finalFile.size > 500 * 1024) {
      finalFile = await compressImage(finalFile, 500 * 1024);
    }

    setCoverImage(finalFile);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(finalFile);
  };

  // 取消裁切
  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
  };

  // 验证表单
  const validate = (): boolean => {
    if (!name.trim() || name.length < 3) {
      setError('名称至少 3 个字符');
      return false;
    }
    if (!description.trim() || description.length < 10) {
      setError('描述至少 10 个字符');
      return false;
    }
    if (!category.trim()) {
      setError('请输入分类');
      return false;
    }
    if (!supportedBoardIds.trim()) {
      setError('请输入至少一个支持的开发板 ID');
      return false;
    }

    if (mode === 'source_code') {
      if (sourceFiles.length === 0) {
        setError('请上传项目文件夹（至少包含一个源代码文件）');
        return false;
      }
    } else {
      if (!zipFile) {
        setError('请选择固件 ZIP 文件');
        return false;
      }
      if (!version.trim() || !/^\d+\.\d+\.\d+$/.test(version)) {
        setError('版本号格式错误（应为 x.y.z）');
        return false;
      }
    }

    return true;
  };

  // 提交
  const handleSubmit = async () => {
    setError(null);
    if (!validate()) return;

    setLoading(true);

    try {
      const tagList = tags.map(t => t.trim()).filter(Boolean);
      const submitCategory = category.trim();
      const submitTags = Array.from(new Set(tagList)).slice(0, 10);
      const boardIds = supportedBoardIds
        .split(',')
        .map(b => b.trim())
        .filter(Boolean);

      if (mode === 'source_code') {
        // 调用模板 API 创建
        const packageGroups = packageFiles.reduce<Record<string, PackageFileItem[]>>((groups, pkg) => {
          const tag = normalizePackageType(pkg.tag);
          if (!tag) return groups;
          groups[tag] = [...(groups[tag] || []), { ...pkg, tag }];
          return groups;
        }, {});
        const pkgTags = Object.keys(packageGroups);
        const submitLockedResources = lockedResources.filter(tag => tag === 'source_code' || pkgTags.includes(tag));
        const result = await templateApi.create({
          name: name.trim(),
          description: description.trim(),
          category: submitCategory,
          tags: submitTags,
          supported_board_ids: boardIds,
          published,
          files: sourceFiles,
          ...(article ? { article } : {}),
          ...(videoUrl ? { video_url: videoUrl } : {}),
          ...(level ? { level } : {}),
          packages: pkgTags,
          locked_resources: submitLockedResources,
          ...(unlockCode ? { unlock_code: unlockCode } : {}),
        } as any);
        // 上传附件包
        if (result?.template_id && packageFiles.length > 0) {
          for (const [tag, files] of Object.entries(packageGroups)) {
            try {
              await templateApi.uploadPackage(result.template_id, await buildPackageZip(tag, files), tag);
            } catch (e) {
              console.warn(`附件包 ${tag} 上传失败:`, e);
            }
          }
        }
        // 上传封面图片到模板
        if (coverImage && result?.template_id) {
          try {
            await templateApi.uploadThumbnail(result.template_id, coverImage);
          } catch (e) {
            console.warn('封面图片上传失败:', e);
          }
        }
      } else {
        // 调用固件 API 上传
        const result = await AdminClient.uploadFirmware({
          zip_file: zipFile!,
          project_name: name.trim(),
          description: description.trim(),
          version: version.trim(),
          supported_board_ids: boardIds,
          tags: submitTags,
          published,
        });
        // 上传封面图片
        if (coverImage && result?.firmware_id) {
          try {
            await AdminClient.uploadThumbnail(result.firmware_id, coverImage);
          } catch (e) {
            console.warn('封面图片上传失败:', e);
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/admin/resources');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="max-w-4xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/admin/resources')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回资源列表</span>
        </button>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-slate-900 mb-6">上传课程</h1>

        {/* 成功提示 */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <CircleCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-green-800 font-medium">上传成功！</p>
              <p className="text-green-700 text-sm">正在跳转到资源列表...</p>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-red-800 font-medium">操作失败</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* 模式切换 */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setMode('source_code')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
              mode === 'source_code'
                ? 'bg-teal-100 text-teal-700 font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Folder className="w-5 h-5" />
            上传项目文件夹
          </button>
          <button
            onClick={() => setMode('firmware')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
              mode === 'firmware'
                ? 'bg-orange-100 text-orange-700 font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Cpu className="w-5 h-5" />
            上传固件
          </button>
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {mode === 'source_code' ? '项目文件' : '固件文件'}
          </h2>

          {mode === 'source_code' ? (
            /* 源代码 - 文件夹上传 */
            <div>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                {sourceFiles.length > 0 ? (
                  <div>
                    <Folder className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-teal-700">
                      已加载 {sourceFiles.length} 个源文件
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 justify-center">
                      {sourceFiles.map((f, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          {f.name}
                        </span>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer text-sm">
                      重新选择文件夹
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        {...({ webkitdirectory: '', directory: '' } as any)}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFolderUpload(e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-slate-700 mb-2">点击选择项目文件夹</p>
                    <p className="text-sm text-slate-500">
                      支持 .ino, .cpp, .h, .c 文件
                    </p>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      {...({ webkitdirectory: '', directory: '' } as any)}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFolderUpload(e.target.files);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ) : (
            /* 固件 - ZIP 上传 */
            <div>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : zipFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-slate-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {zipFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-green-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">{zipFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(zipFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setZipFile(null)}
                      className="p-1 text-gray-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-slate-700 mb-2">
                      拖拽 ZIP 文件到此处，或
                      <button
                        onClick={() => zipInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-700 ml-1"
                      >
                        点击选择文件
                      </button>
                    </p>
                    <p className="text-sm text-slate-500">
                      ZIP 文件应包含 bootloader.bin、partitions.bin、boot_app0.bin 和 app.bin
                    </p>
                  </>
                )}
              </div>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setZipFile(file);
                }}
              />

              {/* 版本号（仅固件模式） */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  版本号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  使用语义化版本格式（例如：1.0.0）
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 上传课程文档 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">上传课程文档</h2>
          <p className="text-sm text-slate-500 mb-3">
            上传 .md 格式的课程文档，系统将自动解析并填充课程信息。
            可先下载模板，用 AI 根据项目介绍生成课程文档。
          </p>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer text-sm font-medium">
              <FileText className="w-5 h-5" />
              {mdParsing ? '解析中...' : '选择 MD 文件'}
              <input
                type="file"
                accept=".md"
                className="hidden"
                disabled={mdParsing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleMdUpload(file);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#edf6fb] text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium border border-slate-200"
            >
              <Download className="w-5 h-5" />
              下载模板
            </button>
            {mdParsed && (
              <span className="text-sm text-green-600 font-medium">
                ✓ 文档解析成功，已自动填充课程信息
              </span>
            )}
          </div>
          {bilibiliCoverUrl && (
            <div className="mt-4">
              <p className="text-sm text-slate-600 mb-2">B 站视频封面预览：</p>
              <img
                src={bilibiliCoverUrl}
                alt="B站视频封面"
                className="w-48 h-auto rounded-lg border border-slate-200"
              />
            </div>
          )}
        </div>

        {/* 课程信息 - MD 自动填充 */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">课程信息</h2>
          {mdParsed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-800">
              ✓ 已从 MD 文档自动填充课程信息，请确认后上传
            </div>
          )}

          {/* 名称 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              名称 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="课程名称" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">描述 <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="课程简述" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* 开发板 + 难度 + 分类 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">开发板 <span className="text-red-500">*</span></label>
              <input type="text" value={supportedBoardIds} onChange={(e) => setSupportedBoardIds(e.target.value)}
                placeholder="如: esp32, esp32s3" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">难度星级 <span className="text-red-500">*</span></label>
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="1">★☆☆☆☆ 入门</option>
                <option value="2">★★☆☆☆ 初级</option>
                <option value="3">★★★☆☆ 中级</option>
                <option value="4">★★★★☆ 进阶</option>
                <option value="5">★★★★★ 高级</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">资源分类 <span className="text-red-500">*</span></label>
              <div className="space-y-2">
                <select
                  value={category}
                  onChange={(e) => updateCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择分类</option>
                  {categoryOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value="__custom__">新增自定义分类...</option>
                </select>
                {categoryOptions.length > 0 && (
                  <div className="max-h-20 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {categoryOptions.map(option => (
                        <span
                          key={option}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        >
                          {option}
                          <button
                            type="button"
                            onClick={() => deleteCategoryOption(option)}
                            className="text-slate-400 hover:text-red-500"
                            aria-label={`删除资源分类 ${option}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 标签 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">补充标签</label>
            <div className="rounded-lg border border-slate-300 bg-white px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500">
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
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
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      commitTag(tagInput);
                    }
                    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                      removeTag(tags[tags.length - 1]);
                    }
                  }}
                  onBlur={() => commitTag(tagInput)}
                  placeholder={tags.length === 0 ? '输入后按回车确认，例如: 传感器' : '继续添加'}
                  className="min-w-[180px] flex-1 border-0 px-1 py-0.5 text-sm outline-none"
                  disabled={tags.length >= 10}
                />
              </div>
            </div>
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
                      <button
                        type="button"
                        onClick={() => deleteTagOption(option)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`删除标签 ${option}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* B 站视频链接 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">B 站视频链接</label>
            <div className="flex gap-2">
              <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="B站视频链接，例如: https://www.bilibili.com/video/BV..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={async () => {
                if (!videoUrl) return;
                const bvMatch = videoUrl.match(/BV[a-zA-Z0-9]{8,15}/);
                if (!bvMatch) return;
                try {
                  // 调用后端公开 API 获取封面
                  const response = await fetch(`/api/templates/bilibili-cover?bvid=${bvMatch[0]}`);
                  const data = await response.json();
                  if (data.cover_url) {
                    // 使用后端代理获取图片（解决防盗链问题）
                    setBilibiliCoverUrl(`/api/templates/bilibili-cover-image?url=${encodeURIComponent(data.cover_url)}`);
                  }
                } catch (e) {
                  console.warn('获取 B 站封面失败:', e);
                }
              }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                自动解析
              </button>
            </div>
          </div>

          {/* 封面图片 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">封面图片 <span className="text-red-500">*</span></label>
            <div className="flex items-start gap-4">
              {coverPreview ? (
                <div className="relative">
                  <img src={coverPreview} alt="封面预览" className="w-32 h-32 object-cover rounded-lg border border-slate-300" />
                  <button type="button" onClick={() => { setCoverImage(null); setCoverPreview(null); }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : bilibiliCoverUrl ? (
                <div className="relative">
                  <img src={bilibiliCoverUrl} alt="B站封面" className="w-32 h-32 object-cover rounded-lg border border-slate-300" />
                  <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">B站封面</span>
                </div>
              ) : (
                <label className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                  <UploadCloud className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-slate-500 mt-1">选择图片</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={handleCoverImageSelect} />
                </label>
              )}
              <div className="text-xs text-slate-500 pt-2">
                <p>支持 PNG、JPEG、WebP 格式</p>
                <p>选择后可裁切，自动压缩至 500KB 以内</p>
                <p>输出尺寸 400×300</p>
              </div>
            </div>
          </div>

          {/* 发布状态 */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm text-slate-700">{published ? '立即发布（用户可见）' : '保存为草稿'}</span>
          </div>
        </div>

        {/* 附件包上传 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">课程资源包</h2>
          <p className="text-sm text-slate-500 mb-4">上传附件后，系统会按文件类型自动分类；也可以在列表中手动调整资源类型。</p>

          {/* 已有包列表 */}
          {packageFiles.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[150px_1fr_90px_82px_150px_44px] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                <div>资源类型</div>
                <div>文件名</div>
                <div>大小</div>
                <div>锁定</div>
                <div>解锁口令</div>
                <div className="text-right">操作</div>
              </div>
              {packageFiles.map((pkg, i) => (
                <div key={`${pkg.tag}-${pkg.file.name}-${i}`} className="grid grid-cols-[150px_1fr_90px_82px_150px_44px] items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm">
                  <select
                    value={pkg.tag}
                    onChange={(e) => updatePackageTag(i, e.target.value)}
                    className="min-w-0 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                    title={getPackageTypeLabel(pkg.tag, customPackageTypes)}
                  >
                    {PACKAGE_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    {customPackageTypes.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="__custom__">新增自定义类型...</option>
                  </select>
                  <div className="min-w-0 truncate text-slate-700" title={pkg.path}>{pkg.path}</div>
                  <div className="text-xs text-slate-500">{(pkg.file.size / 1024).toFixed(1)} KB</div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={lockedResources.includes(pkg.tag)}
                      onChange={() => {
                        if (lockedResources.includes(pkg.tag)) {
                          setLockedResources(prev => prev.filter(t => t !== pkg.tag));
                        } else {
                          setLockedResources(prev => [...prev, pkg.tag]);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                    />
                    锁定
                  </label>
                  <input
                    type="text"
                    value={unlockCode}
                    onChange={(e) => setUnlockCode(e.target.value)}
                    disabled={!lockedResources.includes(pkg.tag)}
                    placeholder="口令"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLockedResources(prev => prev.filter(t => t !== pkg.tag));
                      setPackageFiles(prev => prev.filter((_, j) => j !== i));
                    }}
                    className="justify-self-end text-gray-400 hover:text-red-500"
                    aria-label={`删除资源包 ${pkg.file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 添加包 */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">选择文件</label>
                <input
                  type="file"
                  id="pkg-file-input"
                  multiple
                  className="w-full text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addPackageFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">选择文件夹</label>
                <input
                  type="file"
                  multiple
                  className="w-full text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addPackageFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>
            {customPackageTypes.length > 0 && (
              <div>
                <div className="mb-1 text-xs text-slate-500">自定义类型</div>
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

            {sourceFiles.length > 0 && (
              <div className="grid grid-cols-[1fr_82px_150px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-sm text-slate-700">源代码</div>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={lockedResources.includes('source_code')}
                    onChange={() => {
                      if (lockedResources.includes('source_code')) {
                        setLockedResources(prev => prev.filter(t => t !== 'source_code'));
                      } else {
                        setLockedResources(prev => [...prev, 'source_code']);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                  />
                  锁定
                </label>
                <input
                  type="text"
                  value={unlockCode}
                  onChange={(e) => setUnlockCode(e.target.value)}
                  disabled={!lockedResources.includes('source_code')}
                  placeholder="口令"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/admin/resources')}
            disabled={loading}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-[#edf6fb] transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || success}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '上传中...' : '上传课程'}
          </button>
        </div>
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
    </div>
  );
}
