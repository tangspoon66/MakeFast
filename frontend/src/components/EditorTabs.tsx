/**
 * 编辑器标签页组件
 * 提供代码视图、积木视图、项目视图和课程库的切换
 */

import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import {
  Code2, Blocks, FolderOpen, BookOpen,
  Search,
  Star, ArrowLeft,
  Cpu, FileUp, FileCode2, Plus, X,
  Pin, MessageCircleQuestion, Send, UploadCloud, ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeEditor } from './CodeEditor';
import type { CodeFile } from './MultiFileEditor';
import { templateApi, type TemplateListItem } from '../api/templateApi';
import { FirmwareClient } from '../api/firmwareClient';
import type { CourseFolder, CourseQAItem, FirmwareMetadata } from '../api/types';
import { useEditorStore } from '../store/editorStore';
import { analyzeLocalFirmwareFiles, filesToLocalFirmwareFiles, formatHexAddress, parseHexAddress, type LocalFirmwareAnalysis, type LocalFirmwareFile } from '../utils/localFirmware';

const loadBlocklyEditor = () => import('./BlocklyEditor');

export const preloadBlocklyEditor = () => {
  void loadBlocklyEditor();
};

const BlocklyEditor = lazy(() =>
  loadBlocklyEditor().then((m) => ({ default: m.BlocklyEditor }))
);

interface EditorTabsProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  readOnly?: boolean;
  onProjectFilesChange?: (files: Array<{ name: string; content: string }>) => void;
  onCourseDetailChange?: (isDetail: boolean, courseData?: any) => void;
  onImportProject?: (courseData: any) => void;
  onConversionWarning?: (message: string) => void;
  selectedBoardInfo?: { id: string; name: string; chip_family?: string; upload_protocol?: string } | null;
  localFirmwareFiles?: LocalFirmwareFile[];
  localFirmwareAnalysis?: LocalFirmwareAnalysis | null;
  onLocalFirmwareChange?: (files: LocalFirmwareFile[], analysis: LocalFirmwareAnalysis | null) => void;
}

type ViewMode = 'code' | 'blocks' | 'library' | 'firmware';
type UploadMode = 'replace' | 'append';
type CourseLibraryView = 'all' | 'series';
const HISTORY_APP_ID = 'makefast';
const LEGACY_HISTORY_APP_ID = 'esp-online';

function isMakeFastHistoryState(state: any) {
  return state?.app === HISTORY_APP_ID || state?.app === LEGACY_HISTORY_APP_ID;
}

async function convertCodeToBlocksXml(code: string) {
  const { parseCodeToXml } = await import('../blockly/codeToBlocksParser');
  return parseCodeToXml(code);
}


