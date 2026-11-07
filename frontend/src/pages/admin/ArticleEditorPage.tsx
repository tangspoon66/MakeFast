/**
 * 管理端文章编辑：TipTap 所见即所得（类飞书/Notion），三档文档 + 资料侧栏 + 自动保存。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, type CoursePack } from './api';
import { Alert, Empty, Loading } from '../../components/admin/ui';
import { errText, useLoad } from '../../components/admin/uiHooks';
import { useAdminMe } from '../../components/admin/AdminConsoleContext';
import { FIRST_LESSON_ARTICLE } from '../../lesson/articles/firstLessonArticle';
import { AGE_TAB_LABEL, type AgeTier, type CourseArticle } from '../../lesson/articles/types';
import { ArticleDocEditor } from '../../components/admin/article/ArticleDocEditor';
import '../../styles/article-editor.css';

const TIERS: AgeTier[] = ['low', 'mid', 'high'];

function blankArticle(slug: string, title: string): CourseArticle {
  if (slug === 'first-lesson') {
    return { ...structuredClone(FIRST_LESSON_ARTICLE), slug, courseId: slug, title: title || FIRST_LESSON_ARTICLE.title };
  }
  return {
    slug, courseId: slug, title: title || slug, cover: '',
    subtitle: { low: '', mid: '', high: '' },
    docs: { low: '<h2>第一章</h2><p></p>', mid: '<h2>第一章</h2><p></p>', high: '<h2>第一章</h2><p></p>' },
    bilibili: { bvid: '', title: '' },
    resources: [],
    workbenchPath: `/workbench?course=${slug}`,
  };
}

export function ArticleEditorPage() {
  const me = useAdminMe();
  const canEdit = me?.role === 'admin' || me?.role === 'editor';
  const [params, setParams] = useSearchParams();
  const slug = params.get('slug') || '';
  const { data: courses, loading: listLoading, error: listErr } = useLoad(() => get<{ items: CoursePack[] }>('/courses'), []);
  const list = courses?.items || [];

  const [tier, setTier] = useState<AgeTier>('low');
  const [art, setArt] = useState<CourseArticle | null>(null);
  const [rev, setRev] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState<{ message: string; errors: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artRef = useRef(art);
  artRef.current = art;

  const loadArticle = useCallback(async (s: string) => {
    setErr(null); setMsg(''); setDirty(false);
    const course = list.find((c) => c.slug === s);
    try {
      const j = await get<{ article: CourseArticle | null; revision: number; status: string }>(`/courses/${encodeURIComponent(s)}/article`);
      setRev(j.revision); setStatus(j.status);
      const title = course?.title || (s === 'first-lesson' ? FIRST_LESSON_ARTICLE.title : s);
      if (j.article && typeof j.article === 'object') {
        const merged = blankArticle(s, title);
        const remote = j.article as CourseArticle;
        setArt({
          ...merged,
          ...remote,
          slug: s,
          docs: {
            low: remote.docs?.low || merged.docs.low,
            mid: remote.docs?.mid || merged.docs.mid,
            high: remote.docs?.high || merged.docs.high,
          },
          subtitle: { ...merged.subtitle, ...(remote.subtitle || {}) },
          resources: remote.resources?.length ? remote.resources : merged.resources,
        });
      } else {
        setArt(blankArticle(s, title));
      }
    } catch (e) {
      setErr(errText(e));
      setArt(blankArticle(s, course?.title || (s === 'first-lesson' ? FIRST_LESSON_ARTICLE.title : s)));
    }
  }, [list]);

  useEffect(() => {
    if (!slug) return;
    void loadArticle(slug);
  }, [slug, loadArticle]);

  const selectSlug = (s: string) => {
    setParams(s ? { slug: s } : {});
    setArt(null);
  };

  const persist = useCallback(async (silent = false) => {
    const cur = artRef.current;
    if (!cur || !slug || !canEdit) return;
    setSaving(true);
    if (!silent) { setErr(null); setMsg(''); }
    try {
      const r = await fetch(`/api/admin/console/courses/${encodeURIComponent(slug)}/article`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article: cur }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail?.message || j?.message || '保存失败');
      setRev(j.revision);
      setDirty(false);
      if (!silent) setMsg('已保存文章');
      else setMsg('已自动保存');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setSaving(false);
    }
  }, [slug, canEdit]);

  const markDirty = useCallback((next: CourseArticle) => {
    setArt(next);
    setDirty(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void persist(true); }, 2500);
  }, [persist]);

  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!slug) return null;
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`/api/admin/console/courses/${encodeURIComponent(slug)}/article/images`, {
      method: 'POST', body: fd, credentials: 'include',
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.detail?.message || j?.message || '上传失败');
    return j.url as string;
  };

  const uploadResource = async (file: File, kind: 'pdf' | 'stl') => {
    if (!slug || !art) return;
    const q = new URLSearchParams({ kind, name: file.name });
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`/api/admin/console/courses/${encodeURIComponent(slug)}/resources/upload?${q}`, {
      method: 'POST', body: fd, credentials: 'include',
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.detail?.message || '上传失败');
    markDirty({ ...art, resources: j.resources || [] });
  };

  const publish = async () => {
    if (!slug) return;
    await persist(false);
    const r = await fetch(`/api/admin/console/courses/${encodeURIComponent(slug)}/publish`, { method: 'POST', credentials: 'include' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr({ message: j?.detail?.message || '发布失败', errors: [] });
      return;
    }
    setStatus('published');
    setMsg('已发布，学生端可见');
  };

  if (listLoading) return <Loading />;
  if (listErr) return <Alert message={listErr} />;

  return (
    <div data-testid="admin-article-editor">
      <div className="adm-btns" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <label className="adm-muted">选择课程{' '}
          <select value={slug} onChange={(e) => selectSlug(e.target.value)} data-testid="article-course-select">
            <option value="">— 请选择 —</option>
            {list.map((c) => <option key={c.slug} value={c.slug}>{c.title}（{c.slug}）[{c.status}]</option>)}
          </select>
        </label>
        {slug && canEdit && (
          <>
            <button type="button" className="adm-btn primary" disabled={saving || !art} onClick={() => void persist(false)} data-testid="article-save">
              {saving ? '保存中…' : dirty ? '保存*' : '保存文章'}
            </button>
            <button type="button" className="adm-btn" disabled={saving || !art} onClick={() => void publish()} data-testid="article-publish">
              发布到学生端
            </button>
            <button type="button" className="adm-btn" onClick={() => art && markDirty(structuredClone(FIRST_LESSON_ARTICLE))}>填入第一课样例</button>
            <Link className="adm-btn" to={`/courses/${slug}`} target="_blank" rel="noreferrer">预览学生端 ↗</Link>
          </>
        )}
        {rev != null && <span className="adm-tag">rev {rev} · {status || '—'}{dirty ? ' · 未保存' : ''}</span>}
      </div>
      {err && <Alert message={err.message} errors={err.errors} onClose={() => setErr(null)} />}
      {msg && <p className="adm-tag ok">{msg}</p>}
      {!slug && <Empty title="先选一门课" hint="在上方下拉选择课程，用所见即所得编辑器写课文章节。" />}
      {slug && !art && <Loading />}
      {art && (
        <>
          <div className="adm-card" style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
            <label>标题 <input value={art.title} disabled={!canEdit} onChange={(e) => markDirty({ ...art, title: e.target.value })} /></label>
            <label>封面 URL <input value={art.cover || ''} disabled={!canEdit} onChange={(e) => markDirty({ ...art, cover: e.target.value })} placeholder="/boards/..." /></label>
            <label>本档副标题（{AGE_TAB_LABEL[tier]}）
              <input value={art.subtitle[tier]} disabled={!canEdit}
                onChange={(e) => markDirty({ ...art, subtitle: { ...art.subtitle, [tier]: e.target.value } })} />
            </label>
          </div>

          <div className="adm-btns" role="tablist" aria-label="年龄档" style={{ marginBottom: 8 }}>
            {TIERS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tier === t}
                className={`adm-btn${tier === t ? ' primary' : ''}`}
                data-testid={`article-tier-tab-${t}`} onClick={() => setTier(t)}>
                {AGE_TAB_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="ae-layout">
            <ArticleDocEditor
              key={`${slug}-${tier}`}
              content={art.docs[tier] || ''}
              editable={canEdit}
              onChange={(html) => markDirty({ ...art, docs: { ...art.docs, [tier]: html } })}
              onUploadImage={canEdit ? async (f) => {
                try { return await uploadImage(f); }
                catch (e) { setErr(errText(e)); return null; }
              } : undefined}
            />
            <aside className="ae-side" data-testid="article-resources-editor">
              <h4 style={{ margin: '0 0 8px' }}>资料 PDF / STL</h4>
              <p className="adm-muted" style={{ fontSize: 12 }}>侧栏上传，学生章节页「资料下载」可见。</p>
              <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
                {(art.resources || []).map((r) => (
                  <li key={r.id} style={{ marginBottom: 6 }}>
                    <span className="adm-tag">{r.kind}</span>{' '}
                    <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                  </li>
                ))}
              </ul>
              {canEdit && (
                <div className="adm-btns">
                  <label className="adm-btn">上传 PDF
                    <input hidden type="file" accept=".pdf,application/pdf" onChange={(e) => {
                      const f = e.target.files?.[0]; e.target.value = '';
                      if (f) void uploadResource(f, 'pdf').catch((er) => setErr(errText(er)));
                    }} />
                  </label>
                  <label className="adm-btn">上传 STL
                    <input hidden type="file" accept=".stl" onChange={(e) => {
                      const f = e.target.files?.[0]; e.target.value = '';
                      if (f) void uploadResource(f, 'stl').catch((er) => setErr(errText(er)));
                    }} />
                  </label>
                </div>
              )}
              <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid #e2eaf3' }} />
              <p className="adm-muted" style={{ fontSize: 12 }}>
                工具栏支持：标题、加粗/斜体、列表、链接、图片上传、小贴士/注意、B 站嵌入。切换年龄档编辑三份文档；约 2.5 秒无操作自动保存。
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export default ArticleEditorPage;