function CourseQASection({ templateId }: { templateId: string }) {
  const [items, setItems] = useState<CourseQAItem[]>([]);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadQA = useCallback(async () => {
    try {
      setLoading(true);
      const list = await templateApi.listCourseQA(templateId);
      setItems(list);
    } catch (error) {
      console.warn('Failed to load course QA:', error);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { loadQA(); }, [loadQA]);

  const submit = async () => {
    if (!nickname.trim()) {
      setMessage('请填写昵称');
      return;
    }
    if (content.trim().length < 10) {
      setMessage('请把问题描述得更具体一点');
      return;
    }
    try {
      setSubmitting(true);
      const result = await templateApi.submitCourseQA(templateId, {
        nickname: nickname.trim(),
        email: email.trim() || undefined,
        content: content.trim(),
      });
      setContent('');
      setMessage(result.message || '提交成功，审核通过后会显示在课程下方');
    } catch (error: any) {
      setMessage(error?.message || '提交失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <MessageCircleQuestion style={{ width: 18, height: 18, color: '#2563eb' }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>课程问答</h2>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#64748b' }}>加载问答中...</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>还没有公开问答，你可以提出第一个问题。</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          {items.map(item => (
            <article key={item.id} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.nickname}</strong>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap', margin: 0 }}>{item.content}</p>
              {item.admin_reply && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: '#ecfdf5', color: '#047857', fontSize: 13, lineHeight: 1.7 }}>
                  <strong>老师回复：</strong>{item.admin_reply}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div style={{ border: '1px solid #dbeafe', background: '#f8fbff', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginBottom: 8 }}>
          <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="昵称" maxLength={40} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱（回复时通知你）" type="email" style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="遇到问题、看不懂的步骤，或者想补充的想法，都可以写在这里。" rows={3} maxLength={1000} style={{ width: '100%', resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: 6, padding: 10, fontSize: 13, lineHeight: 1.6 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: message ? '#2563eb' : '#64748b' }}>{message || '审核通过后会显示在课程下方。'}</span>
          <button type="button" onClick={submit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            <Send style={{ width: 14, height: 14 }} />
            {submitting ? '提交中...' : '提交问题'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CourseLibraryPanel - 内嵌课程库面板
// ============================================================================

interface UnifiedResource {
  id: string;
  name: string;
  type: 'firmware' | 'source_code';
  category: string;
  tags: string[];
  supported_board_ids: string[];
  created_at: string;
  firmware_id?: string;
  level?: number;
  cover_url?: string;
  has_thumbnail?: boolean;
  packages?: string[];
  locked_resources?: string[];
  pinned?: boolean;
}

interface CourseLibraryPanelProps {
  onLoadProject: (files: Array<{ name: string; content: string }>, boardId?: string) => void;
  onCourseDetailChange?: (isDetail: boolean, courseData?: any) => void;
  onImportProject?: (courseData: any) => void;
  searchQuery: string;
}

/** 难度文字映射 */
const LEVEL_LABELS: Record<number, string> = {
  1: '入门',
  2: '初级',
  3: '中级',
  4: '进阶',
  5: '高级',
};

/** 渲染星级 */
function StarRating({ level, size = 14 }: { level?: number; size?: number }) {
  if (!level) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {[1, 2, 3, 4, 5].map(n =>
          n <= level ? (
            <Star key={n} size={size} fill="#f59e0b" color="#f59e0b" />
          ) : (
            <Star key={n} size={size} color="#d1d5db" />
          )
        )}
      </span>
      <span style={{ fontSize: size - 2, color: '#fbbf24', fontWeight: 500 }}>
        {LEVEL_LABELS[level] || ''}
      </span>
    </span>
  );
}

/** 从代码中自动检测开发板 */
function detectBoardFromCode(code: string): string | null {
  // ESP8266 专属头文件
  if (/ESP8266/i.test(code)) return 'esp8266-generic';
  // ESP32 系列 - 优先检测 S3/C3/C6 专属特征
  if (/esp32s3|ESP32-S3/i.test(code)) return 'esp32s3';
  if (/esp32c3|ESP32-C3/i.test(code)) return 'esp32c3';
  if (/esp32c6|ESP32-C6/i.test(code)) return 'esp32c6';
  if (/esp32s2|ESP32-S2/i.test(code)) return 'esp32s2';
  // 通用 ESP32 特征
  if (/esp32|ESP32|WiFi\.h|WebServer\.h|esp_camera|esp_now|Preferences\.h|BluetoothSerial/i.test(code)) return 'esp32';
  // Arduino AVR
  if (/Servo\.h|Arduino\.h|avr/i.test(code) && !/ESP|WiFi/i.test(code)) return 'arduino_uno';
  return null;
}

/** B站视频 URL 转播放器地址，占位符跳过 */
function bilibiliEmbedUrl(url: string): string | null {
  const bvMatch = url.match(/BV[a-zA-Z0-9]{8,15}/);
  if (bvMatch) {
    const bvid = bvMatch[0];
    if (bvid.includes('xxx') || bvid.includes('XXXX')) return null;
    return `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0`;
  }
  return null;
}

function CourseLibraryPanel({
  onCourseDetailChange,
  searchQuery,
}: CourseLibraryPanelProps) {
  const navigate = useNavigate();
  const storeSetViewMode = useEditorStore((s) => s.setViewMode);
  const [resources, setResources] = useState<UnifiedResource[]>([]);
  const [filteredResources, setFilteredResources] = useState<UnifiedResource[]>([]);
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<CourseFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CourseFolder | null>(null);
  const [libraryView, setLibraryView] = useState<CourseLibraryView>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // 详情视图状态
  const [selectedResource, setSelectedResource] = useState<UnifiedResource | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    article?: string;
    video_url?: string;
    cover_url?: string;
    level?: number;
    packages?: string[];
    locked_resources?: string[];
    files: Array<{ name: string; content: string }>;
    supported_board_ids: string[];
  } | null>(null);

  const syncHistoryState = useCallback((nextState: Record<string, any>, replace = false) => {
    const state = { app: HISTORY_APP_ID, ...nextState };
    if (replace) {
      window.history.replaceState(state, '', window.location.href);
    } else {
      window.history.pushState(state, '', window.location.href);
    }
  }, []);

  useEffect(() => {
    if (!isMakeFastHistoryState(window.history.state)) {
      syncHistoryState({
        mode: useEditorStore.getState().viewMode,
        libraryView,
        folderId: null,
        resourceId: null,
      }, true);
    }
  }, [libraryView, syncHistoryState]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [firmwares, templateResponse, folderResponse] = await Promise.all([
        FirmwareClient.getFirmwareList(),
        templateApi.list({ page_size: 50 }),
        templateApi.listCourseFolders(),
      ]);

      const firmwareResources: UnifiedResource[] = (firmwares.items || []).map((fw: FirmwareMetadata) => ({
        id: fw.firmware_id,
        name: fw.project_name,
        type: 'firmware' as const,
        category: fw.tags.length > 0 ? fw.tags[0] : '未分类',
        tags: fw.tags,
        supported_board_ids: fw.supported_board_ids,
        created_at: fw.created_at,
        firmware_id: fw.firmware_id,
        pinned: false,
      }));

      const templateResources: UnifiedResource[] = templateResponse.templates.map((tpl: TemplateListItem) => ({
        id: tpl.template_id,
        name: tpl.name,
        type: 'source_code' as const,
        category: tpl.category,
        tags: tpl.tags,
        supported_board_ids: tpl.supported_board_ids,
        created_at: tpl.created_at,
        level: tpl.level,
        cover_url: tpl.cover_url,
        has_thumbnail: tpl.has_thumbnail,
        packages: tpl.packages,
        locked_resources: tpl.locked_resources,
        pinned: tpl.pinned,
      }));

      setResources([...firmwareResources, ...templateResources].sort(
        (a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      ));
      setFolders(folderResponse || []);

      // 提取可用分类
      const categories = [...new Set([...firmwareResources, ...templateResources].map(r => r.category).filter(Boolean))];
      setAvailableCategories(categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadResources(); }, [loadResources]);

  useEffect(() => {
    let filtered = [...resources];
    let folderMatches = libraryView === 'series' && !selectedFolder ? [...folders] : [];

    if (selectedFolder) {
      const folderOrder = new Map(selectedFolder.items.map((item, index) => [item.template_id, index]));
      filtered = filtered
        .filter(r => folderOrder.has(r.id))
        .sort((a, b) => (folderOrder.get(a.id) ?? 9999) - (folderOrder.get(b.id) ?? 9999));
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q))
      );
      folderMatches = folderMatches.filter(folder =>
        folder.name.toLowerCase().includes(q) ||
        folder.description.toLowerCase().includes(q) ||
        folder.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // 分类筛选
    if (categoryFilter) {
      filtered = filtered.filter(r => r.category === categoryFilter);
      folderMatches = folderMatches.filter(folder => folder.category === categoryFilter);
    }

    setFilteredResources(filtered);
    setFilteredFolders(folderMatches);
  }, [resources, folders, selectedFolder, libraryView, searchQuery, categoryFilter]);

  const resetDetailState = useCallback(() => {
    setDetailData(null);
  }, []);

  const handleLibraryViewChange = (view: CourseLibraryView) => {
    if (view === libraryView && !selectedFolder) return;
    setLibraryView(view);
    setSelectedFolder(null);
    setSelectedResource(null);
    resetDetailState();
    syncHistoryState({
      mode: 'library',
      libraryView: view,
      folderId: null,
      resourceId: null,
    });
  };

  const handleSelectFolder = (folder: CourseFolder) => {
    setSelectedFolder(folder);
    setSelectedResource(null);
    resetDetailState();
    syncHistoryState({
      mode: 'library',
      libraryView,
      folderId: folder.folder_id,
      resourceId: null,
    });
  };

  const handleOpenDetail = async (resource: UnifiedResource) => {
    setDetailLoading(true);
    setSelectedResource(resource);
    resetDetailState();
    
    syncHistoryState({
      mode: 'library',
      libraryView,
      folderId: selectedFolder?.folder_id ?? null,
      resourceId: resource.id,
    });
    
    try {
      const detail = await templateApi.getDetail(resource.id);
      const courseData = {
        article: (detail as any).article || '',
        video_url: (detail as any).video_url || '',
        cover_url: (detail as any).cover_url || '',
        level: (detail as any).level,
        packages: (detail as any).packages || [],
        locked_resources: (detail as any).locked_resources || [],
        files: detail.files,
        supported_board_ids: detail.supported_board_ids,
      };
      setDetailData(courseData);
      // 通知父组件进入课程详情页
      if (onCourseDetailChange) {
        onCourseDetailChange(true, { ...resource, ...courseData });
      }
    } catch (err) {
      alert(`加载详情失败：${err instanceof Error ? err.message : '未知错误'}`);
      setSelectedResource(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // 返回课程列表
  const handleBackToList = () => {
    window.history.back();
  };

  useEffect(() => {
    if (!selectedResource || detailData || detailLoading) return;

    let cancelled = false;
    setDetailLoading(true);
    templateApi.getDetail(selectedResource.id)
      .then(detail => {
        if (cancelled) return;
        const courseData = {
          article: (detail as any).article || '',
          video_url: (detail as any).video_url || '',
          cover_url: (detail as any).cover_url || '',
          level: (detail as any).level,
          packages: (detail as any).packages || [],
          locked_resources: (detail as any).locked_resources || [],
          files: detail.files,
          supported_board_ids: detail.supported_board_ids,
        };
        setDetailData(courseData);
        if (onCourseDetailChange) {
          onCourseDetailChange(true, { ...selectedResource, ...courseData });
        }
      })
      .catch(err => {
        if (cancelled) return;
        alert(`加载详情失败：${err instanceof Error ? err.message : '未知错误'}`);
        setSelectedResource(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailData, detailLoading, onCourseDetailChange, selectedResource]);

  // 监听浏览器返回键
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!isMakeFastHistoryState(state)) {
        return;
      }
      if (state.mode === 'library' && !state.resourceId && !state.folderId) {
        setSelectedResource(null);
        setDetailData(null);
        if (onCourseDetailChange) {
          onCourseDetailChange(false);
        }
      }

      const nextMode = state.mode as ViewMode | undefined;
      if (nextMode) {
        storeSetViewMode(nextMode);
      }

      if (nextMode !== 'library') {
        setLibraryView('all');
        setSelectedFolder(null);
        setSelectedResource(null);
        setDetailData(null);
        if (onCourseDetailChange) {
          onCourseDetailChange(false);
        }
        return;
      }

      setLibraryView((state.libraryView as CourseLibraryView) || 'all');

      const folder = state.folderId
        ? folders.find(item => item.folder_id === state.folderId) || null
        : null;
      setSelectedFolder(folder);

      if (state.resourceId) {
        const resource = resources.find(item => item.id === state.resourceId) || null;
        resetDetailState();
        setSelectedResource(resource);
      } else {
        setSelectedResource(null);
        resetDetailState();
        if (onCourseDetailChange) {
          onCourseDetailChange(false);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [folders, onCourseDetailChange, resetDetailState, resources, storeSetViewMode]);

  const getThumbnailUrl = (r: UnifiedResource) => {
    if (r.has_thumbnail) return `/api/templates/${r.id}/thumbnail`;
    if (r.cover_url) return r.cover_url;
    return null;
  };

  if (loading) {
    return (
      <div className="course-library-panel">
        <div className="course-library-panel__loading">
          <div className="course-library-panel__spinner" />
          <p>加载资源中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-library-panel">
        <div className="course-library-panel__error">
          <p>{error}</p>
          <button onClick={loadResources} className="course-library-panel__retry-btn">重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="course-library-panel">
      {selectedResource ? (
        <div className="course-library-panel__detail">
          <button
            onClick={handleBackToList}
            className="course-library-panel__back-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 12, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#374151' }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            返回列表
          </button>

          {detailLoading ? (
            <div className="course-library-panel__loading">
              <div className="course-library-panel__spinner" />
              <p>加载详情中...</p>
            </div>
          ) : detailData ? (
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
              {/* 标题 */}
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                {selectedResource.name}
              </h1>

              {/* 星级 + 分类 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <StarRating level={detailData.level} size={12} />
                <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                  {selectedResource.category}
                </span>
                {selectedResource.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, color: '#475569', background: '#eef2ff', padding: '2px 6px', borderRadius: 4 }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* B站视频 */}
              {detailData.video_url && bilibiliEmbedUrl(detailData.video_url) && (
                <div style={{ marginBottom: 12 }}>
                  <iframe
                    src={bilibiliEmbedUrl(detailData.video_url)!}
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allow="autoplay; fullscreen"
                    style={{ width: '100%', height: 200, border: 'none', borderRadius: 8 }}
                    allowFullScreen
                  />
                </div>
              )}

              {/* MD 文章 - 无边框样式 */}
              {detailData.article && (
                <div className="course-article-content" style={{ fontSize: 13, lineHeight: 1.8, color: '#374151' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: () => {
                        // 跳过文章中的第一个 h1 标题（因为已经在顶部显示了）
                        return null;
                      },
                      a: ({ href, children }) => {
                        if (href && (href.includes('bilibili.com') || href.startsWith('BV'))) {
                          const embed = bilibiliEmbedUrl(href);
                          if (embed) return <iframe src={embed} sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen" style={{ width: '100%', height: 200, border: 'none', borderRadius: 8, margin: '12px 0' }} allowFullScreen />;
                        }
                        return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{children}</a>;
                      },
                      img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: 6, margin: '8px 0' }} />,
                      code: ({ className, children }) => {
                        const text = String(children).replace(/\n$/, '');
                        if (className) {
                          return <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 12 }}><code>{text}</code></pre>;
                        }
                        return <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>{text}</code>;
                      },
                      table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>{children}</table>,
                      th: ({ children }) => <th style={{ border: '1px solid #d1d5db', padding: '6px 10px', background: '#f9fafb', fontSize: 12, textAlign: 'left' }}>{children}</th>,
                      td: ({ children }) => <td style={{ border: '1px solid #e5e7eb', padding: '6px 10px', fontSize: 12 }}>{children}</td>,
                    }}
                  >
                    {detailData.article}
                  </ReactMarkdown>
                </div>
              )}

              <CourseQASection templateId={selectedResource.id} />

            </div>
          ) : null}
        </div>
      ) : (
        <>
          {!selectedFolder && (
            <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 12, minHeight: 40, padding: '0 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: 40 }}>
                <button
                  type="button"
                  onClick={() => handleLibraryViewChange('all')}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    borderRight: '1px solid #e2e8f0',
                    background: libraryView === 'all' ? '#fff' : '#f8fafc',
                    color: libraryView === 'all' ? '#2563eb' : '#64748b',
                    fontSize: 14,
                    fontWeight: libraryView === 'all' ? 800 : 700,
                    cursor: 'pointer',
                  }}
                >
                  全部课程
                  {libraryView === 'all' && (
                    <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, background: '#2563eb' }} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleLibraryViewChange('series')}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: libraryView === 'series' ? '#fff' : '#f8fafc',
                    color: libraryView === 'series' ? '#2563eb' : '#64748b',
                    fontSize: 14,
                    fontWeight: libraryView === 'series' ? 800 : 700,
                    cursor: 'pointer',
                  }}
                >
                  系列课程
                  {libraryView === 'series' && (
                    <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, background: '#2563eb' }} />
                  )}
                </button>
              </div>
            </div>
          )}

          {selectedFolder && (
            <div style={{ padding: '0 12px 8px' }}>
              <button
                type="button"
                onClick={() => window.history.back()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                <ArrowLeft size={13} />
                返回系列课程
              </button>
            </div>
          )}

          {selectedFolder && selectedFolder.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 12px 8px' }}>
              {selectedFolder.tags.slice(0, 4).map(tag => (
                <span key={tag} style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: 999 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 分类筛选 */}
          {libraryView === 'all' && availableCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                共 {filteredResources.length} 节课
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    !categoryFilter ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  全部
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      cat === categoryFilter ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
          {libraryView === 'series' && !selectedFolder && (
            <div className="course-library-panel__stats" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>共 {filteredFolders.length} 个系列</span>
            </div>
          )}

          {libraryView === 'series' && !selectedFolder && filteredFolders.length > 0 && (
            <div style={{ padding: '0 12px 12px' }}>
              <div className="course-library-panel__grid">
                {filteredFolders.map(folder => (
                  <button
                    key={folder.folder_id}
                    type="button"
                    onClick={() => handleSelectFolder(folder)}
                    className="course-library-panel__card"
                    style={{ position: 'relative', padding: 0, overflow: 'visible', cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left' }}
                  >
                    <div style={{ position: 'relative', paddingBottom: '75%' }}>
                      <div style={{ position: 'absolute', left: 9, top: 7, right: -5, bottom: -5, borderRadius: 8, background: '#e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }} />
                      <div style={{ position: 'absolute', left: 4, top: 14, right: -1, bottom: -9, borderRadius: 8, background: '#cbd5e1', boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }} />
                      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', boxShadow: '0 2px 8px rgba(15,23,42,0.12)' }}>
                        {folder.cover_url ? (
                          <img src={folder.cover_url} alt={folder.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', color: '#94a3b8' }}>
                            <FolderOpen size={38} />
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.45), transparent)', padding: '32px 10px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ minWidth: 0, flex: 1, fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                              {folder.name}
                            </div>
                            {folder.pinned && <Pin size={13} color="#fbbf24" />}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)' }}>{folder.items.length} 节课程</span>
                            {folder.category && (
                              <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>{folder.category}</span>
                            )}
                          </div>
                          {folder.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                              {folder.tags.slice(0, 2).map(tag => (
                                <span key={tag} style={{ fontSize: 10, lineHeight: 1, color: '#f8fafc', background: 'rgba(255,255,255,0.16)', padding: '3px 5px', borderRadius: 4 }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredResources.length === 0 && filteredFolders.length === 0 ? (
            <div className="course-library-panel__empty"><p>暂无匹配的课程</p></div>
          ) : (libraryView === 'all' || selectedFolder) && filteredResources.length > 0 ? (
            <div className="course-library-panel__grid">
              {filteredResources.map((r) => {
                const thumbnailUrl = getThumbnailUrl(r);
                return (
                  <div key={`${r.type}-${r.id}`} className="course-library-panel__card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => r.type === 'source_code' ? handleOpenDetail(r) : navigate(`/firmware/${r.firmware_id}`)}
                  >
                    {/* 图片区域 - 4:3 比例 */}
                    <div style={{ position: 'relative', paddingBottom: '75%', background: r.type === 'source_code' ? '#f1f5f9' : '#fff7ed' }}>
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={r.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.type === 'source_code' ? '#94a3b8' : '#ea580c' }}>
                          {r.type === 'source_code' ? (
                            <BookOpen size={36} />
                          ) : (
                            <Cpu size={36} />
                          )}
                        </div>
                      )}
                      {/* 渐变遮罩层 + 标题 */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.6), transparent)', padding: '32px 10px 10px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                          {r.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <StarRating level={r.level} size={12} />
                          <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>{r.category}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {r.tags.slice(0, 2).map(tag => (
                            <span key={tag} style={{ fontSize: 10, lineHeight: 1, color: '#f8fafc', background: 'rgba(255,255,255,0.16)', padding: '3px 5px', borderRadius: 4 }}>
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
          ) : null}
        </>
      )}
    </div>
  );
}

// ============================================================================
// EditorTabs 主组件
// ============================================================================

export function EditorTabs({
  value,
  onChange,
  maxLength = 50000,
  readOnly = false,
  onProjectFilesChange,
  onCourseDetailChange,
  onImportProject,
  onConversionWarning,
  selectedBoardInfo,
  localFirmwareFiles = [],
  localFirmwareAnalysis = null,
  onLocalFirmwareChange
}: EditorTabsProps) {
  const viewMode = useEditorStore((s) => s.viewMode);
  const storeSetViewMode = useEditorStore((s) => s.setViewMode);
  const blocksRefreshTrigger = useEditorStore((s) => s.blocksRefreshTrigger);
  const [userEditedCode, setUserEditedCode] = useState(false);
  const [blocklyKey, setBlocklyKey] = useState(0);
  const [blocksXml, setBlocksXml] = useState<string | null>(() => useEditorStore.getState().blocksXml);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[] | null>(null);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');

  const showConversionWarning = useCallback((message: string) => {
    onConversionWarning?.(message);
  }, [onConversionWarning]);

  // 保存代码的本地副本，防止切换时丢失
  const savedCodeRef = useRef<string>(value);

  // 从全局 store 恢复持久化的多文件状态
  const initFromStore = (): CodeFile[] => {
    const storeFiles = useEditorStore.getState().projectFiles;
    if (storeFiles && storeFiles.length > 0) {
      return storeFiles.map(f => ({
        id: f.id,
        name: f.name,
        content: f.content,
        type: f.name.endsWith('.cpp') ? 'cpp' as const : f.name.endsWith('.h') ? 'h' as const : 'ino' as const,
      }));
    }
    return [{ id: 'main-file', name: 'sketch.ino', content: value, type: 'ino' as const }];
  };

  // 多文件项目状态
  const [projectFiles, setProjectFiles] = useState<CodeFile[]>(initFromStore);
  const [activeFileId, setActiveFileId] = useState(
    () => useEditorStore.getState().projectFiles?.[0]?.id || 'main-file'
  );
  const hydratedRef = useRef(false);

  const updateBlocksXml = (xml: string | null) => {
    setBlocksXml(xml);
    useEditorStore.getState().setBlocksXml(xml);
  };

  useEffect(() => {
    if (viewMode === 'blocks') setBlocksXml(useEditorStore.getState().blocksXml);
  }, [viewMode]);

  // 异步恢复：zustand persist 中间件异步加载 localStorage，初始同步读取为空。
  // 等 store 恢复完成后，将持久化的 projectFiles 同步到本地 state。
  useEffect(() => {
    const restoreProjectFiles = () => {
      const storeFiles = useEditorStore.getState().projectFiles;
      if (storeFiles && storeFiles.length > 0) {
        const codeFiles: CodeFile[] = storeFiles.map(f => ({
          id: f.id || `file-${Date.now()}-${f.name}`,
          name: f.name,
          content: f.content,
          type: (f.name.endsWith('.cpp') ? 'cpp' : f.name.endsWith('.h') ? 'h' : 'ino') as CodeFile['type'],
        }));
        setProjectFiles(codeFiles);
        setActiveFileId(codeFiles[0]?.id || 'main-file');
        // 恢复主文件代码到编辑器
        const main = codeFiles.find(f => f.type === 'ino') || codeFiles[0];
        if (main) {
          savedCodeRef.current = main.content;
          onChange(main.content);
        }
      }
      hydratedRef.current = true;
    };

    if (useEditorStore.persist.hasHydrated()) {
      restoreProjectFiles();
    }

    // zustand persist 的 onRehydrateStorage 回调在恢复完成时触发
    const unsub = useEditorStore.persist.onFinishHydration(restoreProjectFiles);
    return () => { unsub(); };
  }, []); // 仅挂载时执行一次

  // 自动将本地文件变更同步回全局 store（跳过首次挂载与 hydration 前）
  const onProjectFilesChangeRef = useRef(onProjectFilesChange);
  onProjectFilesChangeRef.current = onProjectFilesChange;
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) { didInitRef.current = true; return; }
    if (!hydratedRef.current) return;
    const simpleFiles = projectFiles.map(f => ({ name: f.name, content: f.content }));
    onProjectFilesChangeRef.current?.(simpleFiles);
  }, [projectFiles]);

  // 添加新文件
  const handleAddNewFile = () => {
    const count = projectFiles.length + 1;
    const ext = projectFiles[0]?.type === 'cpp' ? '.cpp' : '.ino';
    const newId = `file-${Date.now()}`;
    const newFile: CodeFile = {
      id: newId,
      name: `sketch_${count}${ext}`,
      content: '',
      type: ext === '.cpp' ? 'cpp' : 'ino',
    };
    setProjectFiles(prev => [...prev, newFile]);
    setActiveFileId(newId);
  };

  // 切换积木前保存代码，切回代码时恢复
  const preBlocksCodeRef = useRef<string>('');


  // 文件拖拽区域引用
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  // 只在代码视图同步外部 value 到 savedCodeRef
  // 库视图和积木视图都不同步，避免非代码视图的 store 变更污染原始代码
  useEffect(() => {
    if (viewMode !== 'code') return;
    if (value !== savedCodeRef.current && value.trim()) {
      savedCodeRef.current = value;
      setUserEditedCode(!useEditorStore.getState().blocksXml);
      setProjectFiles(prev => prev.map(f =>
        f.id === activeFileId ? { ...f, content: value } : f
      ));
    }
  }, [value, viewMode]);

  // 当切换到代码视图时，强制卸载 Blockly
  useEffect(() => {
    if (viewMode === 'code') {
      // 清理可能残留的 Blockly DOM 元素
      const cleanupBlockly = () => {
        // 移除所有 Blockly 相关的 div
        const blocklyDivs = document.querySelectorAll('[class*="blockly"]');
        blocklyDivs.forEach(div => {
          if (div.parentElement && !div.closest('.editor-tabs__content')) {
            div.remove();
          }
        });
        
        // 移除 Blockly 的 SVG 元素
        const blocklyWidgets = document.querySelectorAll('.blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv');
        blocklyWidgets.forEach(widget => widget.remove());
      };
      
      // 延迟清理，确保 React 先完成卸载
      const timer = setTimeout(() => {
        cleanupBlockly();
        setBlocklyKey(prev => prev + 1);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // 监听 AI 部署触发刷新（在积木模式下重新解析代码）
  useEffect(() => {
    if (viewMode !== 'blocks' || blocksRefreshTrigger === 0) return;
    const currentCode = useEditorStore.getState().code;
    if (!currentCode || !currentCode.trim()) return;
    let cancelled = false;
    convertCodeToBlocksXml(currentCode)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.warnings.length === 0) {
          updateBlocksXml(result.xml);
          setBlocklyKey((k) => k + 1);
        } else {
          updateBlocksXml(null);
          const count = result.warnings?.length || 0;
          showConversionWarning(
            count > 0
              ? `有 ${count} 处代码无法转换成积木：${result.warnings.slice(0, 2).join('；')}。原代码已保留，请在代码编程中烧录。`
              : '代码无法转换成积木。原代码已保留，请在代码编程中烧录。'
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        updateBlocksXml(null);
          showConversionWarning('代码转换异常，原代码已保留，请使用代码编程烧录。');
      });
    return () => {
      cancelled = true;
    };
  }, [blocksRefreshTrigger, showConversionWarning]);

  // 处理代码变化
  const handleCodeChange = (newCode: string) => {
    savedCodeRef.current = newCode;
    onChange(newCode);
    // 同步当前编辑的文件内容到 projectFiles
    setProjectFiles(prev => prev.map(f =>
      f.id === activeFileId ? { ...f, content: newCode } : f
    ));
    // 如果用户手动编辑了代码，标记为已编辑
    if (viewMode === 'code') {
      setUserEditedCode(true);
      if (useEditorStore.getState().blocksXml) updateBlocksXml(null);
    }
  };
  
  // 处理项目文件变化
  const syncProjectFiles = (files: CodeFile[]) => {
    const simpleFiles = files.map(f => ({ name: f.name, content: f.content }));
    onProjectFilesChange?.(simpleFiles);
  };

  const requestUploadMode = (files: File[] | FileList) => {
    if (viewMode === 'library' || viewMode === 'firmware') return;
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;
    setPendingUploadFiles(selectedFiles);
  };

  // 处理文件上传（支持多文件和文件夹）
  const handleFilesUpload = async (files: File[] | FileList, mode: UploadMode) => {
    const uploadedFiles: CodeFile[] = [];
    const selectedFiles = Array.from(files);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      const rawPath = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/');
      const safePath = rawPath
        .split('/')
        .filter(part => part && part !== '.' && part !== '..' && !part.startsWith('.'))
        .join('/');

      if (!safePath) continue;

      const displayName = safePath;
      const basename = safePath.split('/').pop() || safePath;

      // 跳过隐藏文件（如 .DS_Store）
      if (basename.startsWith('.')) continue;
      
      // 只处理代码文件
      const validExtensions = ['.ino', '.cpp', '.h', '.c', '.hpp'];
      const hasValidExt = validExtensions.some(ext => basename.toLowerCase().endsWith(ext));
      
      if (!hasValidExt) continue;
      
      try {
        const content = await readFileAsText(file);
        const fileType = getFileType(basename);
        
        uploadedFiles.push({
          id: `file-${Date.now()}-${i}`,
          name: displayName,
          content,
          type: fileType
        });
      } catch (error) {
        console.error(`读取文件 ${displayName} 失败:`, error);
      }
    }
    
    if (uploadedFiles.length === 0) {
      alert('没有找到有效的代码文件（支持 .ino, .cpp, .h, .c, .hpp）');
      return;
    }
    
    storeSetViewMode('code');

    let nextFiles: CodeFile[];
    let activeUploadFile: CodeFile | undefined;

    if (mode === 'replace') {
      nextFiles = uploadedFiles;
      activeUploadFile = uploadedFiles.find(f => f.type === 'ino') || uploadedFiles[0];
    } else {
      const existingNames = new Set(projectFiles.map(f => f.name.toLowerCase()));
      const newFiles = uploadedFiles.filter(f => !existingNames.has(f.name.toLowerCase()));
      if (newFiles.length === 0) {
        alert('所有选择的文件已存在，未添加新文件');
        return;
      }
      nextFiles = [...projectFiles, ...newFiles];
      activeUploadFile = newFiles.find(f => f.type === 'ino') || newFiles[0];
    }

    setProjectFiles(nextFiles);
    syncProjectFiles(nextFiles);

    // 自动检测开发板（仅当之前未选择时）
    const allCode = uploadedFiles.map(f => f.content).join('\n');
    const detectedBoard = detectBoardFromCode(allCode);
    const currentBoard = useEditorStore.getState().selectedBoard;
    if (detectedBoard && !currentBoard) {
      useEditorStore.getState().setSelectedBoard(detectedBoard);
    }

    // 设置活动文件为第一个 .ino 文件或第一个文件
    const mainFile = activeUploadFile || nextFiles.find(f => f.type === 'ino') || nextFiles[0];
    setActiveFileId(mainFile.id);

    // 更新全局代码状态
    savedCodeRef.current = mainFile.content;
    onChange(mainFile.content);
  };
  
  // 读取文件内容
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(content);
        } else {
          reject(new Error('文件内容格式错误'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  };
  
  // 获取文件类型
  const getFileType = (fileName: string): CodeFile['type'] => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'ino' || ext === 'cpp' || ext === 'h' || ext === 'c' || ext === 'hpp') {
      return ext as CodeFile['type'];
    }
    return 'other';
  };
  
  // 处理文件拖拽
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;
    
    const handleDragOver = (e: DragEvent) => {
      if (viewMode === 'library' || viewMode === 'firmware') return;
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    };
    
    const handleDrop = async (e: DragEvent) => {
      if (viewMode === 'library' || viewMode === 'firmware') return;
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
      
      const items = e.dataTransfer?.items;
      if (!items) return;
      
      const files: File[] = [];
      
      // 处理拖拽的文件和文件夹
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await traverseFileTree(entry, files);
          }
        }
      }
      
      if (files.length > 0) {
        requestUploadMode(files);
      }
    };
    
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [viewMode]);
  
  // 遍历文件树（支持文件夹）
  const traverseFileTree = async (entry: any, files: File[]): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        entry.file((f: File) => resolve(f));
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        reader.readEntries((e: any[]) => resolve(e));
      });
      
      for (const childEntry of entries) {
        await traverseFileTree(childEntry, files);
      }
    }
  };
  
  // 处理文件选择（点击上传按钮）
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      requestUploadMode(files);
      e.target.value = '';
    }
  };

  const confirmPendingUpload = async (mode: UploadMode) => {
    const files = pendingUploadFiles;
    setPendingUploadFiles(null);
    if (!files) return;
    await handleFilesUpload(files, mode);
  };


  const handleFirmwareInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => file.name.toLowerCase().endsWith('.bin'));
    e.target.value = '';
    if (files.length === 0) {
      alert('请选择 .bin 固件文件');
      return;
    }
    const analysis = await analyzeLocalFirmwareFiles(files, {
      boardId: selectedBoardInfo?.id,
      boardName: selectedBoardInfo?.name,
      chipFamily: selectedBoardInfo?.chip_family,
    });
    const firmwareFiles = filesToLocalFirmwareFiles(files, analysis);
    onLocalFirmwareChange?.(firmwareFiles, analysis);
    storeSetViewMode('firmware');
    window.history.pushState({
      app: HISTORY_APP_ID,
      mode: 'firmware',
      libraryView: 'all',
      folderId: null,
      resourceId: null,
    }, '', window.location.href);
  };

  const updateLocalFirmwareAddress = (id: string, value: string) => {
    const parsed = parseHexAddress(value);
    if (parsed === null) return;
    onLocalFirmwareChange?.(
      localFirmwareFiles.map(file => file.id === id ? { ...file, address: parsed } : file),
      localFirmwareAnalysis
    );
  };

  // 下载项目压缩包
  const handleDownloadProject = async () => {
    if (projectFiles.length === 0 && !value.trim()) {
      return;
    }

    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      
      if (projectFiles.length > 0) {
        // 多文件项目
        projectFiles.forEach(file => {
          zip.file(file.name, file.content);
        });
      } else {
        // 单文件项目
        zip.file('sketch.ino', value);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download project failed:', e);
    }
  };

  // 切换视图模式
  const handleViewModeChange = async (mode: ViewMode) => {
    // 切换到代码/积木视图时，关闭课程详情面板
    if (mode !== 'library' && onCourseDetailChange) {
      onCourseDetailChange(false);
    }

    if (mode === 'blocks') {
      preBlocksCodeRef.current = savedCodeRef.current;

      const savedWorkspace = useEditorStore.getState().blocksXml;
      if (savedWorkspace && !userEditedCode) {
        setBlocksXml(savedWorkspace);
        storeSetViewMode(mode);
        return;
      }

      const currentCode = savedCodeRef.current;
      if (currentCode && currentCode.trim()) {
        try {
          const result = await convertCodeToBlocksXml(currentCode);
          if (result.success && result.warnings.length === 0) {
            updateBlocksXml(result.xml);
          } else {
            // 严格拒绝：任何警告都不过
            const count = result.warnings?.length || 0;
            updateBlocksXml(null);
            showConversionWarning(
              `有 ${count} 处代码无法转换成积木：${result.warnings.slice(0, 2).join('；')}。原代码已保留，请在代码编程中烧录。`
            );
            return;
          }
        } catch {
          updateBlocksXml(null);
          showConversionWarning(
            '有代码无法转换成积木。原代码已保留，请在代码编程中烧录。'
          );
          return;
        }
      } else {
        updateBlocksXml(null);
      }
      setUserEditedCode(false);
    }

    if (mode === 'code' && preBlocksCodeRef.current && !useEditorStore.getState().blocksXml) {
      savedCodeRef.current = preBlocksCodeRef.current;
      onChange(preBlocksCodeRef.current);
      setProjectFiles(prev => prev.map(f =>
        f.id === 'main-file' ? { ...f, content: preBlocksCodeRef.current } : f
      ));
      preBlocksCodeRef.current = '';
    }

    storeSetViewMode(mode);
    window.history.pushState({
      app: HISTORY_APP_ID,
      mode,
      libraryView: 'all',
      folderId: null,
      resourceId: null,
    }, '', window.location.href);
  };

  const topBarNotice = (userEditedCode && value.trim()) ? (
    <div className="code-editor__conversion-error code-editor__user-edited">
      <span>⚠️ 代码已手动修改</span>
      <button onClick={handleDownloadProject}>下载保存项目</button>
    </div>
  ) : null;

  return (
    <div className="editor-tabs flex flex-col flex-1 min-h-0 overflow-hidden" ref={dropZoneRef}>
      {pendingUploadFiles ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">选择上传方式</h2>
                <p className="mt-1 text-sm text-slate-500">
                  已选择 {pendingUploadFiles.length} 个文件，请选择如何导入到当前工程。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingUploadFiles(null)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="取消上传"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => confirmPendingUpload('replace')}
                className="flex min-h-[96px] flex-col items-start justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-red-700 hover:bg-red-100"
              >
                <FileCode2 size={20} />
                <span className="font-bold">直接覆盖</span>
                <span className="text-xs leading-5 text-red-600">清空当前工程，只保留这次上传的文件。</span>
              </button>
              <button
                type="button"
                onClick={() => confirmPendingUpload('append')}
                className="flex min-h-[96px] flex-col items-start justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left text-blue-700 hover:bg-blue-100"
              >
                <Plus size={20} />
                <span className="font-bold">添加新文件</span>
                <span className="text-xs leading-5 text-blue-600">保留当前工程，同名文件会跳过。</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 标签页头部 - 参考UI风格 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 gap-3">
        {/* Segmented Control 视图切换器 */}
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
          <div className="flex flex-wrap sm:flex-nowrap p-1 bg-slate-200/50 rounded-xl border border-slate-200 shadow-inner w-full sm:w-auto">
            <button
              onClick={() => handleViewModeChange('code')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewMode === 'code'
                  ? 'bg-white text-blue-600 font-bold shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-medium'
              }`}
            >
              <Code2 size={18} className={viewMode === 'code' ? 'text-blue-500' : 'text-slate-400'} />
              <span>代码编程</span>
              {projectFiles.length > 1 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-md font-black leading-none ml-1">{projectFiles.length}</span>
              )}
            </button>
            <button
              onPointerEnter={preloadBlocklyEditor}
              onFocus={preloadBlocklyEditor}
              onClick={() => handleViewModeChange('blocks')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewMode === 'blocks'
                  ? 'bg-white text-blue-600 font-bold shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-medium'
              }`}
            >
              <Blocks size={18} className={viewMode === 'blocks' ? 'text-blue-500' : 'text-slate-400'} />
              <span>积木编程</span>
            </button>
            <button
              onClick={() => handleViewModeChange('firmware')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewMode === 'firmware'
                  ? 'bg-white text-blue-600 font-bold shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-medium'
              }`}
            >
              <UploadCloud size={18} className={viewMode === 'firmware' ? 'text-blue-500' : 'text-slate-400'} />
              <span>固件模式</span>
            </button>
            <button
              onClick={() => handleViewModeChange('library')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewMode === 'library'
                  ? 'bg-white text-blue-600 font-bold shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-medium'
              }`}
            >
              <BookOpen size={18} className={viewMode === 'library' ? 'text-blue-500' : 'text-slate-400'} />
              <span>课程库</span>
            </button>
          </div>

          {topBarNotice && viewMode !== 'library' && viewMode !== 'firmware' && (
            <div className="flex min-w-0 flex-1 justify-start sm:justify-end">
              {topBarNotice}
            </div>
          )}

          {viewMode === 'library' && (
            <div className="course-library-panel__search ml-auto min-w-[220px] flex-1 sm:max-w-[420px]" style={{ margin: 0 }}>
              <Search className="w-4 h-4" />
              <input
                type="text"
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                placeholder="搜索课程..."
              />
            </div>
          )}
        </div>

        <input
          type="file"
          id="firmware-upload-input"
          multiple
          accept=".bin"
          onChange={handleFirmwareInputChange}
          style={{ display: 'none' }}
        />

        {/* 导入代码：只在代码/积木视图出现 */}
        {viewMode !== 'library' && viewMode !== 'firmware' && (
          <div className="editor-tabs__actions">
            <input
              type="file"
              id="file-upload-input"
              multiple
              accept=".ino,.cpp,.h,.c,.hpp"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload-input" className="flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto shrink-0 cursor-pointer" title="导入代码文件（支持多选）">
              <FileUp size={16} />
              <span>导入代码</span>
            </label>
          </div>
        )}

      </div>

      {/* 拖拽提示 */}
      {viewMode !== 'library' && viewMode !== 'firmware' && (
        <div className="editor-tabs__drop-hint">
          <FolderOpen className="w-8 h-8" />
          <p>拖拽文件或文件夹到这里</p>
          <span>支持 .ino, .cpp, .h 等文件</span>
        </div>
      )}

      {/* 内容区域 */}
      <div className="editor-tabs__content flex-1 min-h-0 overflow-hidden">
        {viewMode === 'code' ? (
            <CodeEditor
              value={savedCodeRef.current}
              onChange={handleCodeChange}
              maxLength={maxLength}
              readOnly={readOnly}
            files={projectFiles}
            activeFileId={activeFileId}
            onActiveFileChange={(fid) => {
              // 保存当前代码
              const updated = projectFiles.map(pf =>
                pf.id === activeFileId ? { ...pf, content: savedCodeRef.current } : pf
              );
              setProjectFiles(updated);
              setActiveFileId(fid);
              const target = updated.find(pf => pf.id === fid);
              if (target) {
                savedCodeRef.current = target.content;
                onChange(target.content);
              }
            }}
            onFileRename={(fid, newName) => {
              setProjectFiles(prev => prev.map(pf =>
                pf.id === fid ? { ...pf, name: newName, type: newName.endsWith('.cpp') ? 'cpp' : newName.endsWith('.h') ? 'h' : 'ino' } : pf
              ));
            }}
            onFileClose={(fid) => {
              const remaining = projectFiles.filter(pf => pf.id !== fid);
              if (remaining.length === 0) {
                const newId = `file-${Date.now()}`;
                const newFile: CodeFile = { id: newId, name: 'sketch.ino', content: '', type: 'ino' as const };
                setProjectFiles([newFile]);
                setActiveFileId(newId);
                savedCodeRef.current = '';
                onChange('');
                return;
              }
              setProjectFiles(remaining);
              if (fid === activeFileId) {
                const newActive = remaining[0];
                setActiveFileId(newActive.id);
                savedCodeRef.current = newActive.content;
                onChange(newActive.content);
              }
            }}
            onAddFile={handleAddNewFile}
            onDownload={handleDownloadProject}
            headerHint={undefined}
          />
        ) : null}
        
        {viewMode === 'blocks' ? (
          <div className="h-full blockly-container" key={`blockly-${blocklyKey}`}>
            <Suspense fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                正在加载积木视图...
              </div>
            }>
              <BlocklyEditor
                initialXml={blocksXml ?? undefined}
                onCodeChange={(generatedCode) => setProjectFiles(prev => {
                  const main = prev.find((file) => file.type === 'ino') || prev[0];
                  if (!main || main.content === generatedCode) return prev;
                  return prev.map((file) => file.id === main.id ? { ...file, content: generatedCode } : file);
                })}
              />
            </Suspense>
          </div>
        ) : null}


        {viewMode === 'firmware' ? (
          <div className="local-firmware-panel">
            <div className="local-firmware-panel__hero">
              <div>
                <div className="local-firmware-panel__eyebrow"><ShieldCheck size={16} /> 本地固件烧录</div>
                <h2>确认固件地址</h2>
                <p>系统先帮你填好。不确定就问 AI。</p>
              </div>
              <label htmlFor="firmware-upload-input" className="local-firmware-panel__replace">
                <UploadCloud size={16} />
                <span>{localFirmwareFiles.length > 0 ? '更换固件' : '上传固件'}</span>
              </label>
            </div>

            {localFirmwareAnalysis && (
              <div className={`local-firmware-panel__summary local-firmware-panel__summary--${localFirmwareAnalysis.confidence}`}>
                <strong>{localFirmwareAnalysis.confidence === 'high' ? '基本靠谱' : localFirmwareAnalysis.confidence === 'medium' ? '再看一眼' : '先别急烧'}</strong>
                <span>{localFirmwareAnalysis.reason}</span>
              </div>
            )}


            <div className="local-firmware-panel__table">
              <div className="local-firmware-panel__row local-firmware-panel__row--head">
                <span>文件名</span>
                <span>大小</span>
                <span>类型</span>
                <span>烧录地址</span>
              </div>
              {localFirmwareFiles.map((file) => (
                <div className="local-firmware-panel__row" key={file.id}>
                  <span title={file.name}>{file.name}</span>
                  <span>{(file.size / 1024).toFixed(file.size > 1024 * 1024 ? 0 : 1)} KB</span>
                  <span>{file.role === 'merged' ? '完整固件' : file.role === 'app' ? '应用固件' : file.role}</span>
                  <input
                    value={formatHexAddress(file.address)}
                    onChange={(event) => updateLocalFirmwareAddress(file.id, event.target.value)}
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>

            {localFirmwareAnalysis?.warnings?.length ? (
              <div className="local-firmware-panel__warnings">
                {localFirmwareAnalysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}

            <div className="local-firmware-panel__note">
              <strong>烧录地址提醒：</strong>如地址不确定/烧录失败，求助 AI 助手
            </div>
          </div>
        ) : null}

        {viewMode === 'library' ? (
          <CourseLibraryPanel
            onLoadProject={(files, boardId) => {
              // Load files into project
              const codeFiles = files.map((f, i) => ({
                id: `file-${Date.now()}-${i}`,
                name: f.name,
                content: f.content,
                type: getFileType(f.name)
              }));
              setProjectFiles(codeFiles);
              if (onProjectFilesChange) {
                onProjectFilesChange(files);
              }
              // Switch to project view
              storeSetViewMode('code');
              // Auto-select project board
              if (boardId) {
                useEditorStore.getState().setSelectedBoard(boardId);
              }
              // Set active file
              const mainFile = codeFiles.find(f => f.type === 'ino') || codeFiles[0];
              if (mainFile) {
                setActiveFileId(mainFile.id);
                savedCodeRef.current = mainFile.content;
                onChange(mainFile.content);
              }
            }}
            onCourseDetailChange={onCourseDetailChange}
            onImportProject={onImportProject}
            searchQuery={courseSearchQuery}
          />
        ) : null}
      </div>
    </div>
  );
}
